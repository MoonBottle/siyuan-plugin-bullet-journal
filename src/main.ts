import { Plugin, App } from 'siyuan';
import { initI18n } from './i18n';
import { eventBus, Events } from './utils/eventBus';

let plugin: Plugin | null = null;
let appInstance: App | null = null;

export function usePlugin(pluginProps?: Plugin): Plugin | null {
  if (pluginProps) {
    plugin = pluginProps;
  }
  return plugin;
}

export function useApp(): App | null {
  return appInstance;
}

export async function init(pluginInstance: Plugin) {
  plugin = pluginInstance;
  appInstance = pluginInstance.app;

  // @ts-ignore - 思源 API
  const language = pluginInstance?.languages?.[0] || 'zh_CN';

  initI18n(language);
}

export function destroy() {
  plugin = null;
}

export function getEventBus() {
  return eventBus;
}

export { Events };
