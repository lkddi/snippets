import { app, Menu, MenuItemConstructorOptions } from 'electron'
import { findWindow, showAndFocus } from './windows'

/**
 * Cmd+, 切换设置窗口：未显示 / 未聚焦时唤起，已聚焦时再按就收起。
 * 菜单加速键只在应用本身拿到焦点时才触发，所以「聚焦中」即可判定为用户想关闭。
 */
const toggleSettings = (): void => {
  const win = findWindow('config')
  if (win && win.isVisible() && win.isFocused()) {
    win.hide()
    return
  }
  // showAndFocus 会先收起搜索窗等浮层，保证设置窗在最上面
  showAndFocus('config')
}

/**
 * 应用菜单：macOS 遵循系统惯例，Cmd+, 打开设置；
 * Edit 角色菜单必须保留——macOS 上没有这些菜单项，输入框的 Cmd+C/V/X 全部失效
 */
export const initAppMenu = (): void => {
  const settingsItem: MenuItemConstructorOptions =
    process.platform === 'darwin'
      ? { label: '设置…', accelerator: 'CmdOrCtrl+,', click: toggleSettings }
      : { label: '设置…', accelerator: 'Ctrl+,', click: toggleSettings }

  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              settingsItem,
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ] satisfies MenuItemConstructorOptions[]
          }
        ]
      : []),
    {
      label: '文件',
      submenu: [
        settingsItem,
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
      ] satisfies MenuItemConstructorOptions[]
    },
    { role: 'editMenu' },
    { role: 'windowMenu' }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
