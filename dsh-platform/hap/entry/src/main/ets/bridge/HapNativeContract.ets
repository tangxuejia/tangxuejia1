export interface HapDeviceInfo {
  platform: 'openharmony'
  model: string
  osVersion: string
  architecture: string
}

export interface HapCapabilities {
  filesystem: boolean
  process: boolean
  network: boolean
  notifications: boolean
}

export interface HapProcessHandle {
  id: string
  stop(): Promise<void>
  isRunning(): Promise<boolean>
}

export interface HapNativeContract {
  getDeviceInfo(): Promise<HapDeviceInfo>
  getDeviceCapabilities(): Promise<HapCapabilities>
  openWorkspace(path: string): Promise<void>
  readSandboxFile(path: string): Promise<Uint8Array>
  writeSandboxFile(path: string, data: Uint8Array): Promise<void>
  spawnLocalProcess(command: string, args: string[]): Promise<HapProcessHandle>
  extractZip(sourcePath: string, destinationPath: string): Promise<void>
  createZip(sourcePath: string, targetPath: string): Promise<void>
  installRuntime(runtimeZipPath: string, runtimeRoot: string, version: string): Promise<void>
  startEmbeddedNode(argv: string[]): Promise<HapProcessHandle>
  stopEmbeddedNode(processId: string): Promise<void>
}
