import { app, dialog, globalShortcut, ipcMain, IpcMainInvokeEvent } from 'electron'
import { stopClipboardHook } from './clipboard'
import { config } from './db/query'
import { getByNameWindow } from './windows'

/** 当前应用已注册的快捷键，用于切换时先注销旧键，而不是 unregisterAll 误杀其它快捷键 */
let registeredShortCut = ''

const toggleSearchWindow = (): void => {
  const win = getByNameWindow('search')
  if (win.isDestroyed()) return
  if (win.isVisible()) {
    win.hide()
  } else {
    win.show()
    win.focus()
  }
}

export const registerSearchShortCut = (shortCut: string, notify = false): boolean => {
  const accelerator = (shortCut || '').trim()
  // 空快捷键视为「清除」：注销旧键并返回成功，搜索窗只能靠托盘/菜单唤起
  if (!accelerator) {
    if (registeredShortCut && globalShortcut.isRegistered(registeredShortCut)) {
      globalShortcut.unregister(registeredShortCut)
    }
    registeredShortCut = ''
    return true
  }

  if (registeredShortCut === accelerator && globalShortcut.isRegistered(accelerator)) {
    return true
  }

  const previous = registeredShortCut
  if (previous && globalShortcut.isRegistered(previous)) {
    globalShortcut.unregister(previous)
  }
  registeredShortCut = ''

  let success = false
  try {
    // isRegistered 只能查到本应用注册的键，是否被别的应用占用只能看 register 的返回值
    success = globalShortcut.register(accelerator, toggleSearchWindow)
  } catch (error) {
    console.error('注册全局快捷键失败', error)
    success = false
  }

  if (success) {
    registeredShortCut = accelerator
    return true
  }

  // 新键注册失败时把旧键装回去，避免"改坏一次就彻底没有热键"
  if (previous) {
    try {
      if (globalShortcut.register(previous, toggleSearchWindow)) registeredShortCut = previous
    } catch (error) {
      console.error('恢复原快捷键失败', error)
    }
  }

  if (notify) {
    dialog.showErrorBox('温馨提示', `快捷键 ${accelerator} 注册失败，可能已被其他应用占用`)
  }
  return false
}

// 检查快捷键是否注册成功（失败原因由设置页回显，这里不弹系统对话框）
ipcMain.handle('shortCut', (_event: IpcMainInvokeEvent, shortCut: string) => {
  return registerSearchShortCut(shortCut, false)
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  registeredShortCut = ''
  // uiohook 全局键盘监听退出前先 stop，避免强杀 hook 线程
  stopClipboardHook()
})

export const registerAppGlobShortcut = (): void => {
  const configData = config()
  if (configData.shortCut) {
    // 启动阶段不弹窗，注册失败的提示交给设置页展示
    registerSearchShortCut(configData.shortCut, false)
  }
}
