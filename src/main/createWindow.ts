import { BrowserWindow, BrowserWindowConstructorOptions, shell } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { is } from '@electron-toolkit/utils'
import url from 'node:url'
export interface OptionsType extends Partial<BrowserWindowConstructorOptions> {
  openDevTools?: boolean
  hash?: string
  initShow?: boolean
  /** 失焦时自动隐藏窗口（仅剪贴板这类"快取快藏"的面板需要） */
  hideOnBlur?: boolean
}

export function createWindow(options: OptionsType): BrowserWindow {
  // hideOnBlur 不是 Electron 原生选项，先拆出来避免混进 BrowserWindow 构造参数
  const { hideOnBlur, ...windowOptions } = options
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
          sandbox: false
        }
      },
      windowOptions
    )
  )

  // 面板类窗口（剪贴板）失焦即隐藏，交互习惯与 Maccy 等剪贴板工具一致
  if (hideOnBlur) {
    win.on('blur', () => {
      if (!win.isDestroyed()) win.hide()
    })
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
