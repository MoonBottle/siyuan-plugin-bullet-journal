/**
 * 国际化工具函数
 */
import zhCN from './zh_CN.json';
import enUS from './en_US.json';

type Translations = typeof zhCN;

const locales: Record<string, Translations> = {
  'zh-CN': zhCN,
  'zh_CN': zhCN,
  'zh': zhCN,
  'en': enUS,
  'en-US': enUS,
  'en_US': enUS,
};

let currentLocale: Translations = zhCN;

/**
 * 初始化国际化
 */
function findLocale(lang: string): Translations | undefined {
  const normalized = lang?.toLowerCase().replace(/_/g, '-') || '';
  const normalizedAlt = normalized.replace(/-/g, '_');
  const key = Object.keys(locales).find(
    (k) =>
      k.toLowerCase().replace(/_/g, '-') === normalized ||
      k.toLowerCase().replace(/-/g, '_') === normalizedAlt
  );
  return key ? locales[key] : undefined;
}

export function initI18n(language?: string) {
  const lang = language?.toLowerCase().replace('_', '-') || 'zh-cn';
  const langAlt = lang.replace('-', '_');
  const found = findLocale(language || '');
  currentLocale = found || zhCN;

  console.log('[Bullet Journal i18n] initI18n:', {
    input: language,
    normalized: lang,
    langAlt,
    matched: !!found,
    usingLocale: currentLocale === zhCN ? 'zhCN' : 'enUS',
  });
}

/**
 * 获取翻译，支持嵌套路径如 'reminder.absoluteTime'
 */
export function t(key: string): any {
  const keys = key.split('.');
  let value: any = currentLocale;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // 找不到时返回 key 本身
    }
  }
  
  return value;
}

/**
 * 获取当前语言
 */
export function getCurrentLocale(): string {
  return Object.keys(locales).find(key => locales[key] === currentLocale) || 'zh_CN';
}

export type { Translations };
