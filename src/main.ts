import {
  App,
  Plugin,
} from 'siyuan'
import { initI18n } from './i18n'
import {
  eventBus,
  Events,
} from './utils/eventBus'

let plugin: Plugin | null = null
let appInstance: App | null = null

export function usePlugin(pluginProps?: Plugin): Plugin | null {
  if (pluginProps) {
    plugin = pluginProps
  }
  return plugin
}

export function useApp(): App | null {
  return appInstance
}

export function getCurrentPlugin(): Plugin | null {
  return plugin
}

export async function init(pluginInstance: Plugin) {
  plugin = pluginInstance
  appInstance = pluginInstance.app

  const win = window as any
  const langFromConfig = win?.siyuan?.config?.lang
  const appWithI18n = pluginInstance.app as typeof pluginInstance.app & { i18n?: Record<string, string> }
  const pluginWithLangs = pluginInstance as Plugin & { languages?: string[] }
  const language = langFromConfig || appWithI18n?.i18n?.core || pluginWithLangs?.languages?.[0] || 'zh-CN'

  console.log('[Bullet Journal i18n] main.ts init:', {
    hasSiyuan: !!win?.siyuan,
    hasConfig: !!win?.siyuan?.config,
    langFromConfig,
    appI18n: appWithI18n?.i18n,
    languagesFromPlugin: pluginWithLangs?.languages,
    resolvedLanguage: language,
  })

  initI18n(language)
}

export function destroy() {
  plugin = null
}

export function getEventBus() {
  return eventBus
}

export { Events }
