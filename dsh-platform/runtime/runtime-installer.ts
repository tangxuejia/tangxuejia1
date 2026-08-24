import { DeviceError } from "../dsh-core/contracts";

export interface RuntimeInstallHost {
  readVersionStamp(runtimeRoot:string):Promise<string|undefined>;
  extract(sourceZip:string,stagingRoot:string):Promise<void>;
  replaceDirectory(stagingRoot:string,runtimeRoot:string):Promise<void>;
  writeVersionStamp(runtimeRoot:string,version:string):Promise<void>;
}
export class RuntimeInstaller {
  constructor(private readonly host:RuntimeInstallHost) {}
  async install(sourceZip:string,runtimeRoot:string,version:string):Promise<"skipped"|"installed"> {
    if(await this.host.readVersionStamp(runtimeRoot)===version) return "skipped";
    const stagingRoot=runtimeRoot+".staging-"+version.replace(/[^a-zA-Z0-9._-]/g,"_");
    try {
      await this.host.extract(sourceZip,stagingRoot);
      await this.host.replaceDirectory(stagingRoot,runtimeRoot);
      await this.host.writeVersionStamp(runtimeRoot,version);
      return "installed";
    } catch(error) { throw new DeviceError("PROCESS_FAILED","Runtime installation failed for "+version,error); }
  }
}
