import { Plugin, App } from 'siyuan';
import { initI18n } from './i18n';
import { eventBus, Events } from './utils/eventBus';

let plugin: Plugin | null = null;
let appInstance: App | null = null;

/**
 * 获取插件实例
 */
export function usePlugin(pluginProps?: Plugin): Plugin | null {
  if (pluginProps) {
    plugin = pluginProps;
  }
  return plugin;
}

/**
 * 获取 App 实例
 */
export function useApp(): App | null {
  return appInstance;
}

/**
 * 初始化插件（轻量级初始化，不依赖 Vue/Pinia）
 */
export async function init(pluginInstance: Plugin) {
  plugin = pluginInstance;
  appInstance = pluginInstance.app;

  // 初始化国际化
  // @ts-ignore - 思源 API
  const language = pluginInstance?.languages?.[0] || 'zh_CN';

  initI18n(language);
}

/**
 * 销毁插件
 */
export function destroy() {
  plugin = null;
}

/**
 * 获取刷新事件总线
 */
export function getEventBus() {
  return eventBus;
}

export { Events };
