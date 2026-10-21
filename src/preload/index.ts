import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  shortCut: (shortCut: string) => {
    return ipcRenderer.invoke('shortCut', shortCut)
  },
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => {
    ipcRenderer.send('setIgnoreMouseEvents', ignore, options)
  },
  sql: (sql: string, type: SqlActionType, params = {}) => {
    return ipcRenderer.invoke('sql', sql, type, params)
  },
  openWindow: (name: WindowNameType) => {
    ipcRenderer.send('openWindow', name)
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
  // 开机启动设置（读取 / 切换系统登录项）
  getLoginItemSettings: () => {
    return ipcRenderer.invoke('loginItem:get') as Promise<boolean>
  },
  setLoginItemSettings: (enabled: boolean) => {
    return ipcRenderer.invoke('loginItem:set', enabled) as Promise<boolean>
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
