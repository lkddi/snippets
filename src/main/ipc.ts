import { ipcMain, IpcMainEvent } from 'electron'
import { getByNameWindow, getWindowByEvent, showAndFocus } from './windows'

ipcMain.on('openWindow', (_event: IpcMainEvent, name: WindowNameType) => {
  showAndFocus(name)
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
