import { app, dialog, globalShortcut, ipcMain, IpcMainInvokeEvent, Notification } from 'electron'
import { stopClipboardHook } from './clipboard'
import { config } from './db/query'
import { getByNameWindow } from './windows'
import { captureFrontmostApp } from './pasteBack'

/** 当前应用已注册的快捷键，用于切换时先注销旧键，而不是 unregisterAll 误杀其它快捷键 */
let registeredShortCut = ''

/**
 * macOS 系统级快捷键：globalShortcut.register 对它们照样返回 true、isRegistered 也是 true，
 * 但按键事件在系统层就被截走，应用永远收不到 —— 表现就是"设置里看着生效，重启后按了没反应"。
 * 这类组合只能提前判死并把原因回显给用户，不能装作注册成功。
 */
const SYSTEM_RESERVED_DARWIN: Record<string, string> = {
  'Command+Space': '已被 macOS「聚焦搜索 Spotlight」占用，建议改成 Option+Space',
  'Control+Space': '已被 macOS「切换输入法」占用，建议改成 Option+Space',
  'Command+Option+Space': '已被 macOS「访达搜索窗口」占用，建议改成 Option+Space',
  'Command+Control+Space': '已被 macOS「表情与符号」占用，建议改成 Option+Space',
  'Command+Tab': '已被 macOS「应用切换器」占用，无法接管',
  'Command+Shift+Tab': '已被 macOS「应用切换器」占用，无法接管',
  'Command+`': '已被 macOS「同一应用内切换窗口」占用，无法接管',
  'Command+Option+Escape': '已被 macOS「强制退出」窗口占用，无法接管',
  'Command+Control+Q': '已被 macOS「锁定屏幕」占用，无法接管',
  'Command+Shift+Q': '已被 macOS「退出登录」占用，无法接管',
  'Command+Shift+3': '已被 macOS「截图」占用，无法接管',
  'Command+Shift+4': '已被 macOS「截图」占用，无法接管',
  'Command+Shift+5': '已被 macOS「截图 / 录屏」占用，无法接管',
  // 下面这些是窗口自身的功能键，即使注册成功也会被当前窗口先吃掉
  'Command+Q': '会触发应用退出，不能用作唤起键',
  'Command+W': '会关闭当前窗口，不能用作唤起键',
  'Command+M': '会最小化当前窗口，不能用作唤起键',
  'Command+H': '会隐藏当前应用，不能用作唤起键'
}

/** 修饰键的规范顺序，用于把 'Space+Command'、'Alt+Space' 之类写法归一成同一把钥匙 */
const MODIFIER_ORDER = [
  'Command',
  'Cmd',
  'CmdOrCtrl',
  'Super',
  'Meta',
  'Control',
  'Option',
  'Alt',
  'Shift'
]

/**
 * accelerator 归一：Option/Alt、Meta/Super/Command 在 macOS 上是同一个物理键，
 * 顺序也可能不同，比较前统一成「修饰键按固定顺序 + 主键」的小写形式。
 */
const canonicalAccelerator = (accelerator: string): string => {
  const parts = accelerator.split('+').filter(Boolean)
  if (!parts.length) return ''
  const modifiers: string[] = []
  const keys: string[] = []
  for (const part of parts) {
    const lower = part.toLowerCase()
    // 修饰键不在末尾（比如 'Space+Command'）也要认出来，剩下的统一当主键
    if (lower === 'option' || lower === 'alt') modifiers.push('Alt')
    else if (lower === 'meta' || lower === 'super' || lower === 'command' || lower === 'cmd')
      modifiers.push('Command')
    else if (lower === 'cmdorctrl') modifiers.push('Command')
    else if (lower === 'control' || lower === 'ctrl') modifiers.push('Control')
    else if (lower === 'shift') modifiers.push('Shift')
    else keys.push(part)
  }
  const unique = [...new Set(modifiers)].sort(
    (a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b)
  )
  return [...unique, ...keys].join('+').toLowerCase()
}

/** 占用表同样过一遍归一，避免查表时大小写 / 写法不一致而漏判 */
const RESERVED_LOOKUP: Record<string, string> = Object.fromEntries(
  Object.entries(SYSTEM_RESERVED_DARWIN).map(([accelerator, reason]) => [
    canonicalAccelerator(accelerator),
    reason
  ])
)

/** 系统占用原因；返回空串表示这个组合应用可以正常接管 */
export const systemReservedReason = (accelerator: string): string => {
  if (!accelerator || process.platform !== 'darwin') return ''
  return RESERVED_LOOKUP[canonicalAccelerator(accelerator)] ?? ''
}

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

/** 当前快捷键的真实生效状态，托盘和设置页据此提示用户 */
export const getShortCutStatus = (): ShortCutStatusType => lastStatus

/**
 * 启动自检：开机自启 + 隐藏程序坞时应用没有任何窗口，快捷键再失效就彻底叫不出来了。
 * 这里补一条系统通知，告诉用户去哪儿改。
 */
let startupNotified = false
const notifyUnusableShortCut = (status: ShortCutStatusType): void => {
  if (startupNotified) return
  startupNotified = true
  console.error(`[shortcut] ${status.accelerator} 未生效：${status.error}`)
  try {
    if (!Notification.isSupported()) return
    new Notification({
      title: '灵犀快捷键未生效',
      body: `${status.accelerator} ${status.error}。点菜单栏图标 →「设置…」可更换`,
      silent: true
    }).show()
  } catch (error) {
    console.error('发送快捷键失效通知失败', error)
  }
}

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
  // 唤起前先记录最前台应用，选中片段回车时才能把内容粘回原来的光标处
  captureFrontmostApp()
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

  // 系统占用的组合：注册调用会"成功"，但事件永远进不来，必须当场判死并回显原因，
  // 否则用户看到的是"已生效"，重启后才发现按了没反应
  const reservedReason = systemReservedReason(accelerator)
  if (reservedReason) {
    if (registeredShortCut && globalShortcut.isRegistered(registeredShortCut)) {
      globalShortcut.unregister(registeredShortCut)
    }
    registeredShortCut = ''
    setStatus(accelerator, false, `${accelerator} ${reservedReason}`)
    if (notify) dialog.showErrorBox('温馨提示', `${accelerator} ${reservedReason}`)
    return false
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
  const accelerator = config().shortCut
  if (!accelerator) return

  if (systemReservedReason(accelerator)) {
    // 系统占用的组合重试多少次都没用，直接把原因抛给用户去改
    registerSearchShortCut(accelerator, false)
    notifyUnusableShortCut(getShortCutStatus())
    return
  }

  // 启动阶段不弹窗，注册失败的提示交给设置页展示
  registerSearchShortCut(accelerator, false)
  // 开机自启时系统服务可能还没就绪，注册会瞬时失败；晚一点重试两次再下结论
  const retryDelays = [1500, 5000]
  retryDelays.forEach((delay, index) => {
    setTimeout(() => {
      const status = getShortCutStatus()
      if (status.accelerator && !status.registered) registerSearchShortCut(accelerator, false)
      if (index === retryDelays.length - 1) {
        // 开机自启后应用没有任何窗口，快捷键再失效就彻底叫不出来了，必须主动告知
        const latest = getShortCutStatus()
        if (latest.accelerator && !latest.registered) notifyUnusableShortCut(latest)
      }
    }, delay)
  })
}
