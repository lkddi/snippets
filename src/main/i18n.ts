import { app, ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'

// 系统语言：renderer 通过 window.api.getSystemLocale() 调用。
// 用 app.getLocale() 而非 renderer 的 navigator.language —— 打包后前者返回 OS 区域设置，更稳定，
// 这也是设置页「跟随系统」选项解析「系统语言」的可靠来源。
ipcMain.handle('app:locale', (_event: IpcMainInvokeEvent) => app.getLocale())
