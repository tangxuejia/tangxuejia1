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
  const article = await loadArticle(articlePath);
  const articlePayload = normalizeArticle(article);

  if (dryRun) {
    console.log('dry_run_ok');
    console.log(`article_file=${articlePath}`);
    console.log(`title=${articlePayload.title}`);
    console.log(`content_chars=${articlePayload.content.length}`);
    console.log(`needs_cover=${articlePayload.thumb_media_id ? 'no' : 'yes'}`);
    return;
  }

  const appId = requireEnv('WECHAT_APP_ID');
  const appSecret = requireEnv('WECHAT_APP_SECRET');
  proxyAgent = createProxyAgent();

  if (proxyAgent) {
    console.log('wechat_proxy=enabled');
  }

  const accessToken = await getAccessToken(appId, appSecret);
  const thumbMediaId =
    articlePayload.thumb_media_id ||
    process.env.WECHAT_THUMB_MEDIA_ID ||
    (await uploadDefaultThumb(accessToken));

  const draft = await addDraft(accessToken, {
    ...articlePayload,
    thumb_media_id: thumbMediaId,
  });

  console.log(`draft_media_id=${draft.media_id}`);
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
      body: JSON.stringify({ articles: [article] }),
    },
    'add_draft',
  );

  if (!data.media_id) {
    throw new Error(`WeChat did not return draft media_id: ${JSON.stringify(data)}`);
  }

  return data;
}

async function requestJson(url, options, label) {
  const response = await fetchWithProxy(url, options);
  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON response (${response.status}): ${text.slice(0, 300)}`);
  }

  if (!response.ok) {
    throw new Error(`${label} HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  if (data.errcode && data.errcode !== 0) {
    throw new Error(`${label} WeChat error ${data.errcode}: ${data.errmsg}${wechatHint(data.errcode)}`);
  }

  return data;
}

function createProxyAgent() {
  const proxyUrl = cleanText(process.env.WECHAT_PROXY_URL);

  if (!proxyUrl) {
    return null;
  }

  try {
    new URL(proxyUrl);
  } catch (error) {
    throw new Error(`Invalid WECHAT_PROXY_URL: ${error.message}`);
  }

  return new ProxyAgent(proxyUrl);
}

async function fetchWithProxy(url, options) {
  if (!proxyAgent) {
    return fetch(url, options);
  }

  return undiciFetch(url, { ...options, dispatcher: proxyAgent });
}

function wechatHint(errcode) {
  const hints = {
    40001: ' Hint: check WECHAT_APP_ID and WECHAT_APP_SECRET.',
    40007: ' Hint: thumb_media_id is invalid; use a permanent image/thumb material media_id.',
    40164:
      ' Hint: the runner IP is not in the WeChat Official Account IP allowlist. GitHub-hosted runners use changing outbound IPs. Set WECHAT_PROXY_URL to a fixed proxy, or use a self-hosted runner/fixed-IP server.',
    45009: ' Hint: WeChat API rate limit reached; retry later.',
  };

  return hints[errcode] ?? '';
}

function defaultCoverBlob() {
  const base64Jpeg =
    '/9j/4AAQSkZJRgABAQAAAAAAAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAEsASwDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAIH/8QAFhABAQEAAAAAAAAAAAAAAAAAABES/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAEC/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A12lRStsrpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoIpU0qoqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgilRSqi6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKCaVFKqLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoIpU0qoqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgilTSqKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oI0aRSqi9GkUoL0aRSgvRpFKC9GkUoL0aRSgvRpFKC9GkUoL0aRSgvRpFKC9GkUoL0aRSgvRpFKC9GkUoL0aRSgvRpFKC9GkUoL0aRSgvRpFKCKVNKqKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oIpU0qoqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgilRSqi6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKCKVNKoqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgilTSqiqVNKCqVNKCqVNKCqVNKCqVNKCqVNKCqVNKCqVNKCqVNKCqVNKCqVNKCqVNKCqVNKCqVNKCqVNKCqVNKCqVNKCqVNKCKVFKIulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgilTStIqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgqlTSgilRSiLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoLpUUoJpUUqi6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKC6VFKCKVNKqKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oKpU0oIpUUqoulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgulRSgmlSKiqVICqVICqVICqVICqVICqVICqVICqVICqVICqVICqVICqVICqVICqVICqVICqVICqVICqVID/9k=';
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
