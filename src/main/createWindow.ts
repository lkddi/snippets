import { BrowserWindow, BrowserWindowConstructorOptions, shell } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { is } from '@electron-toolkit/utils'
import url from 'node:url'
import { diag } from './diag'
export interface OptionsType extends Partial<BrowserWindowConstructorOptions> {
  openDevTools?: boolean
  hash?: string
  initShow?: boolean
  /** 失焦时自动隐藏窗口（仅剪贴板这类"快取快藏"的面板需要） */
  hideOnBlur?: boolean
  /** 显示在全部桌面 / 全屏应用之上（启动器窗口用，保证任意 Space 都能唤起） */
  allWorkspaces?: boolean
}

export function createWindow(options: OptionsType): BrowserWindow {
  // hideOnBlur 不是 Electron 原生选项，先拆出来避免混进 BrowserWindow 构造参数
  const { hideOnBlur, allWorkspaces, ...windowOptions } = options
  // const { width } = screen.getPrimaryDisplay().workAreaSize
  // Create the browser window.
  const win = new BrowserWindow(
    Object.assign(
      {
        width: 500,
        height: 350,
        center: true,
        // x: width - 500,
        // y: 0,
        show: false,
        frame: false,
        transparent: true,
        alwaysOnTop: false,
        autoHideMenuBar: true,
        ...(process.platform === 'linux' ? { icon } : {}),
        webPreferences: {
          preload: join(__dirname, '../preload/index.js'),
          // Chromium 内置 PDF 阅读器属于插件，空格预览 PDF 需要打开
          plugins: true,
          sandbox: false
        }
      },
      windowOptions
    )
  )

  // 面板类窗口（剪贴板）失焦即隐藏，交互习惯与 Maccy 等剪贴板工具一致
  if (hideOnBlur) {
    let shownAt = 0
    win.on('show', () => {
      shownAt = Date.now()
    })
    win.on('blur', () => {
      // 刚显示出来的 300ms 内忽略失焦：激活应用 / 切换桌面过程中的瞬时失焦
      // 会把面板立刻收起来，用户看到的就是「闪一下就没了」
      if (Date.now() - shownAt < 300) {
        diag('window:blur-ignored', { ms: Date.now() - shownAt })
        return
      }
      if (!win.isDestroyed()) win.hide()
    })
  }

  // 启动器窗口固定在所有桌面与全屏应用之上，否则换个 Space 按热键看不到窗口
  if (allWorkspaces && process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  if (is.dev && options.openDevTools) {
    win.webContents.openDevTools()
  }

  win.on('ready-to-show', () => {
    options.initShow && win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 渲染进程崩溃 / 页面加载失败时窗口是一片透明的空白：
  // 用户看到的是"窗口没出现"（透明窗口里面什么都没有），只能重启应用才好。
  // 这里自动重载，最多 3 次，避免坏文件导致无限重载死循环。
  let reloadCount = 0
  const recover = (reason: string, detail?: unknown): void => {
    diag('renderer:broken', { reason, detail })
    if (win.isDestroyed() || reloadCount >= 3) return
    reloadCount += 1
    setTimeout(() => {
      if (!win.isDestroyed()) win.webContents.reload()
    }, 300)
  }
  win.webContents.on('render-process-gone', (_event, details) => recover('gone', details))
  win.webContents.on('did-fail-load', (_event, code, desc, url, isMainFrame) => {
    if (isMainFrame) recover('fail-load', { code, desc, url })
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file in production.
  const hash = options.hash ?? ''
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + hash)
  } else {
    win.loadURL(
      url.format({
        //编译后的文件
        pathname: join(__dirname, '../renderer/index.html'),
        //协议
        protocol: 'file',
        //protocol 后面需要两个/
        slashes: true,
        //hash 的值
        hash: hash.substring(1)
      })
    )
  }

  return win
}
