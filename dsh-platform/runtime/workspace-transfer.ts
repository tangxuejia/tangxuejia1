import type { DeviceLayer } from "../dsh-core/contracts";

export interface WorkspaceTransfer { importArchive(sourcePath:string,workspacePath:string):Promise<void>; exportArchive(workspacePath:string,targetPath:string):Promise<void>; }
export interface ArchiveBridge { extract(sourcePath:string,destinationPath:string):Promise<void>; compress(sourcePath:string,targetPath:string):Promise<void>; }

export class HuaweiWorkspaceTransfer implements WorkspaceTransfer {
  constructor(private readonly deviceLayer:DeviceLayer, private readonly archiveBridge:ArchiveBridge) {}
  async importArchive(sourcePath:string,workspacePath:string):Promise<void> {
    assertSafeArchivePath(sourcePath); assertSafeArchivePath(workspacePath);
    await this.deviceLayer.readFile(sourcePath); await this.archiveBridge.extract(sourcePath,workspacePath);
  }
  async exportArchive(workspacePath:string,targetPath:string):Promise<void> {
    assertSafeArchivePath(workspacePath); assertSafeArchivePath(targetPath);
    await this.archiveBridge.compress(workspacePath,targetPath);
  }
}
function assertSafeArchivePath(path:string):void {
  if(!path || path.includes("\\0") || path.includes("..")) throw new Error("Unsafe archive path: "+path);
}
