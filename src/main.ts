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

  // 参考 siyuan-plugin-task-note-management：语言存储在 window.siyuan.config.lang
  const win = window as any;
  const langFromConfig = win?.siyuan?.config?.lang;
  const language = langFromConfig || pluginInstance?.app?.i18n?.['core'] || pluginInstance?.languages?.[0] || 'zh_CN';

  console.log('[Bullet Journal i18n] main.ts init:', {
    hasSiyuan: !!win?.siyuan,
    hasConfig: !!win?.siyuan?.config,
    langFromConfig,
    appI18n: pluginInstance?.app?.i18n,
    languagesFromPlugin: pluginInstance?.languages,
    resolvedLanguage: language,
  });

  initI18n(language);
}

export function destroy() {
  plugin = null;
}

export function getEventBus() {
  return eventBus;
}

export { Events };
