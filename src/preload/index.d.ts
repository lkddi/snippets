import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      shortCut: (shortCut: string) => Promise<boolean>
      /** 查询快捷键真实生效状态（注册失败时设置页会红字提示） */
      getShortCutStatus: () => Promise<ShortCutStatusType>
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void
      sql: <T>(sql: string, type: SqlActionType, params?: Record<string, any>) => Promise<T>
      openWindow: (name: WindowNameType, hash?: string) => void
      closeWindow: (name: WindowNameType) => void
      selectDatabaseDirectory: () => Promise<string>
      setDatabaseDirectory: (path: string) => void
      initTable: () => void
      /** 搜索本机已安装应用，按相关度返回前 8 条 */
      searchApps: (keyword: string) => Promise<AppType[]>
      /** 启动应用，成功后主进程会自动收起搜索窗 */
      openApp: (path: string) => Promise<boolean>
      /** 全部已安装应用（不含图标），供设置页「添加应用」本地过滤 */
      listApps: () => Promise<AppInfoType[]>
      /** 单个应用图标 dataURL，读不到返回空字符串 */
      getAppIcon: (path: string) => Promise<string>
      /** 检查快捷键是否被占用（应用内绑定 / 搜索 / 剪贴板 / 系统） */
      checkAppShortCut: (accelerator: string, selfPath?: string) => Promise<ShortCutCheckType>
      /** 应用快捷键列表（含实际注册状态） */
      listAppShortCuts: () => Promise<AppShortcutStateType[]>
      /** 保存并注册单个应用的快捷键 */
      setAppShortCut: (entry: AppShortcutType) => Promise<{ ok: boolean; error: string }>
      /** 移除某个应用的快捷键绑定 */
      removeAppShortCut: (path: string) => Promise<boolean>
      /** 搜索配置目录下的文件（目录列表在设置里维护），按相关度返回前 6 条 */
      searchFiles: (keyword: string) => Promise<FileType[]>
      /** 打开文件 / 文件夹，成功后主进程会自动收起搜索窗 */
      openFile: (path: string) => Promise<boolean>
      /** 弹出系统目录选择框，返回选中路径（取消返回空串） */
      selectSearchDirectory: () => Promise<string>
      /** 目录配置变化后通知主进程重建文件扫描缓存 */
      invalidateFiles: () => void
      /** 解析搜索词该用哪个引擎（命中「关键字 关键词」时切引擎） */
      resolveWebSearch: (query: string) => Promise<{
        engine: string
        engineName: string
        query: string
      }>
      /** 全部网页搜索引擎（含停用项） */
      listWebEngines: () => Promise<WebEngineType[]>
      /** 用指定搜索引擎打开网页搜索 */
      openWebSearch: (engine: string, query: string) => Promise<boolean>
      /** 剪贴板历史：keyword 为空返回最近 50 条，非空按 like 过滤 */
      clipboardList: (keyword?: string) => Promise<ClipboardItemType[]>
      clipboardDelete: (id: number) => Promise<number>
      clipboardClear: () => Promise<number>
      /** 复制指定记录到剪贴板并尝试自动粘贴（osascript），然后隐藏窗口 */
      clipboardPaste: (id: number) => Promise<boolean>
      /** 保存剪贴板快捷键（'doubleOption' 表示双击 Option 模式，直接视为成功） */
      clipboardShortCut: (shortCut: string) => Promise<boolean>
      /** 读取系统登录项：当前是否开机启动 */
      getLoginItemSettings: () => Promise<boolean>
      /** 切换开机启动，返回是否设置成功 */
      setLoginItemSettings: (enabled: boolean) => Promise<boolean>
      /** 读取程序坞图标设置：supported 为当前平台是否支持，hidden 为是否为隐藏 */
      getDockIconSettings: () => Promise<{ supported: boolean; hidden: boolean }>
      /** 隐藏 / 显示程序坞图标，返回是否生效 */
      setDockIconHidden: (hidden: boolean) => Promise<boolean>
      /** 监听剪贴板更新事件，返回取消订阅函数 */
      onClipboardUpdated: (callback: () => void) => () => void
    }
  }
}

// window.api.sql<number>("select * from xxxx").then(r=>{
//   typeof r  number
// })
