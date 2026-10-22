import { app, ipcMain, IpcMainInvokeEvent } from 'electron'
import { config } from './db/query'
import { findWindow } from './windows'

/** 用户配置：是否隐藏程序坞图标（Dock） */
let hideDockIcon = false

const isMac = process.platform === 'darwin'

/** 设置 / 片段管理这类窗口需要完整菜单栏（Cmd+C/V、Cmd+,），打开期间必须保留 Dock 与菜单栏 */
const EDITOR_WINDOWS: WindowNameType[] = ['config', 'code']

const hasEditorWindowVisible = (): boolean =>
  EDITOR_WINDOWS.some((name) => findWindow(name)?.isVisible())

/**
 * 按配置同步 Dock 图标：
 * - 用户选择隐藏且没有编辑器窗口时，app.dock.hide()，只留菜单栏托盘
 * - 打开设置时临时 app.dock.show()，否则 accessory 模式下会丢菜单栏（输入框的
 *   Cmd+C/V 和 Cmd+, 都依赖应用菜单）
 */
const syncDock = (): void => {
  if (!isMac || !app.dock) return
  try {
    const shouldShow = !hideDockIcon || hasEditorWindowVisible()
    const visible = app.dock.isVisible()
    if (shouldShow && !visible) {
      void app.dock.show()
    } else if (!shouldShow && visible) {
      app.dock.hide()
    }
  } catch (error) {
    console.error('切换程序坞图标失败', error)
  }
}

export const applyDockIcon = (hidden: boolean): void => {
  hideDockIcon = hidden
  syncDock()
}

/** 启动时按配置生效（config 表已建好后调用） */
export const applyDockIconFromConfig = (): void => {
  applyDockIcon(Boolean(config().hideDockIcon))
}

// 窗口显示 / 隐藏 / 新建都会改变「是否需要菜单栏」，跟随同步 Dock 可见性
app.on('browser-window-focus', syncDock)
app.on('browser-window-blur', syncDock)
app.on('browser-window-created', syncDock)

ipcMain.handle('dock:get', () => ({ supported: isMac, hidden: hideDockIcon }))

ipcMain.handle('dock:set', (_event: IpcMainInvokeEvent, hidden: boolean) => {
  if (!isMac) return false
  applyDockIcon(Boolean(hidden))
  return true
})
