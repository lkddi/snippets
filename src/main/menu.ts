import { app, Menu, MenuItemConstructorOptions } from 'electron'
import { getByNameWindow } from './windows'

const openSettings = (): void => {
  const win = getByNameWindow('config')
  win.show()
  win.focus()
}

/**
 * 应用菜单：macOS 遵循系统惯例，Cmd+, 打开设置；
 * Edit 角色菜单必须保留——macOS 上没有这些菜单项，输入框的 Cmd+C/V/X 全部失效
 */
export const initAppMenu = (): void => {
  const settingsItem: MenuItemConstructorOptions =
    process.platform === 'darwin'
      ? { label: '设置…', accelerator: 'CmdOrCtrl+,', click: openSettings }
      : { label: '设置…', accelerator: 'Ctrl+,', click: openSettings }

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
