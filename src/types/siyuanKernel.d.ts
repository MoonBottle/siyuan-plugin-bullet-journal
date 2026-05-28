type TKernelPluginState = -1 | 0 | 1 | 2 | 3 | 4 | 5

interface IKernelPluginState {
  code: TKernelPluginState
  description: string
}

interface IKernelPluginRpc {
  call: Record<string, (...args: any[]) => Promise<any>>
  notify: Record<string, (...args: any[]) => void>
  bind: (method: string, handler: (...args: any[]) => void | Promise<void>) => void
  unbind: (method: string, handler: (...args: any[]) => void | Promise<void>) => void
}

interface IKernelPlugin {
  state: IKernelPluginState
  rpc: IKernelPluginRpc
}

declare module 'siyuan' {
  interface Plugin {
    kernel?: IKernelPlugin
  }
}
