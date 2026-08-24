import type { Platform } from "../dsh-core/contracts";

export interface HarnessConfig {
  platform: Platform;
  architecture: "arm64-v8a" | "x86_64";
  nodeBinary: string;
  entryFile: string;
  workspace: string;
  host: string;
  port: number;
  nodeArgs?: string[];
  environment?: Record<string, string>;
}

export function createHuaweiHarnessConfig(overrides: Partial<HarnessConfig> = {}): HarnessConfig {
  return {
    platform: "openharmony",
    architecture: "arm64-v8a",
    nodeBinary: "/data/storage/el2/base/haps/entry/files/node/bin/node",
    entryFile: "/data/storage/el2/base/haps/entry/files/harness/server.js",
    workspace: "/data/storage/el2/base/haps/entry/files/workspace",
    host: "127.0.0.1",
    port: 3080,
    ...overrides,
  };
}

export function buildHarnessLaunchPlan(config: HarnessConfig) {
  if (!config.nodeBinary.trim() || !config.entryFile.trim() || !config.workspace.trim()) throw new Error("Harness paths are required");
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error("Invalid Harness port");
  return { command: config.nodeBinary, args: [config.entryFile, ...(config.nodeArgs ?? []), "--host", config.host, "--port", String(config.port)], cwd: config.workspace, host: config.host, port: config.port };
}

export function getHarnessUrl(config: HarnessConfig): string { return "http://" + config.host + ":" + config.port + "/"; }
