/** 用户可选的语言；'system' 表示跟随系统 */
export type LanguageKey = 'system' | 'zh-CN' | 'zh-TW' | 'en'

/** 解析后的实际生效语言（'system' 已展开为具体语言） */
export type ResolvedLocale = 'zh-CN' | 'zh-TW' | 'en'

/** 受支持的具体语言列表；新增语言只需在此登记 + 增加对应 locales 文件 */
export const SUPPORTED_LANGUAGES: { key: Exclude<LanguageKey, 'system'>; label: string }[] = [
  { key: 'zh-CN', label: '简体中文' },
  { key: 'zh-TW', label: '繁體中文' },
  { key: 'en', label: 'English' }
]

/**
 * 把系统 locale（如 zh-CN / zh-Hant-TW / en-US）映射为受支持的语言。
 * 繁体地区（TW / HK / MO / Hant）→ 繁体中文，其余中文 → 简体中文；
 * 未支持的语言一律回落英文（按需求：默认使用系统语言，没有则默认英文）。
 */
export function resolveSystemLocale(sysLocale?: string | null): ResolvedLocale {
  if (!sysLocale) return 'en'
  const l = sysLocale.toLowerCase()
  if (l.startsWith('zh')) {
    if (l.includes('hant') || l.startsWith('zh-tw') || l.startsWith('zh-hk') || l.startsWith('zh-mo')) {
      return 'zh-TW'
    }
    return 'zh-CN'
  }
  if (l.startsWith('en')) return 'en'
  return 'en'
}
