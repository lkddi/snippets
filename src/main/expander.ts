import { clipboard, ipcMain } from 'electron'
import { execFileSync } from 'node:child_process'
import { UiohookKey, uIOhook } from 'uiohook-napi'
import { config } from './db/query'

/**
 * 文本扩展（Text Expander）：全局监听键盘输入，缓冲最近的按键字符，
 * 一旦以某条规则的缩写结尾就删掉缩写字符并把内容粘贴上去。
 * 典型用法：任意应用里输入 !k → 自动变成 bash <(curl -sL kejilion.sh)
 *
 * 依赖说明：
 * - uiohook-napi 全局键盘钩子（监听不需要系统授权）
 * - 注入按键（退格 / Cmd+V）在 macOS 需要辅助功能权限，与粘贴回填共用同一授权
 * - 键码到字符的映射按美式键盘布局；中文输入法组合键期间不会有英文按键事件
 */

/** 缓冲区长度上限：超过就丢掉最旧的字符，防止无限增长 */
const BUFFER_MAX = 48

/** 修饰键：这些按键不产生字符，直接忽略 */
const MODIFIER_KEYS = new Set<number>([
  UiohookKey.Ctrl,
  UiohookKey.CtrlRight,
  UiohookKey.Alt,
  UiohookKey.AltRight,
  UiohookKey.Shift,
  UiohookKey.ShiftRight,
  UiohookKey.Meta,
  UiohookKey.MetaRight,
  UiohookKey.CapsLock,
  UiohookKey.NumLock,
  UiohookKey.ScrollLock
])

/** 不按 Shift 时的键码 → 字符（字母统一小写，由 shiftKey 决定大小写） */
const UNMODIFIED: Record<number, string> = {
  [UiohookKey.A]: 'a', [UiohookKey.B]: 'b', [UiohookKey.C]: 'c', [UiohookKey.D]: 'd',
  [UiohookKey.E]: 'e', [UiohookKey.F]: 'f', [UiohookKey.G]: 'g', [UiohookKey.H]: 'h',
  [UiohookKey.I]: 'i', [UiohookKey.J]: 'j', [UiohookKey.K]: 'k', [UiohookKey.L]: 'l',
  [UiohookKey.M]: 'm', [UiohookKey.N]: 'n', [UiohookKey.O]: 'o', [UiohookKey.P]: 'p',
  [UiohookKey.Q]: 'q', [UiohookKey.R]: 'r', [UiohookKey.S]: 's', [UiohookKey.T]: 't',
  [UiohookKey.U]: 'u', [UiohookKey.V]: 'v', [UiohookKey.W]: 'w', [UiohookKey.X]: 'x',
  [UiohookKey.Y]: 'y', [UiohookKey.Z]: 'z',
  [UiohookKey['0']]: '0', [UiohookKey['1']]: '1', [UiohookKey['2']]: '2',
  [UiohookKey['3']]: '3', [UiohookKey['4']]: '4', [UiohookKey['5']]: '5',
  [UiohookKey['6']]: '6', [UiohookKey['7']]: '7', [UiohookKey['8']]: '8',
  [UiohookKey['9']]: '9',
  [UiohookKey.Space]: ' ', [UiohookKey.Enter]: '\n', [UiohookKey.Tab]: '\t',
  [UiohookKey.Semicolon]: ';', [UiohookKey.Equal]: '=', [UiohookKey.Comma]: ',',
  [UiohookKey.Minus]: '-', [UiohookKey.Period]: '.', [UiohookKey.Slash]: '/',
  [UiohookKey.Backquote]: '`', [UiohookKey.BracketLeft]: '[',
  [UiohookKey.Backslash]: '\\', [UiohookKey.BracketRight]: ']', [UiohookKey.Quote]: "'"
}

/** 按 Shift 时的键码 → 字符（美式布局） */
const SHIFTED: Record<number, string> = {
  [UiohookKey['1']]: '!', [UiohookKey['2']]: '@', [UiohookKey['3']]: '#',
  [UiohookKey['4']]: '$', [UiohookKey['5']]: '%', [UiohookKey['6']]: '^',
  [UiohookKey['7']]: '&', [UiohookKey['8']]: '*', [UiohookKey['9']]: '(',
  [UiohookKey['0']]: ')',
  [UiohookKey.Semicolon]: ':', [UiohookKey.Equal]: '+', [UiohookKey.Comma]: '<',
  [UiohookKey.Minus]: '_', [UiohookKey.Period]: '>', [UiohookKey.Slash]: '?',
  [UiohookKey.Backquote]: '~', [UiohookKey.BracketLeft]: '{',
  [UiohookKey.Backslash]: '|', [UiohookKey.BracketRight]: '}', [UiohookKey.Quote]: '"'
}

interface ExpansionEntry {
  abbr: string
  text: string
}

/** 内存中的规则与开关：只在设置保存（expansions:reload）时刷新，避免每次按键查库 */
let entries: ExpansionEntry[] = []
let hookRunning = false
/** 展开过程中注入的退格/粘贴会再次触发钩子，用标志位过滤掉 */
let expanding = false
/** 最近输入的字符缓冲 */
let buffer = ''

const reloadEntries = (): void => {
  const enabled = config().textExpansionEnabled !== false
  const list = config().textExpansions
  entries = enabled && Array.isArray(list)
    ? list
        .filter((item) => item && typeof item.abbr === 'string' && typeof item.text === 'string')
        .map((item) => ({ abbr: item.abbr, text: item.text }))
    : []
}

/** 最前台是不是我们自己的窗口：是的话不做扩展（别把缩写替换进自己的搜索框） */
const isOwnAppFrontmost = (): boolean => {
  if (process.platform !== 'darwin') return false
  try {
    const asn = execFileSync('lsappinfo', ['front'], { encoding: 'utf8' }).trim()
    if (!asn) return false
    const info = execFileSync('lsappinfo', ['info', '-only', 'pid', asn], { encoding: 'utf8' })
    return info.match(/"pid"=(\d+)/)?.[1] === String(process.pid)
  } catch {
    return false
  }
}

/** 注入 n 次退格，删掉刚输入的缩写 */
const deleteChars = (count: number): void => {
  for (let index = 0; index < count; index += 1) {
    uIOhook.keyTap(UiohookKey.Backspace)
  }
}

/** 写剪贴板并模拟 Cmd/Ctrl+V 粘贴，随后恢复原剪贴板内容 */
const pasteText = (text: string): void => {
  const previous = clipboard.readText()
  clipboard.writeText(text)
  const modifier = process.platform === 'darwin' ? UiohookKey.Meta : UiohookKey.Ctrl
  setTimeout(() => {
    uIOhook.keyTap(UiohookKey.V, [modifier])
    // 等粘贴完成再恢复剪贴板；恢复的也只是文本，非文本内容会被覆盖（与粘贴回填同限制）
    setTimeout(() => clipboard.writeText(previous), 400)
  }, 40)
}

const expand = (entry: ExpansionEntry): void => {
  expanding = true
  buffer = ''
  setTimeout(() => {
    try {
      deleteChars(entry.abbr.length)
      pasteText(entry.text)
    } finally {
      // 注入的按键事件要等真正处理完才能放开，给足时间
      setTimeout(() => {
        expanding = false
      }, 600)
    }
  }, 10)
}

const handleKeydown = (event: {
  keycode: number
  shiftKey: boolean
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
}): void => {
  if (expanding) return

  if (event.keycode === UiohookKey.Backspace) {
    buffer = buffer.slice(0, -1)
    return
  }
  if (MODIFIER_KEYS.has(event.keycode)) return
  // 带修饰键的组合（快捷键）不算输入；方向键等产生不了字符的按键让缓冲失效
  if (event.ctrlKey || event.metaKey || event.altKey) {
    buffer = ''
    return
  }
  const base = UNMODIFIED[event.keycode]
  const char = event.shiftKey ? (SHIFTED[event.keycode] ?? base?.toUpperCase()) : base
  if (char === undefined) {
    buffer = ''
    return
  }

  buffer = (buffer + char).slice(-BUFFER_MAX)

  // 长缩写优先匹配，避免 !k 抢在 !key 前面触发
  for (const entry of entries) {
    if (entry.abbr.length <= buffer.length && buffer.endsWith(entry.abbr)) {
      if (isOwnAppFrontmost()) {
        buffer = ''
        return
      }
      expand(entry)
      return
    }
  }
}

/** 按设置启停钩子：配置变化和启动时调用 */
export const reloadExpansions = (): void => {
  reloadEntries()

  if (entries.length > 0 && !hookRunning) {
    try {
      uIOhook.start()
      hookRunning = true
    } catch (error) {
      console.error('文本扩展键盘钩子启动失败', error)
    }
  } else if (entries.length === 0 && hookRunning) {
    try {
      uIOhook.stop()
    } catch (error) {
      console.error('文本扩展键盘钩子停止失败', error)
    }
    hookRunning = false
    buffer = ''
  }
}

// 监听器只注册一次：handler 读的是模块内的最新规则，start/stop 控制钩子即可
uIOhook.on('keydown', handleKeydown)
uIOhook.on('click', () => {
  // 鼠标点击通常会移动光标位置，缓冲里的字符不再紧挨着
  buffer = ''
})

ipcMain.on('expansions:reload', () => {
  reloadExpansions()
})
