import { HapNativeContract, HapProcessHandle } from './HapNativeContract'

export class HapRuntimeSession {
  private process?: HapProcessHandle

  constructor(private readonly native: HapNativeContract) {}

  async start(argv: string[]): Promise<string> {
    if (this.process && await this.process.isRunning()) {
      return this.process.id
    }
    this.process = await this.native.startEmbeddedNode(argv)
    return this.process.id
  }

  async stop(): Promise<void> {
    if (!this.process) {
      return
    }
    await this.process.stop()
    this.process = undefined
  }

  async restart(argv: string[]): Promise<string> {
    await this.stop()
    return this.start(argv)
  }
}
