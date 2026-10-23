import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { resolveSystemLocale, type LanguageKey, type ResolvedLocale } from './types'

interface I18nState {
  /** 用户选择的语言；'system' 表示跟随系统 */
  locale: LanguageKey
  /** 系统实际语言，应用启动时通过主进程 app.getLocale() 异步填充（localStorage 缓存） */
  systemLocale: ResolvedLocale
  setLocale: (l: LanguageKey) => void
  setSystemLocale: (l: string) => void
  /** 解析后的实际生效语言：'system' 展开为 systemLocale，否则即用户选择 */
  effectiveLocale: () => ResolvedLocale
}

/**
 * 语言状态缓存层：
 * - 与 config 表（语言设置的主源）解耦，保证任意页面（搜索窗 / 剪贴板等设置路由之外）都能即时读取；
 * - 设置页保存时同步写 config 表（主源）+ 这里（立即生效）；
 * - 持久化到 localStorage 仅作离线缓存，启动时仍会用主进程返回的系统语言刷新 systemLocale。
 */
export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: 'system',
      systemLocale: 'en',
      setLocale: (l) => set({ locale: l }),
      setSystemLocale: (l) => set({ systemLocale: resolveSystemLocale(l) }),
      effectiveLocale: () => {
        const { locale, systemLocale } = get()
        return locale === 'system' ? systemLocale : locale
      }
    }),
    {
      name: 'lingxi-i18n',
      storage: createJSONStorage(() => localStorage)
    }
  )
)
