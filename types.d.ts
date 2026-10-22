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
  /** 剪贴板记录保存天数，0 表示永久保留 */
  clipboardRetentionDays: number
  /** 是否开机启动（真实状态以系统登录项为准，此值用于设置页回显） */
  launchAtLogin: boolean
  /** 是否隐藏程序坞（Dock）图标，隐藏后只驻留菜单栏 */
  hideDockIcon: boolean
  /** 网页搜索使用的搜索引擎（baidu/google/bing/duckduckgo） */
  webSearchEngine: string
  /** 文件搜索允许扫描的目录，支持多个 */
  searchDirectories: string[]
}

/** 文件搜索结果 */
type FileType = {
  name: string
  path: string
  /** 目录或文件，目录在 Finder 中打开，文件用默认应用打开 */
  isDir: boolean
}

/** 网页搜索兜底项：当前关键词 + 使用的搜索引擎 */
type WebSearchType = {
  engine: string
  query: string
}

type WindowNameType = 'search' | 'config' | 'code' | 'clipboard'

/** 本机已安装应用（应用启动器搜索结果） */
type AppType = {
  name: string
  path: string
  /** 图标的 dataURL，读取失败时为空字符串 */
  icon: string
  /** 拼音全拼（无声调），无中文名的中文名应用用于副标题展示 */
  pinyin?: string
  /** 本地化中文名（如 WeChat -> 微信），与文件名不同时用于副标题展示 */
  alias?: string
}

/** 剪贴板历史记录 */
type ClipboardItemType = {
  id: number
  content: string
  created_at: string
}
