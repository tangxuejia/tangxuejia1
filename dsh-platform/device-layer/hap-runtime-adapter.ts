import type { ProcessHandle } from "../dsh-core/contracts";

export interface HapRuntimeCallbacks {
  installRuntime(runtimeZipPath: string, runtimeRoot: string, version: string): Promise<void>;
  startEmbeddedNode(argv: string[]): Promise<ProcessHandle>;
}
export interface RuntimeHostAdapter {
  install(runtimeZipPath: string, runtimeRoot: string, version: string): Promise<void>;
  startNode(argv: string[]): Promise<ProcessHandle>;
}
export class HapRuntimeAdapter implements RuntimeHostAdapter {
  constructor(private readonly native: HapRuntimeCallbacks) {}
  install(runtimeZipPath: string, runtimeRoot: string, version: string) { return this.native.installRuntime(runtimeZipPath,runtimeRoot,version); }
  startNode(argv: string[]) { return this.native.startEmbeddedNode(argv); }
}
