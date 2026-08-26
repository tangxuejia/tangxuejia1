import { readFile } from 'node:fs/promises';
import { ProxyAgent, fetch as undiciFetch } from 'undici';

const WECHAT_API = 'https://api.weixin.qq.com';
const DEFAULT_ARTICLE_PATH = 'articles/test.json';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const articlePath = args.find((arg) => !arg.startsWith('--')) ?? DEFAULT_ARTICLE_PATH;
let proxyAgent = null;

main().catch((error) => {
  console.error(`publisher_failed: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const articlePayloads = articlePath.endsWith('batch-manifest.json')
    ? await loadBatchArticles(articlePath)
    : [normalizeArticle(await loadArticle(articlePath))];

  if (dryRun) {
    console.log('dry_run_ok');
    console.log(`article_file=${articlePath}`);
    console.log(`article_count=${articlePayloads.length}`);
    for (const [index, article] of articlePayloads.entries()) {
      console.log(`article_${index + 1}_title=${article.title}`);
      console.log(`article_${index + 1}_content_chars=${article.content.length}`);
      console.log(`article_${index + 1}_inline_images=${article.inline_images.length}`);
    }
    return;
  }

  const appId = requireEnv('WECHAT_APP_ID');
  const appSecret = requireEnv('WECHAT_APP_SECRET');
  proxyAgent = createProxyAgent();
  if (proxyAgent) console.log('wechat_proxy=enabled');

  const accessToken = await getAccessToken(appId, appSecret);
  const draftArticles = [];

  for (const [index, articlePayload] of articlePayloads.entries()) {
    const coverImage = articlePayload.inline_images[0] || articlePayload.thumb_image;
    const thumbMediaId = coverImage
      ? await uploadThumbImage(accessToken, coverImage)
      : await uploadDefaultThumb(accessToken);
    const contentWithInlineImages = await uploadInlineImages(
      accessToken,
      articlePayload.content,
      articlePayload.inline_images,
    );
    const { inline_images: inlineImages, thumb_image: thumbImage, ...draftArticle } = articlePayload;
    draftArticles.push({
      ...draftArticle,
      content: contentWithInlineImages,
      thumb_media_id: thumbMediaId,
    });
    console.log(`article_prepared=${index + 1}/${articlePayloads.length}`);
  }

  const draft = await addDraft(accessToken, draftArticles);
  console.log(`draft_media_id=${draft.media_id}`);
  console.log(`draft_article_count=${draftArticles.length}`);
  console.log('publish_status=success');
}

async function loadArticle(path) {
  const raw = await readFile(path, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${error.message}`);
  }
}

async function loadBatchArticles(manifestPath) {
  const manifest = await loadArticle(manifestPath);
  if (!manifest || manifest.count !== 3 || !Array.isArray(manifest.articles) || manifest.articles.length !== 3) {
    throw new Error('Batch manifest must contain exactly 3 articles.');
  }
  const baseDir = manifestPath.slice(0, manifestPath.lastIndexOf('/') + 1);
  return Promise.all(manifest.articles.map(async (item) => {
    if (!item?.file) throw new Error('Batch manifest article file is missing.');
    return normalizeArticle(await loadArticle(baseDir + item.file));
  }));
}

function normalizeArticle(article) {
  if (!article || typeof article !== 'object') {
    throw new Error('Article JSON must be an object.');
  }

  const title = cleanText(article.title);
  const content = normalizeContent(article.content);

  if (!title) {
    throw new Error('Article title is required.');
  }

  if (!content) {
    throw new Error('Article content is required.');
  }

  return removeEmpty({
    title,
    author: cleanText(article.author),
    digest: cleanText(article.digest),
    content,
    inline_images: normalizeInlineImages(article.inline_images),
    thumb_image: normalizeThumbImage(article.thumb_image),
    content_source_url: cleanText(article.content_source_url),
    thumb_media_id: cleanText(article.thumb_media_id),
    need_open_comment: Number.isInteger(article.need_open_comment) ? article.need_open_comment : 0,
    only_fans_can_comment: Number.isInteger(article.only_fans_can_comment)
      ? article.only_fans_can_comment
      : 0,
  });
}

function normalizeContent(content) {
  if (typeof content !== 'string') {
    return '';
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return '';
  }

  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}


function normalizeInlineImages(images) {
  if (!Array.isArray(images)) {
    return [];
  }

  return images.map((image, index) => {
    if (!image || typeof image !== 'object') {
      throw new Error(`inline_images[${index}] must be an object.`);
    }

    const id = cleanText(image.id);
    const base64 = cleanBase64(image.base64);
    const mime = cleanText(image.mime) || 'image/jpeg';
    const filename = cleanText(image.filename) || `${id || `image-${index + 1}`}.jpg`;
    const alt = cleanText(image.alt);

    if (!id) {
      throw new Error(`inline_images[${index}].id is required.`);
    }

    if (!base64) {
      throw new Error(`inline_images[${index}].base64 is required.`);
    }

    return { id, base64, mime, filename, alt };
  });
}

function normalizeThumbImage(image) {
  if (!image) {
    return null;
  }

  if (typeof image !== 'object') {
    throw new Error('thumb_image must be an object.');
  }

  const base64 = cleanBase64(image.base64);
  const mime = cleanText(image.mime) || 'image/jpeg';
  const filename = cleanText(image.filename) || 'wechat-news-thumb.jpg';
  const alt = cleanText(image.alt);

  if (!base64) {
    throw new Error('thumb_image.base64 is required.');
  }

  return { base64, mime, filename, alt };
}

async function getAccessToken(appId, appSecret) {
  const url = new URL('/cgi-bin/token', WECHAT_API);
  url.searchParams.set('grant_type', 'client_credential');
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', appSecret);

  const data = await requestJson(url, { method: 'GET' }, 'get_access_token');

  if (!data.access_token) {
    throw new Error(`WeChat did not return access_token: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

async function uploadThumbImage(accessToken, image) {
  const url = new URL('/cgi-bin/material/add_material', WECHAT_API);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('type', 'thumb');

  const form = new FormData();
  form.append('media', base64Blob(image.base64, image.mime), image.filename);

  const data = await requestJson(
    url,
    {
      method: 'POST',
      body: form,
    },
    'upload_thumb_image',
  );

  if (!data.media_id) {
    throw new Error(`WeChat did not return thumb media_id: ${JSON.stringify(data)}`);
  }

  console.log(`thumb_image_uploaded=${image.filename}`);
  console.log(`thumb_media_id=${data.media_id}`);
  return data.media_id;
}

async function uploadDefaultThumb(accessToken) {
  const url = new URL('/cgi-bin/material/add_material', WECHAT_API);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('type', 'thumb');

  const form = new FormData();
  form.append('media', defaultCoverBlob(), 'wechat-news-cover.jpg');

  const data = await requestJson(
    url,
    {
      method: 'POST',
      body: form,
    },
    'upload_default_thumb',
  );

  if (!data.media_id) {
    throw new Error(`WeChat did not return thumb media_id: ${JSON.stringify(data)}`);
  }

  console.log(`thumb_media_id=${data.media_id}`);
  return data.media_id;
}


async function uploadInlineImages(accessToken, content, images) {
  if (!images.length) {
    return content;
  }

  let nextContent = content;

  for (const image of images) {
    const placeholder = `{{image:${image.id}}}`;

    if (!nextContent.includes(placeholder)) {
      throw new Error(`Missing inline image placeholder: ${placeholder}`);
    }

    const imageUrl = await uploadInlineImage(accessToken, image);
    const imageHtml = inlineImageHtml(imageUrl, image.alt);
    nextContent = nextContent.split(placeholder).join(imageHtml);
    console.log(`inline_image_uploaded=${image.id}`);
  }

  return nextContent;
}

async function uploadInlineImage(accessToken, image) {
  const url = new URL('/cgi-bin/media/uploadimg', WECHAT_API);
  url.searchParams.set('access_token', accessToken);

  const form = new FormData();
  form.append('media', base64Blob(image.base64, image.mime), image.filename);

  const data = await requestJson(
    url,
    {
      method: 'POST',
      body: form,
    },
    `upload_inline_image:${image.id}`,
  );

  if (!data.url) {
    throw new Error(`WeChat did not return inline image url for ${image.id}: ${JSON.stringify(data)}`);
  }

  return data.url;
}

function inlineImageHtml(url, alt) {
  const altText = escapeHtml(alt);
  const src = escapeHtml(url);
  return `<p style="text-align:center;margin:16px 0;"><img src="${src}" alt="${altText}" style="max-width:100%;height:auto;" /></p>`;
}

function base64Blob(base64, mime) {
  const bytes = Uint8Array.from(Buffer.from(base64, 'base64'));
  return new Blob([bytes], { type: mime });
}

async function addDraft(accessToken, article) {
  const url = new URL('/cgi-bin/draft/add', WECHAT_API);
  url.searchParams.set('access_token', accessToken);

  const data = await requestJson(
    url,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ articles: Array.isArray(article) ? article : [article] }),
    },
    'add_draft',
  );

  if (!data.media_id) {
    throw new Error(`WeChat did not return draft media_id: ${JSON.stringify(data)}`);
  }

  return data;
}

async function requestJson(url, options, label) {
  const maxAttempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      console.log(`wechat_request=${label} attempt=${attempt}/${maxAttempts}`);
      const response = await fetchWithProxy(url, options);
      const text = await response.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`${label} returned non-JSON response (${response.status}): ${text.slice(0, 300)}`);
      }

      if (!response.ok) {
        const error = new Error(`${label} HTTP ${response.status}: ${JSON.stringify(data)}`);
        if (![408, 425, 429, 500, 502, 503, 504].includes(response.status) || attempt === maxAttempts) {
          throw error;
        }
        lastError = error;
        await retryDelay(attempt);
        continue;
      }

      if (data.errcode && data.errcode !== 0) {
        const error = new Error(`${label} WeChat error ${data.errcode}: ${data.errmsg}${wechatHint(data.errcode)}`);
        if (data.errcode !== 45009 || attempt === maxAttempts) {
          throw error;
        }
        lastError = error;
        await retryDelay(attempt);
        continue;
      }

      return data;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`wechat_request_failed=${label} attempt=${attempt}: ${message}`);
      if (attempt === maxAttempts) {
        throw new Error(`${label} failed after ${maxAttempts} attempts: ${message}`);
      }
      await retryDelay(attempt);
    }
  }

  throw lastError ?? new Error(`${label} failed`);
}

async function retryDelay(attempt) {
  await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
}

function createProxyAgent() {
  const proxyUrl = normalizeProxyUrl(process.env.WECHAT_PROXY_URL);

  if (!proxyUrl) {
    return null;
  }

  try {
    return new ProxyAgent(proxyUrl);
  } catch (error) {
    throw new Error(`Invalid WECHAT_PROXY_URL: ${error.message}`);
  }
}

function normalizeProxyUrl(value) {
  const raw = cleanText(value);

  if (!raw) {
    return '';
  }

  const curlProxy = raw.match(/--proxy\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))/);
  const candidate = (curlProxy ? curlProxy[1] || curlProxy[2] || curlProxy[3] : raw)
    .trim()
    .replace(/^["']|["']$/g, '');

  try {
    const url = new URL(candidate);
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return candidate;
  }
}

async function fetchWithProxy(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const requestOptions = { ...options, signal: controller.signal };
    if (!proxyAgent) {
      return await fetch(url, requestOptions);
    }
    return await undiciFetch(url, { ...requestOptions, dispatcher: proxyAgent });
  } finally {
    clearTimeout(timeout);
  }
}

function wechatHint(errcode) {
  const hints = {
    40001: ' Hint: check WECHAT_APP_ID and WECHAT_APP_SECRET.',
    40007: ' Hint: thumb_media_id is invalid; use a permanent image/thumb material media_id.',
    40113: ' Hint: image type unsupported; use standard JPG/PNG/GIF under WeChat limits.',
    40164:
      ' Hint: the runner IP is not in the WeChat Official Account IP allowlist. GitHub-hosted runners use changing outbound IPs. Set WECHAT_PROXY_URL to a fixed proxy, or use a self-hosted runner/fixed-IP server.',
    45009: ' Hint: WeChat API rate limit reached; retry later.',
  };

  return hints[errcode] ?? '';
}

function defaultCoverBlob() {
  const base64Jpeg =
    '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';
  const bytes = Uint8Array.from(Buffer.from(base64Jpeg, 'base64'));
  return new Blob([bytes], { type: 'image/jpeg' });
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanBase64(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .replace(/^data:[^;]+;base64,/, '')
    .replace(/\s+/g, '');
}

function removeEmpty(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== '' && value !== undefined && value !== null),
  );
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
