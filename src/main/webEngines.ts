/**
 * 网页搜索引擎的内置清单与通用工具。
 * 这里只放纯数据 / 纯函数，主进程与配置默认值都引用它，避免循环依赖。
 */

/** 内置引擎：可停用但不可删除，保证默认搜索永远有可用项 */
export const DEFAULT_WEB_ENGINES: WebEngineType[] = [
  {
    id: 'baidu',
    name: '百度',
    keyword: 'bd',
    url: 'https://www.baidu.com/s?wd={query}',
    enabled: true,
    builtin: true
  },
  {
    id: 'google',
    name: 'Google',
    keyword: 'gg',
    url: 'https://www.google.com/search?q={query}',
    enabled: true,
    builtin: true
  },
  {
    id: 'bing',
    name: '必应',
    keyword: 'bing',
    url: 'https://www.bing.com/search?q={query}',
    enabled: true,
    builtin: true
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    keyword: 'ddg',
    url: 'https://duckduckgo.com/?q={query}',
    enabled: true,
    builtin: true
  },
  {
    id: 'github',
    name: 'GitHub',
    keyword: 'github',
    url: 'https://github.com/search?q={query}&type=repositories',
    enabled: true,
    builtin: true
  },
  {
    id: 'jd',
    name: '京东',
    keyword: 'jd',
    url: 'https://search.jd.com/Search?keyword={query}&enc=utf-8',
    enabled: true,
    builtin: true
  },
  {
    id: 'taobao',
    name: '淘宝',
    keyword: 'tb',
    url: 'https://s.taobao.com/search?q={query}',
    enabled: true,
    builtin: true
  },
  {
    id: 'zhihu',
    name: '知乎',
    keyword: 'zhihu',
    url: 'https://www.zhihu.com/search?type=content&q={query}',
    enabled: false,
    builtin: true
  },
  {
    id: 'bilibili',
    name: '哔哩哔哩',
    keyword: 'bili',
    url: 'https://search.bilibili.com/all?keyword={query}',
    enabled: false,
    builtin: true
  }
]

/** URL 模板里的占位符：兼容 {query} 与 {q} 两种写法 */
const PLACEHOLDER = /\{(query|q)\}/i

export const hasPlaceholder = (url: string): boolean => PLACEHOLDER.test(url)

/** 把关键词填进模板；模板缺占位符时拼在末尾，避免打开一个没有关键词的页面 */
export const buildSearchUrl = (template: string, keyword: string): string => {
  const encoded = encodeURIComponent(keyword).replace(/%20/g, '+')
  if (hasPlaceholder(template)) return template.replace(PLACEHOLDER, encoded)
  return `${template}${encoded}`
}

/**
 * 清洗配置里的引擎列表：
 * 去掉空字段、重复的关键字 / id、没有占位符的非法模板，并补齐内置标记。
 */
export const normalizeEngines = (list: unknown): WebEngineType[] => {
  if (!Array.isArray(list)) return DEFAULT_WEB_ENGINES
  const seenIds = new Set<string>()
  const seenKeywords = new Set<string>()
  const result: WebEngineType[] = []

  for (const item of list as Partial<WebEngineType>[]) {
    if (!item || typeof item.name !== 'string' || typeof item.keyword !== 'string') continue
    const name = item.name.trim()
    const keyword = item.keyword.trim().toLowerCase().replace(/\s+/g, '')
    const url = typeof item.url === 'string' ? item.url.trim() : ''
    if (!name || !keyword || !url) continue
    if (seenKeywords.has(keyword)) continue

    const id = typeof item.id === 'string' && item.id ? item.id : `custom-${keyword}`
    if (seenIds.has(id)) continue

    seenIds.add(id)
    seenKeywords.add(keyword)
    result.push({
      id,
      name,
      keyword,
      url,
      enabled: item.enabled !== false,
      builtin: DEFAULT_WEB_ENGINES.some((engine) => engine.id === id)
    })
  }

  // 全被删光时回到内置默认，保证搜索窗永远有可用的兜底入口
  return result.length ? result : DEFAULT_WEB_ENGINES
}
