export function buildViewDebugContext(viewName: string, plugin?: any) {
  return {
    viewName,
    pluginInstanceId: plugin?.debugInstanceId ?? 'plugin-null',
    pluginAvailable: Boolean(plugin),
    location: location.href,
  };
}
