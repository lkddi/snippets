import { app, dialog, globalShortcut, ipcMain, IpcMainInvokeEvent } from 'electron'
import { stopClipboardHook } from './clipboard'
import { config } from './db/query'
import { getByNameWindow } from './windows'

/** 当前应用已注册的快捷键，用于切换时先注销旧键，而不是 unregisterAll 误杀其它快捷键 */
let registeredShortCut = ''

/**
 * 最近一次注册结果：设置页据此显示「已生效 / 未生效」。
 * 启动阶段注册失败时用户看不到任何提示，只能靠这里回显。
 */
let lastStatus: ShortCutStatusType = { accelerator: '', registered: false, error: '' }

const setStatus = (accelerator: string, registered: boolean, error = ''): void => {
  lastStatus = { accelerator, registered, error }
}

/** 当前已注册的搜索快捷键，供应用快捷键做占用检测 */
export const getSearchShortCut = (): string => registeredShortCut

const toggleSearchWindow = (): void => {
  const win = getByNameWindow('search')
  if (win.isDestroyed()) return
  // 已显示但没拿到焦点（比如被别的窗口压住）：聚焦而不是收起，否则用户会觉得"按了没反应"
  if (win.isVisible()) {
    if (win.isFocused()) {
      win.hide()
      return
    }
    if (process.platform === 'darwin') app.focus({ steal: true })
    win.focus()
    return
  }
  // macOS 隐藏程序坞图标后应用是 accessory 模式，必须显式激活才能让窗口真正浮到最前
  if (process.platform === 'darwin') app.focus({ steal: true })
  win.show()
  win.focus()
}

export const registerSearchShortCut = (shortCut: string, notify = false): boolean => {
  const accelerator = (shortCut || '').trim()
  // 空快捷键视为「清除」：注销旧键并返回成功，搜索窗只能靠托盘/菜单唤起
  if (!accelerator) {
    if (registeredShortCut && globalShortcut.isRegistered(registeredShortCut)) {
      globalShortcut.unregister(registeredShortCut)
    }
    registeredShortCut = ''
    setStatus('', false)
    return true
  }

  if (registeredShortCut === accelerator && globalShortcut.isRegistered(accelerator)) {
    setStatus(accelerator, true)
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

  // register 返回 true 也可能被系统快捷键抢走（Cmd+Space 等），再回查一次实际注册态
  if (success && !globalShortcut.isRegistered(accelerator)) success = false

  if (success) {
    registeredShortCut = accelerator
    setStatus(accelerator, true)
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

  setStatus(accelerator, false, `快捷键 ${accelerator} 注册失败，可能已被其他应用或系统占用`)
  if (notify) {
    dialog.showErrorBox('温馨提示', `快捷键 ${accelerator} 注册失败，可能已被其他应用占用`)
  }
  return false
}

// 设置页回显用：当前生效的快捷键与最近一次失败原因
ipcMain.handle('shortCut:status', () => lastStatus)

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
