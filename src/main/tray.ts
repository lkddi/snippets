import { app, Menu, MenuItemConstructorOptions, nativeImage, Tray } from 'electron'
import icon from '../../resources/icon.png?asset'
import { getByNameWindow, showAndFocus } from './windows'
import { isLaunchAtLogin, setLaunchAtLogin } from './loginItem'

let tray: Tray | null = null

const toggleSearch = (): void => {
  const win = getByNameWindow('search')
  if (win.isDestroyed()) return
  if (win.isVisible()) {
    win.hide()
  } else {
    showAndFocus('search')
  }
}

/** 每次右键弹出时重建菜单，保证「开机启动」勾选状态是最新的 */
const buildTrayMenu = (): MenuItemConstructorOptions[] => [
  { label: '打开搜索窗', click: () => showAndFocus('search') },
  { label: '剪贴板历史', click: () => showAndFocus('clipboard') },
  { label: '设置…', click: () => showAndFocus('config') },
  { type: 'separator' },
  {
    label: '开机启动',
    type: 'checkbox',
    checked: isLaunchAtLogin(),
    click: (item) => setLaunchAtLogin(item.checked)
  },
  { type: 'separator' },
  { label: '退出 Snippets', click: () => app.quit() }
]

export const initTray = (): void => {
  if (tray) return
  // 菜单栏图标按 18pt 高度缩放（Retina 下自动 2x）
  const image = nativeImage.createFromPath(icon).resize({ height: 18 })
  tray = new Tray(image)
  tray.setToolTip('Snippets · 快捷键唤起搜索')
  // macOS 上设置 contextMenu 会让左键单击也弹菜单，
  // 这里手动区分：左键唤起搜索窗，右键弹设置菜单
  tray.on('click', toggleSearch)
  tray.on('right-click', () => {
    tray?.popUpContextMenu(Menu.buildFromTemplate(buildTrayMenu()))
  })
}

app.on('will-quit', () => {
  tray = null
})
