import { ipcMain, IpcMainEvent } from 'electron'
import { getByNameWindow, getWindowByEvent, showAndFocus } from './windows'

/**
 * name 为目标窗口；hash 可选，用于把设置窗直接定位到某个分区
 * （例如托盘「代码片段」→ /#config/snippets）。
 */
ipcMain.on('openWindow', (_event: IpcMainEvent, name: WindowNameType, hash?: string) => {
  const win = showAndFocus(name)
  if (hash && win) {
    // HashRouter 直接改 hash 即可跳转，无需额外的消息通道
    void win.webContents.executeJavaScript(`window.location.hash = ${JSON.stringify(hash)}`)
  }
})

ipcMain.on('closeWindow', (_event: IpcMainEvent, name: WindowNameType) => {
  getByNameWindow(name).hide()
})

ipcMain.on(
  'setIgnoreMouseEvents',
  (event: IpcMainEvent, ignore: boolean, options?: { forward: boolean }) => {
    // 窗口可能在 IPC 到达前已被销毁
    getWindowByEvent(event)?.setIgnoreMouseEvents(ignore, options)
  }
)
