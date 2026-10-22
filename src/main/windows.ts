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
      alwaysOnTop: true,
      // 透明窗口的系统阴影会套在整个窗口矩形上（可见面板之外也是阴影区），
      // 看起来像面板外面多了一圈描边；立体感交给面板自身的 CSS box-shadow
      hasShadow: false,
      // 在任意桌面 / 全屏应用上都能唤起，否则热键只在窗口原本所在的 Space 才有反应
      allWorkspaces: true
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
      hash: '#/config/category/contentList'
    }
  },
  config: {
    id: 0,
    options: {
      initShow: false,
      openDevTools: false,
      // 左右分栏设置窗：左侧导航 + 右侧内容，代码片段也嵌在里面，需要更宽的画布
      width: 1120,
      height: 720,
      minWidth: 940,
      minHeight: 600,
      frame: true,
      transparent: false,
      hash: '#/config/general'
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
      // 同搜索窗：透明窗口关掉原生阴影，避免可见内容外出现一圈灰边
      hasShadow: false,
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
export const showAndFocus = (name: WindowNameType): BrowserWindow => {
  const win = getByNameWindow(name)
  if (win.isDestroyed()) return win

  if (name !== 'search' && name !== 'clipboard') {
    for (const overlay of ['search', 'clipboard'] as WindowNameType[]) {
      const overlayWin = findWindow(overlay)
      if (overlayWin && overlayWin.isVisible()) overlayWin.hide()
    }
  }

  win.show()
  win.focus()
  return win
}

export const getWindowByEvent = (
  event: IpcMainEvent | IpcMainInvokeEvent
): BrowserWindow | null => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win && !win.isDestroyed() ? win : null
}
