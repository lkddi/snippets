import { BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import { createWindow, OptionsType } from './createWindow'

interface WindowConfig {
  id: number
  options: OptionsType
}

const windows: Record<WindowNameType, WindowConfig> = {
  search: {
    id: 0,
    options: {
      // 启动器类应用：启动后只驻留托盘，快捷键唤起时才显示
      initShow: false,
      hash: '',
      openDevTools: true,
      width: 500,
      height: 350,
      // 热键唤起后要浮在其他应用之上，否则会被挡在后面
      alwaysOnTop: true
    }
  },
  code: {
    id: 0,
    options: {
      initShow: false,
      openDevTools: true,
      width: 1060,
      height: 600,
      frame: true,
      transparent: false,
      hash: '/#config/category/contentList'
    }
  },
  config: {
    id: 0,
    options: {
      initShow: false,
      openDevTools: false,
      width: 480,
      height: 520,
      frame: true,
      transparent: false,
      hash: '/#config'
    }
  },
  clipboard: {
    id: 0,
    options: {
      initShow: false,
      openDevTools: false,
      width: 620,
      height: 420,
      // 剪贴板面板参考 Maccy 类工具：frameless 透明置顶，失焦即隐藏
      alwaysOnTop: true,
      hash: '/#clipboard',
      hideOnBlur: true
    }
  }
}

export const getByNameWindow = (name: WindowNameType): BrowserWindow => {
  const item = windows[name]
  if (!item) throw new Error(`未定义的窗口: ${name}`)

  // 窗口被关闭后 id 会失效，且 Electron 的窗口 id 会被复用，必须复位后再重建
  const existed = item.id ? BrowserWindow.fromId(item.id) : null
  if (existed && !existed.isDestroyed()) return existed

  const win = createWindow(item.options)
  item.id = win.id
  win.on('closed', () => {
    if (item.id === win.id) item.id = 0
  })
  return win
}

/** 只查找已存在的窗口，不会像 getByNameWindow 一样触发懒创建 */
export const findWindow = (name: WindowNameType): BrowserWindow | null => {
  const item = windows[name]
  if (!item) return null
  const existed = item.id ? BrowserWindow.fromId(item.id) : null
  return existed && !existed.isDestroyed() ? existed : null
}

/**
 * 显示并聚焦窗口。
 * 搜索窗 / 剪贴板面板是 alwaysOnTop 的浮层，打开设置、片段管理等普通窗口前
 * 必须先收起它们，否则普通窗口会被压在浮层下面（Cmd+, 打开设置时尤其明显）。
 */
export const showAndFocus = (name: WindowNameType): void => {
  const win = getByNameWindow(name)
  if (win.isDestroyed()) return

  if (name !== 'search' && name !== 'clipboard') {
    for (const overlay of ['search', 'clipboard'] as WindowNameType[]) {
      const overlayWin = findWindow(overlay)
      if (overlayWin && overlayWin.isVisible()) overlayWin.hide()
    }
  }

  win.show()
  win.focus()
}

export const getWindowByEvent = (
  event: IpcMainEvent | IpcMainInvokeEvent
): BrowserWindow | null => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win && !win.isDestroyed() ? win : null
}
