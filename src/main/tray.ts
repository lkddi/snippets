import { app, Menu, MenuItemConstructorOptions, nativeImage, Tray } from 'electron'
import icon from '../../resources/icon.png?asset'
import { getByNameWindow, showAndFocus } from './windows'
import { isLaunchAtLogin, setLaunchAtLogin } from './loginItem'
import { captureFrontmostApp } from './pasteBack'
import { getShortCutStatus } from './shortCut'

let tray: Tray | null = null

const toggleSearch = (): void => {
  const win = getByNameWindow('search')
  if (win.isDestroyed()) return
  if (win.isVisible()) {
    win.hide()
  } else {
    // 唤起前记录最前台应用，片段粘贴时才能回到原光标处
    captureFrontmostApp()
    showAndFocus('search')
  }
}

/** 打开设置窗并定位到指定分区（代码片段也收在设置里了） */
const openSettings = (hash?: string): void => {
  const win = showAndFocus('config')
  if (hash && !win.isDestroyed()) {
    void win.webContents.executeJavaScript(`window.location.hash = ${JSON.stringify(hash)}`)
  }
}

/** 每次右键弹出时重建菜单，保证「开机启动」勾选状态和快捷键告警都是最新的 */
const buildTrayMenu = (): MenuItemConstructorOptions[] => {
  const cutStatus = getShortCutStatus()
  // 设了快捷键却没生效（系统占用 / 被别的软件抢走）：托盘是唯一还能叫出应用的地方，必须给出直达入口
  const broken = Boolean(cutStatus.accelerator) && !cutStatus.registered

  return [
    // 浮层类窗口回车粘贴时要回到唤起前的应用，必须在 show 之前记录最前台应用
    { label: '打开搜索窗', click: () => { captureFrontmostApp(); showAndFocus('search') } },
    { label: '设置…', click: () => openSettings('#/config/general') },
    ...(broken
      ? [
          { type: 'separator' } as MenuItemConstructorOptions,
          {
            label: `⚠️ ${cutStatus.accelerator} 未生效，点此修改`,
            click: () => openSettings('#/config/shortcuts')
          } as MenuItemConstructorOptions
        ]
      : []),
    { type: 'separator' },
    { label: '剪贴板历史', click: () => { captureFrontmostApp(); showAndFocus('clipboard') } },
    { label: '代码片段', click: () => openSettings('#/config/category/contentList') },
    { type: 'separator' },
    {
      label: '开机启动',
      type: 'checkbox',
      checked: isLaunchAtLogin(),
      click: (item) => setLaunchAtLogin(item.checked)
    },
    { type: 'separator' },
    { label: '退出灵犀', click: () => app.quit() }
  ]
}

export const initTray = (): void => {
  if (tray) return
  // 菜单栏图标按 18pt 高度缩放（Retina 下自动 2x）；
  // 纯黑闪电 + 模板图：菜单栏明暗模式自动反色
  const image = nativeImage.createFromPath(icon).resize({ height: 18 })
  image.setTemplateImage(true)
  tray = new Tray(image)
  tray.setToolTip('灵犀 · 快捷键唤起搜索')
  // macOS 上设置 contextMenu 会让左键单击也弹菜单，
  // 这里手动区分：左键唤起搜索窗，右键弹设置菜单
  const popMenu = (): void => {
    // 悬停提示同步一次快捷键状态：开机自启后没有窗口，这是最容易被看到的提醒位
    const status = getShortCutStatus()
    tray?.setToolTip(
      status.accelerator && !status.registered
        ? `灵犀 · ${status.accelerator} 未生效（右键 → 设置）`
        : '灵犀 · 快捷键唤起搜索'
    )
    // 右键菜单里的「打开搜索窗」也会走唤起，弹出前先记录前台应用
    captureFrontmostApp()
    tray?.popUpContextMenu(Menu.buildFromTemplate(buildTrayMenu()))
  }

  tray.on('click', (event) => {
    // 部分 macOS 版本 / 触控板设置下右键事件不一定能触发，
    // 这里补一条「按住 Option / Shift / Control 左键也弹菜单」的兜底路径
    if (event?.altKey || event?.shiftKey || event?.ctrlKey) {
      popMenu()
      return
    }
    toggleSearch()
  })
  tray.on('right-click', popMenu)
}

app.on('will-quit', () => {
  tray = null
})
