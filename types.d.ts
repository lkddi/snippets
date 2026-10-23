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
  /** 网页搜索使用的默认搜索引擎 id（对应 webEngines 里的引擎） */
  webSearchEngine: string
  /** 网页搜索引擎列表：内置的（百度/GitHub/京东…）+ 用户自定义，可单独停用 */
  webEngines: WebEngineType[]
  /** 文件搜索允许扫描的目录，支持多个 */
  searchDirectories: string[]
  /** 按应用绑定的全局快捷键（启动 / 隐藏切换） */
  appShortCuts: AppShortcutType[]
  /** 界面语言：'system' 跟随系统（解析为系统语言，未支持回落英文），或显式指定中文 / 英文 */
  language?: 'system' | 'zh-CN' | 'en'
}

/** 单个应用的全局快捷键绑定 */
type AppShortcutType = {
  /** .app 包路径，作为唯一标识 */
  path: string
  name: string
  /** 本地化中文名（与文件名不同时展示） */
  alias?: string
  /** CFBundleIdentifier，用于判断应用是否在前台并隐藏它 */
  bundleId: string
  /** Electron accelerator，如 Command+Shift+W */
  accelerator: string
}

/** 设置页「添加应用」用的应用条目（不含图标，按需单独取） */
type AppInfoType = {
  name: string
  path: string
  alias?: string
  bundleId: string
}

/** 快捷键占用检查结果 */
type ShortCutCheckType = {
  available: boolean
  error: string
}

/** 应用快捷键条目 + 实际注册状态（配置里存的是绑定，状态是运行时算出来的） */
type AppShortcutStateType = AppShortcutType & {
  registered: boolean
  error: string
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
  /** 引擎显示名，用于「用 GitHub 搜索「xxx」」这行文案 */
  engineName?: string
  query: string
}

/** 一个网页搜索引擎：关键字 + URL 模板，命中关键字时用它搜索 */
type WebEngineType = {
  id: string
  name: string
  /** 触发关键字，如 github；搜索框里输入「github 关键词」即用该引擎 */
  keyword: string
  /** 搜索地址，{query} 会被替换为 URL 编码后的关键词 */
  url: string
  enabled: boolean
  /** 内置引擎不可删除，只能停用 */
  builtin?: boolean
}

type WindowNameType = 'search' | 'config' | 'code' | 'clipboard'

/** 全局快捷键的当前生效状态，设置页据此显示「已生效 / 未生效」 */
type ShortCutStatusType = {
  /** 当前已注册的 accelerator，空字符串表示没有设置 */
  accelerator: string
  /** 是否真的注册成功（被系统/其它应用占用时为 false） */
  registered: boolean
  /** 最近一次注册失败的原因，注册成功时为空 */
  error: string
}

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

/** 说明页信息：当前版本 / GitHub 最新版本与下载地址 / 作者信息 */
type AboutInfoType = {
  currentVersion: string
  latestVersion: string
  releaseUrl: string
  hasUpdate: boolean
  /** GitHub 拉取失败（网络不通 / 限流），此时只能展示当前版本 */
  fetchFailed: boolean
  author: { name: string; blog: string; repo: string }
}
