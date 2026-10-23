import zhCN from './locales/zh-CN'
import en from './locales/en'
import { useI18nStore } from './useI18nStore'
import type { ResolvedLocale } from './types'

export type { LanguageKey, ResolvedLocale } from './types'
export { SUPPORTED_LANGUAGES, resolveSystemLocale } from './types'
export { useI18nStore } from './useI18nStore'

/** 全部语言资源；新增语言在此加一项 + 新增 locales/xx.ts */
export const resources = {
  'zh-CN': zhCN,
  en
} as const

type Dict = Record<string, unknown>

/** 按点路径（a.b.c）从嵌套字典取值 */
function lookup(dict: Dict, path: string): string | undefined {
  return path.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[k]
    return undefined
  }, dict) as string | undefined
}

/**
 * 翻译函数：
 * - 优先取目标语言；
 * - 目标语言缺失时回退源语言（zh-CN），避免界面出现空白；
 * - 仍缺失则返回 key 本身，绝不抛错。
 * 支持 {name} 形式的占位符插值。
 */
export function translate(key: string, lang: ResolvedLocale, params?: Record<string, string | number>): string {
  const dict = resources[lang] as Dict
  let val = lookup(dict, key)
  if (val == null && lang !== 'zh-CN') val = lookup(resources['zh-CN'] as Dict, key)
  if (val == null) return key
  if (params) {
    return val.replace(/\{(\w+)\}/g, (_, p: string) => (params[p] != null ? String(params[p]) : `{${p}}`))
  }
  return val
}

/**
 * 组件内翻译 hook：自动订阅 locale / systemLocale 变化触发重渲染。
 * 用法：const t = useT(); return <span>{t('setting.general.launchAtLogin.label')}</span>
 */
export function useT(): (key: string, params?: Record<string, string | number>) => string {
  const locale = useI18nStore((s) => s.locale)
  const systemLocale = useI18nStore((s) => s.systemLocale)
  return (key: string, params?: Record<string, string | number>) => {
    const eff: ResolvedLocale = locale === 'system' ? systemLocale : locale
    return translate(key, eff, params)
  }
}
