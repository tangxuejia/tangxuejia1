import { HapNativeContract } from './HapNativeContract'

export class HapNodeRuntimeLoader {
  constructor(private readonly native: HapNativeContract) {}

  async start(argv: string[]): Promise<string> {
    const process = await this.native.startEmbeddedNode(argv)
    if (!process.id) {
      throw new Error('OpenHarmony Node Runtime returned no process id')
    }
    return process.id
  }

  async stop(processId: string): Promise<void> {
    if (!processId) {
      return
    }
    await this.native.stopEmbeddedNode(processId)
  }
}
