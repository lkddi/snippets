/** 快捷键录制的公共逻辑：设置页与「应用快捷键」共用，避免两份实现漂移 */

export const isMacPlatform = (): boolean => {
  const platform = window.electron?.process?.platform
  if (platform) return platform === 'darwin'
  return navigator.userAgent.includes('Mac')
}

/**
 * 浏览器给修饰键的 e.code 是「名称 + 方位」形式：ShiftLeft / ControlRight / AltLeft / MetaLeft，
 * 直接判断 code === 'Alt' 永远不成立。
 */
export const MODIFIER_BY_CODE: Record<string, string> = {
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Control',
  ControlRight: 'Control',
  AltLeft: 'Alt',
  AltRight: 'Alt',
  MetaLeft: 'Meta',
  MetaRight: 'Meta'
}

/** 主键名归一：KeyK -> K、Digit1 -> 1，其余（Space / Enter / F4 / ArrowUp）原样保留 */
export const normalizeCode = (code: string): string => {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  return code
}

/** 内部统一用 Electron 的修饰键名，展示 / 注册时再按平台换成 Command 或 Super */
export const acceleratorName = (code: string): string => {
  switch (code) {
    case 'Meta':
      return isMacPlatform() ? 'Command' : 'Super'
    case 'Control':
      return 'Control'
    case 'Alt':
      return 'Alt'
    case 'Shift':
      return 'Shift'
    default:
      return code
  }
}

/** 至少一个 Command / Control / Option，避免录出 Shift+Space 这种会抢走正常输入的组合 */
export const hasStrongModifier = (keys: string[]): boolean =>
  keys.some((key) => key === 'Meta' || key === 'Control' || key === 'Alt')

export const isValidKey = (code: string): boolean =>
  /^([A-Z]|Space|F\d{1,2}|Arrow(Up|Down|Left|Right)|Enter|Tab|Backspace|Delete|Escape|\d)$/.test(code)

/** accelerator 拆成键帽展示：'Alt+Space' -> ['Alt', 'Space'] */
export const keyCaps = (accelerator: string): string[] => (accelerator ? accelerator.split('+') : [])

/** 键帽显示名：Command 在键帽上习惯写成 ⌘ 之外的 Cmd，这里保持文字以免字体缺字 */
export const capLabel = (cap: string): string => {
  switch (cap) {
    case 'Command':
      return 'Cmd'
    case 'Control':
      return 'Ctrl'
    case 'Alt':
      return 'Option'
    default:
      return cap
  }
}
