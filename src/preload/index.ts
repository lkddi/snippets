import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  shortCut: (shortCut: string) => {
    return ipcRenderer.invoke('shortCut', shortCut)
  },
  /** 查询快捷键真实生效状态（注册失败时设置页会红字提示） */
  getShortCutStatus: () => {
    return ipcRenderer.invoke('shortCut:status') as Promise<ShortCutStatusType>
  },
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => {
    ipcRenderer.send('setIgnoreMouseEvents', ignore, options)
  },
  sql: (sql: string, type: SqlActionType, params = {}) => {
    return ipcRenderer.invoke('sql', sql, type, params)
  },
  openWindow: (name: WindowNameType, hash?: string) => {
    ipcRenderer.send('openWindow', name, hash)
  },
  closeWindow: (name: WindowNameType) => {
    ipcRenderer.send('closeWindow', name)
  },
  selectDatabaseDirectory: () => {
    return ipcRenderer.invoke('selectDatabaseDirectory')
  },
  setDatabaseDirectory: (path: string) => {
    ipcRenderer.send('setDatabaseDirectory', path)
  },
  initTable: () => {
    ipcRenderer.send('initTable')
  },
  // 应用启动器：搜索本机已安装应用 / 启动应用
  searchApps: (keyword: string) => {
    return ipcRenderer.invoke('apps:search', keyword)
  },
  openApp: (path: string) => {
    return ipcRenderer.invoke('apps:open', path)
  },
  /** 全部已安装应用（设置页「添加应用」用，不含图标） */
  listApps: () => {
    return ipcRenderer.invoke('apps:all') as Promise<AppInfoType[]>
  },
  /** 单个应用图标 dataURL */
  getAppIcon: (path: string) => {
    return ipcRenderer.invoke('apps:icon', path) as Promise<string>
  },
  // 按应用绑定的全局快捷键
  checkAppShortCut: (accelerator: string, selfPath = '') => {
    return ipcRenderer.invoke('appShortCut:check', accelerator, selfPath) as Promise<ShortCutCheckType>
  },
  listAppShortCuts: () => {
    return ipcRenderer.invoke('appShortCut:list') as Promise<AppShortcutStateType[]>
  },
  setAppShortCut: (entry: AppShortcutType) => {
    return ipcRenderer.invoke('appShortCut:set', entry) as Promise<{ ok: boolean; error: string }>
  },
  removeAppShortCut: (path: string) => {
    return ipcRenderer.invoke('appShortCut:remove', path) as Promise<boolean>
  },
  // 文件搜索：搜索配置目录 / 打开结果 / 选择目录 / 清缓存
  searchFiles: (keyword: string) => {
    return ipcRenderer.invoke('files:search', keyword)
  },
  openFile: (path: string) => {
    return ipcRenderer.invoke('files:open', path)
  },
  selectSearchDirectory: () => {
    return ipcRenderer.invoke('files:selectDir')
  },
  invalidateFiles: () => {
    ipcRenderer.send('files:invalidate')
  },
  // 网页搜索兜底：解析「关键字 + 关键词」用哪个引擎，以及打开搜索
  resolveWebSearch: (query: string) => {
    return ipcRenderer.invoke('web:resolve', query) as Promise<{
      engine: string
      engineName: string
      query: string
    }>
  },
  listWebEngines: () => {
    return ipcRenderer.invoke('web:engines') as Promise<WebEngineType[]>
  },
  openWebSearch: (engine: string, query: string) => {
    return ipcRenderer.invoke('web:open', engine, query)
  },
  // 剪贴板历史
  clipboardList: (keyword = '') => {
    return ipcRenderer.invoke('clipboard:list', keyword)
  },
  clipboardDelete: (id: number) => {
    return ipcRenderer.invoke('clipboard:delete', id)
  },
  clipboardClear: () => {
    return ipcRenderer.invoke('clipboard:clear')
  },
  clipboardPaste: (id: number) => {
    return ipcRenderer.invoke('clipboard:paste', id)
  },
  clipboardShortCut: (shortCut: string) => {
    return ipcRenderer.invoke('clipboardShortCut', shortCut)
  },
  /** 搜索窗选中片段：写回剪贴板并自动粘贴到唤起前的光标处（同剪贴板面板） */
  pasteSnippet: (content: string) => {
    return ipcRenderer.invoke('snippet:paste', content) as Promise<boolean>
  },
  // 开机启动设置（读取 / 切换系统登录项）
  getLoginItemSettings: () => {
    return ipcRenderer.invoke('loginItem:get') as Promise<boolean>
  },
  setLoginItemSettings: (enabled: boolean) => {
    return ipcRenderer.invoke('loginItem:set', enabled) as Promise<boolean>
  },
  // 程序坞图标显示 / 隐藏（macOS）
  getDockIconSettings: () => {
    return ipcRenderer.invoke('dock:get') as Promise<{ supported: boolean; hidden: boolean }>
  },
  setDockIconHidden: (hidden: boolean) => {
    return ipcRenderer.invoke('dock:set', hidden) as Promise<boolean>
  },
  // 监听剪贴板更新，返回取消订阅函数供 React effect 清理
  onClipboardUpdated: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('clipboard:updated', listener)
    return (): void => {
      ipcRenderer.removeListener('clipboard:updated', listener)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
