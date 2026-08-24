export type Platform = "openharmony" | "android" | "desktop";

export type DeviceErrorCode = "BRIDGE_UNAVAILABLE" | "PERMISSION_DENIED" | "NOT_FOUND" | "PROCESS_FAILED" | "UNSUPPORTED";

export class DeviceError extends Error {
  constructor(public readonly code: DeviceErrorCode, message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "DeviceError";
  }
}

export interface DeviceInfo { platform: Platform; model: string; osVersion: string; architecture: string; }
export interface DeviceCapabilities { filesystem: boolean; process: boolean; network: boolean; notifications: boolean; }

export interface ProcessHandle { readonly id: string; stop(): Promise<void>; isRunning(): Promise<boolean>; }

export interface DeviceLayer {
  getInfo(): Promise<DeviceInfo>;
  getCapabilities(): Promise<DeviceCapabilities>;
  openWorkspace(path: string): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  startProcess(command: string, args?: string[]): Promise<ProcessHandle>;
}

export interface DshRuntime { initialize(): Promise<void>; shutdown(): Promise<void>; getDeviceLayer(): DeviceLayer; }
