import { electronApp, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow } from 'electron'
import './ipc'
// 应用启动器：导入即注册 apps:search / apps:open / apps:rescan IPC
import './apps'
// 文件搜索（files:search / files:open / files:selectDir）与网页搜索（web:open）
import './files'
import './webSearch'
// 搜索窗空格预览（preview:item）
import './preview'
// 说明页：版本 / 最新版检查 / 外链打开
import './about'
// 系统语言：app:locale（供设置页「跟随系统」解析）
import './i18n'
import { initClipboard, registerAppClipboardShortCut } from './clipboard'
import './db'
import { initTable } from './db/tables'
import { setMainConfig } from './db/config'
import { registerAppGlobShortcut } from './shortCut'
import { registerAppShortCuts } from './appShortcuts'
import { getByNameWindow, showAndFocus } from './windows'
import { initAppMenu } from './menu'
import { initTray } from './tray'
import './loginItem'
import { applyDockIconFromConfig } from './dockIcon'
import { captureFrontmostApp } from './pasteBack'
// 文本扩展：导入即注册 expansions:reload IPC
import { reloadExpansions } from './expander'

// 单实例：开机自启后用户又双击了一次应用 / 图标，会跑出第二个实例。
// 全局热键只有一个进程能拿到，第二个实例拿不到却又抢着显示窗口，
// 表现就是"快捷键没反应"。这里让后来的实例直接退出，由已有实例响应。
if (!app.requestSingleInstanceLock()) {
  // 必须用 exit 而不是 quit：quit 会走 before-quit / will-quit 流程，
  // 而此刻 app 还没 ready，will-quit 里的 globalShortcut.unregisterAll() 会抛
  // "globalShortcut cannot be used before the app is ready"，直接弹出崩溃框
  app.exit(0)
} else {
  // 第二个实例启动时，已有实例直接唤起搜索窗
  app.on('second-instance', () => {
    captureFrontmostApp()
    showAndFocus('search')
  })
}

// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 建表 / 初始化数据必须在创建窗口和读取配置之前完成，
  // 否则首次启动查 config 表会抛 "no such table"，并中断后续初始化
  try {
    initTable()
    // 标记已完成首次初始化，之后切换数据库目录不再灌演示数据
    setMainConfig({ initialized: true })
  } catch (error) {
    console.error('初始化数据库失败', error)
  }

  // 应用菜单：提供 Cmd+, 打开设置（macOS 惯例）和 Edit 角色菜单
  try {
    initAppMenu()
  } catch (error) {
    console.error('初始化应用菜单失败', error)
  }

  // 配置读取依赖数据表，初始化失败时不要让后面的窗口创建一起中断
  try {
    registerAppGlobShortcut()
  } catch (error) {
    console.error('注册全局快捷键失败', error)
  }

  // 剪贴板监听与快捷键初始化失败不应影响主流程（双击 Option 检测内部自带降级）
  try {
    initClipboard()
    registerAppClipboardShortCut()
  } catch (error) {
    console.error('初始化剪贴板功能失败', error)
  }

  // 应用快捷键要在搜索 / 剪贴板之后注册，占用检测才能看到它们已占用的组合键
  try {
    registerAppShortCuts()
  } catch (error) {
    console.error('注册应用快捷键失败', error)
  }

  // 菜单栏托盘：左键唤起搜索窗，右键弹菜单（设置/开机启动/退出）
  try {
    initTray()
  } catch (error) {
    console.error('初始化托盘失败', error)
  }

  // 程序坞图标：按设置隐藏（隐藏后应用只驻留菜单栏）
  try {
    applyDockIconFromConfig()
  } catch (error) {
    console.error('应用程序坞图标设置失败', error)
  }

  // 文本扩展：按配置启停全局键盘钩子（有规则才启动）
  try {
    reloadExpansions()
  } catch (error) {
    console.error('文本扩展初始化失败', error)
  }

  // 搜索窗只创建不显示，等快捷键或托盘唤起
  getByNameWindow('search')
  getByNameWindow('config')

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      captureFrontmostApp()
      getByNameWindow('search').show()
    }
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
