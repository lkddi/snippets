import { electronApp, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow } from 'electron'
import './ipc'
// 应用启动器：导入即注册 apps:search / apps:open / apps:rescan IPC
import './apps'
import { initClipboard, registerAppClipboardShortCut } from './clipboard'
import './db'
import { initTable } from './db/tables'
import { setMainConfig } from './db/config'
import { registerAppGlobShortcut } from './shortCut'
import { getByNameWindow } from './windows'

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

  getByNameWindow('search')
  getByNameWindow('config')

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
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
