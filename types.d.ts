type SqlActionType =
  | 'findAll'
  | 'findOne'
  | 'insert'
  | 'update'
  | 'del'
  | 'config'
  | 'deleteCategory'

type CategoryType = {
  id: number
  name: string
  created_at: string
}

type ContentType = {
  id: number
  title: string
  category_id: number
  content: string
  created_at: string
}

type ConfigType = {
  id: number
  content: string
}
type ConfigDataType = {
  shortCut: string
  databaseDirectory: string
  /** 'doubleOption' 为特殊值，表示连按两次 Option 唤起剪贴板；其它值按标准 accelerator 注册 */
  clipboardShortCut: string
}

type WindowNameType = 'search' | 'config' | 'code' | 'clipboard'

/** 本机已安装应用（应用启动器搜索结果） */
type AppType = {
  name: string
  path: string
  /** 图标的 dataURL，读取失败时为空字符串 */
  icon: string
}

/** 剪贴板历史记录 */
type ClipboardItemType = {
  id: number
  content: string
  created_at: string
}
