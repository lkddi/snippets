import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      shortCut: (shortCut: string) => Promise<boolean>
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void
      sql: <T>(sql: string, type: SqlActionType, params?: Record<string, any>) => Promise<T>
      openWindow: (name: WindowNameType) => void
      closeWindow: (name: WindowNameType) => void
      selectDatabaseDirectory: () => Promise<string>
      setDatabaseDirectory: (path: string) => void
      initTable: () => void
      /** 搜索本机已安装应用，按相关度返回前 8 条 */
      searchApps: (keyword: string) => Promise<AppType[]>
      /** 启动应用，成功后主进程会自动收起搜索窗 */
      openApp: (path: string) => Promise<boolean>
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
      /** 监听剪贴板更新事件，返回取消订阅函数 */
      onClipboardUpdated: (callback: () => void) => () => void
    }
  }
}

// window.api.sql<number>("select * from xxxx").then(r=>{
//   typeof r  number
// })
