type BroadcastChannelLike = {
  onmessage: ((event: MessageEvent | { data?: any }) => void) | null;
  close: () => void;
};

type RefreshChannelGuardOptions = {
  channel: BroadcastChannelLike;
  plugin: any;
  getCurrentPlugin: () => any;
  onRefresh: (payload?: Record<string, unknown>) => void | Promise<void>;
  viewName: string;
};

function getPluginInstanceId(plugin: any): string {
  return plugin?.debugInstanceId ?? 'plugin-null';
}

export function createRefreshChannelGuard(options: RefreshChannelGuardOptions) {
  let disposed = false;

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    options.channel.onmessage = null;
    options.channel.close();
  };

  const hasStalePluginInstance = () => {
    const currentPlugin = options.getCurrentPlugin();
    const capturedId = getPluginInstanceId(options.plugin);
    const currentId = getPluginInstanceId(currentPlugin);
    return capturedId !== currentId;
  };

  options.channel.onmessage = (event) => {
    const data = event?.data;

    if (hasStalePluginInstance()) {
      console.warn('[Task Assistant][ViewLifecycle] closing stale refresh channel:', {
        viewName: options.viewName,
        capturedPluginInstanceId: getPluginInstanceId(options.plugin),
        currentPluginInstanceId: getPluginInstanceId(options.getCurrentPlugin()),
      });
      dispose();
      return;
    }

    if (data?.type === 'PLUGIN_UNLOADING' && data.pluginInstanceId === getPluginInstanceId(options.plugin)) {
      console.warn('[Task Assistant][ViewLifecycle] closing refresh channel due to plugin unloading:', {
        viewName: options.viewName,
        pluginInstanceId: getPluginInstanceId(options.plugin),
      });
      dispose();
      return;
    }

    if (data?.type === 'DATA_REFRESH') {
      const { type: _type, ...rest } = data;
      options.onRefresh(Object.keys(rest).length > 0 ? rest : undefined);
    }
  };

  return {
    dispose,
    isDisposed: () => disposed,
  };
}
