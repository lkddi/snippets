export default async () => {
  // 配置以数据库为准（localStorage 曾被清空后会静默回落到桌面数据库）
  const row = (await window.api.sql(`select * from config where id=1`, 'findOne')) as
    | { content: string }
    | undefined

  // 老版本配置里没有 webEngines，用主进程的内置清单兜底
  const defaultEngines = await window.api.listWebEngines()

  const fallback: ConfigDataType = {
    shortCut: '',
    databaseDirectory: '',
    clipboardShortCut: 'doubleOption',
    clipboardRetentionDays: 7,
    launchAtLogin: false,
    hideDockIcon: false,
    webSearchEngine: 'baidu',
    webEngines: defaultEngines,
    searchDirectories: [],
    appShortCuts: []
  }
  if (!row?.content) return fallback

  try {
    const parsed = JSON.parse(row.content) as Partial<ConfigDataType>
    return {
      ...fallback,
      ...parsed,
      webEngines: Array.isArray(parsed.webEngines) && parsed.webEngines.length
        ? parsed.webEngines
        : defaultEngines
    }
  } catch (error) {
    console.error('配置内容解析失败', error)
    return fallback
  }
}
