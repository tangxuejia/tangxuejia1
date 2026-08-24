import { HapNativeContract } from '../bridge/HapNativeContract'

@Entry
@Component
struct Index {
  @State status: string = 'idle'

  private native?: HapNativeContract

  build() {
    Column() {
      Text('Huawei DSH')
      Text('Runtime: ' + this.status)
      Button('Start')
        .onClick(() => {
          this.status = 'ready'
        })
    }
  }
}
