import 'siyuan'

declare module 'siyuan' {
  interface IEventBusMap {
    'kernel-plugin-state-change': { code: number, description: string }
  }
}
