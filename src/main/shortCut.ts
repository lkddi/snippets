import { app, dialog, globalShortcut, ipcMain, IpcMainInvokeEvent, Notification } from 'electron'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { stopClipboardHook } from './clipboard'
import { config } from './db/query'
import { getByNameWindow, revealOverlay } from './windows'
import { captureFrontmostApp } from './pasteBack'
import { diag } from './diag'

/** 当前应用已注册的快捷键，用于切换时先注销旧键，而不是 unregisterAll 误杀其它快捷键 */
let registeredShortCut = ''

/** 重复触发保护：同一次按键被派发两次时，第二次不能把刚显示的窗口又收起来 */
const TOGGLE_GUARD = 200
let lastToggleAt = 0

/**
 * macOS 真正抢不走的组合：系统窗口 / 应用切换类，
 * 任何设置下都不会把按键事件交给应用，只能提前判死。
 */
const SYSTEM_RESERVED_DARWIN: Record<string, string> = {
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

/**
 * 系统「符号快捷键」（com.apple.symbolichotkeys）占用表：这类组合并不是死的，
 * 用户在系统设置里关掉对应开关后应用就能正常接管，所以必须读真实开关状态，
 * 不能像上面那样一律判死 —— 否则用户已经让出 Cmd+Space，我们还在报"被占用"。
 */
const SYMBOLIC_HOTKEYS: Record<string, { id: number; label: string }> = {
  'Command+Space': { id: 64, label: '聚焦搜索 Spotlight' },
  'Command+Option+Space': { id: 65, label: '访达搜索窗口' },
  'Control+Space': { id: 60, label: '切换输入法' },
  'Control+Option+Space': { id: 61, label: '切换到下一个输入法' },
  'Command+Control+Space': { id: 184, label: '表情与符号' }
}

const SYMBOLIC_LOOKUP = Object.fromEntries(
  Object.entries(SYMBOLIC_HOTKEYS).map(([accelerator, info]) => [
    canonicalAccelerator(accelerator),
    info
  ])
) as Record<string, { id: number; label: string }>

/**
 * 读取系统符号快捷键的绑定状态（id -> 是否启用 + 绑在哪把键上）。
 * plist 是二进制格式，借系统自带 plutil 转 JSON 再解析；缓存 2 秒，
 * 避免用户在设置页反复试键时每敲一次都起一个进程。
 */
type HotkeyBinding = { enabled: boolean; keyCode?: number; modifiers?: number }
let hotkeyStateCache: { at: number; states: Map<number, HotkeyBinding> } = {
  at: 0,
  states: new Map()
}

const readSystemHotkeyBindings = (): Map<number, HotkeyBinding> => {
  if (Date.now() - hotkeyStateCache.at < 2000) return hotkeyStateCache.states
  const states = new Map<number, HotkeyBinding>()
  try {
    const plist = join(homedir(), 'Library/Preferences/com.apple.symbolichotkeys.plist')
    const stdout = execFileSync('plutil', ['-convert', 'json', '-o', '-', plist], {
      encoding: 'utf8'
    })
    const data = (
      JSON.parse(stdout) as {
        AppleSymbolicHotKeys?: Record<
          string,
          { enabled?: boolean; value?: { parameters?: number[] } }
        >
      }
    ).AppleSymbolicHotKeys
    for (const [key, value] of Object.entries(data ?? {})) {
      // parameters = [charCode, 虚拟键码, 修饰键掩码]
      const parameters = value?.value?.parameters ?? []
      states.set(Number(key), {
        enabled: value?.enabled !== false,
        keyCode: parameters[1],
        modifiers: parameters[2]
      })
    }
  } catch {
    // 读不到（没改过快捷键 / 无权限）：留空 map，查不到的项目按系统默认（开启）处理
  }
  hotkeyStateCache = { at: Date.now(), states }
  return states
}

/** accelerator 的修饰键 → macOS 符号快捷键掩码（碳键修饰位） */
const MODIFIER_MASK: Record<string, number> = {
  Command: 1048576,
  Shift: 131072,
  Option: 524288,
  Control: 262144
}

/** 从归一后的 accelerator 算出期望的修饰键掩码与主键虚拟码（目前只用到空格，键码 49） */
const expectedBinding = (canonical: string): { modifiers: number; keyCode: number } => {
  const parts = canonical.split('+')
  const key = parts.pop() ?? ''
  const modifiers = parts.reduce((mask, part) => {
    const name = part.charAt(0).toUpperCase() + part.slice(1)
    return mask | (MODIFIER_MASK[name] ?? 0)
  }, 0)
  return { modifiers, keyCode: key === 'space' ? 49 : -1 }
}

/**
 * 系统占用原因；返回空串表示这个组合应用可以正常接管。
 * - 硬占用（Cmd+Tab 等）：无条件拦
 * - 符号快捷键（Cmd+Space 等）：读 com.apple.symbolichotkeys 判断，
 *   只有「仍启用」且「确实绑在这把键上」才算被占 —— 用户关掉 Spotlight，
 *   或把 Spotlight 改成 Option+Space 后，Cmd+Space 就应该能用
 * - plist 里没有该条目：系统默认是开启，保守判为占用
 */
export const systemReservedReason = (accelerator: string): string => {
  if (!accelerator || process.platform !== 'darwin') return ''
  const canonical = canonicalAccelerator(accelerator)

  const hardReason = RESERVED_LOOKUP[canonical]
  if (hardReason) return hardReason

  const symbolic = SYMBOLIC_LOOKUP[canonical]
  if (!symbolic) return ''

  const hint = `已被 macOS「${symbolic.label}」占用；要用它请先在「系统设置 → 键盘 → 键盘快捷键」里关掉它（或改绑到别的键），也可以直接用 Option+Space`
  const binding = readSystemHotkeyBindings().get(symbolic.id)
  // 明确关掉 → 系统已让出
  if (binding && !binding.enabled) return ''
  // 开着但绑的是别的键（如 Spotlight 被改成 Option+Space）→ 这把键是空的
  if (binding) {
    const expected = expectedBinding(canonical)
    if (binding.keyCode !== expected.keyCode || binding.modifiers !== expected.modifiers) {
      return ''
    }
  }
  return hint
}

/**
 * 最近一次注册结果：设置页据此显示「已生效 / 未生效」。
 * 启动阶段注册失败时用户看不到任何提示，只能靠这里回显。
 */
let lastStatus: ShortCutStatusType = {
  accelerator: '',
  registered: false,
  error: '',
  reserved: false
}

const setStatus = (
  accelerator: string,
  registered: boolean,
  error = '',
  reserved = false
): void => {
  lastStatus = { accelerator, registered, error, reserved }
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
  // 一次按键可能被重复派发（系统热键 + 全局键盘钩子都收到）：
  // 那样会「显示 → 立刻再切一次 → 隐藏」，用户看到的就是窗口闪一下。
  // 200ms 内的第二次切换一律忽略。
  const now = Date.now()
  if (now - lastToggleAt < TOGGLE_GUARD) return
  lastToggleAt = now

  const win = getByNameWindow('search')
  if (win.isDestroyed()) return
  diag('hotkey:search', { visible: win.isVisible(), focused: win.isFocused() })

  // 只有「已显示且已聚焦」才算收起；其余情况都当成唤起。
  // 之前只要 isVisible() 为真就只 focus()，窗口若滞留在别的桌面 / 全屏应用后面，
  // 后面按多少次都只会 focus() 而不会真正显示出来 —— 表现为"快捷键叫不出搜索框"
  if (win.isVisible() && win.isFocused()) {
    win.hide()
    diag('hotkey:search:hide')
    return
  }
  // 唤起前先记录最前台应用，选中片段回车时才能把内容粘回原来的光标处
  captureFrontmostApp()
  revealOverlay('search')
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
    setStatus(accelerator, false, `${accelerator} ${reservedReason}`, true)
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
  // app 未 ready 就退出（单实例锁失配、初始化失败）时，globalShortcut 还不能调用
  if (!app.isReady()) return
  try {
    globalShortcut.unregisterAll()
    registeredShortCut = ''
    // uiohook 全局键盘监听退出前先 stop，避免强杀 hook 线程
    stopClipboardHook()
  } catch (error) {
    console.error('退出前注销快捷键失败', error)
  }
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
