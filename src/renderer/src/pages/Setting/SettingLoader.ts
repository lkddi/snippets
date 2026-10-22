export default async () => {
  // 配置以数据库为准（localStorage 曾被清空后会静默回落到桌面数据库）
  const row = (await window.api.sql(`select * from config where id=1`, 'findOne')) as
    | { content: string }
    | undefined

  const fallback: ConfigDataType = {
    shortCut: '',
    databaseDirectory: '',
    clipboardShortCut: 'doubleOption',
    clipboardRetentionDays: 7,
    launchAtLogin: false,
    hideDockIcon: false,
    webSearchEngine: 'baidu',
    searchDirectories: []
  }
  if (!row?.content) return fallback

  try {
    return { ...fallback, ...(JSON.parse(row.content) as Partial<ConfigDataType>) }
  } catch (error) {
    console.error('配置内容解析失败', error)
    return fallback
  }
}
