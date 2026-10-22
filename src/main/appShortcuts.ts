/**
 * 按应用绑定的全局快捷键：按一下启动 / 切到前台，再按一下把正在最前的它隐藏起来。
 *
 * 三个关键点：
 * 1. 注册前先做占用检测（应用内其它绑定、搜索 / 剪贴板快捷键、系统与其它应用），
 *    否则 globalShortcut.register 返回 false 时用户根本不知道为什么没生效。
 * 2. 前台判定用 macOS 自带 lsappinfo，不需要任何隐私权限；
 *    隐藏则走 AppleScript 的 System Events（首次会请求「自动化」授权）。
 * 3. 绑定关系存在 config.appShortCuts，启动时按配置重放注册。
 */
import { globalShortcut, ipcMain, IpcMainInvokeEvent } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { config, findOne, insert, update } from './db/query'
import { getSearchShortCut } from './shortCut'
import { getClipboardShortCut } from './clipboard'

const execFileAsync = promisify(execFile)
const isMac = process.platform === 'darwin'

interface Binding {
  accelerator: string
  entry: AppShortcutType
}

/** 已注册的绑定，key 为应用包路径 */
const bindings = new Map<string, Binding>()
/** 最近一次注册失败原因（按应用路径），设置页据此标红 */
const errors = new Map<string, string>()

const MODIFIER_ALIASES: Record<string, string> = {
  cmd: 'Command',
  command: 'Command',
  meta: 'Command',
  super: 'Command',
  commandorcontrol: isMac ? 'Command' : 'Control',
  cmdorctrl: isMac ? 'Command' : 'Control',
  ctrl: 'Control',
  control: 'Control',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift'
}

const MODIFIER_ORDER = ['Command', 'Control', 'Alt', 'Shift']

/**
 * 归一化成可直接比较的形式：修饰键别名统一、顺序固定、大小写统一。
 * 'Cmd+Shift+W' 与 'Shift+Command+w' 视为同一个快捷键。
 */
const canonical = (accelerator: string): string => {
  const parts = String(accelerator || '')
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  if (!parts.length) return ''

  const modifiers: string[] = []
  let key = ''
  for (const part of parts) {
    const modifier = MODIFIER_ALIASES[part.toLowerCase()]
    if (modifier) {
      if (!modifiers.includes(modifier)) modifiers.push(modifier)
    } else {
      key = part
    }
  }
  modifiers.sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b))
  return [...modifiers, ...(key ? [key] : [])].join('+').toLowerCase()
}

const displayName = (entry: Pick<AppShortcutType, 'name' | 'alias'>): string =>
  entry.alias && entry.alias !== entry.name ? `${entry.alias}（${entry.name}）` : entry.name

/** 前台应用的 bundleId：lsappinfo 无需任何隐私授权 */
const frontBundleId = async (): Promise<string> => {
  if (!isMac) return ''
  try {
    const { stdout: asnOut } = await execFileAsync('lsappinfo', ['front'], { timeout: 3000 })
    const asn = asnOut.trim().replace(/:$/, '')
    if (!asn) return ''
    const { stdout } = await execFileAsync('lsappinfo', ['info', '-only', 'bundleid', asn], {
      timeout: 3000
    })
    const match = stdout.match(/"CFBundleIdentifier"\s*=\s*"([^"]+)"/)
    return match?.[1] ?? ''
  } catch (error) {
    console.error('读取前台应用失败', error)
    return ''
  }
}

/** 启动应用；已在运行则把它切到前台（open 会自动唤醒并取消隐藏） */
const activateApp = async (entry: AppShortcutType): Promise<boolean> => {
  try {
    await execFileAsync('open', [entry.path], { timeout: 5000 })
    return true
  } catch (error) {
    console.error('启动应用失败', entry.path, error)
    return false
  }
}

/**
 * 隐藏应用：需要「自动化 → System Events」授权，首次使用系统会弹一次确认。
 * 未授权时返回 false，由调用方决定如何兜底。
 */
const hideApp = async (entry: AppShortcutType): Promise<boolean> => {
  if (!isMac || !entry.bundleId) return false
  const script = `tell application "System Events" to set visible of (first application process whose bundle identifier is "${entry.bundleId}") to false`
  try {
    await execFileAsync('osascript', ['-e', script], { timeout: 4000 })
    return true
  } catch (error) {
    console.error('隐藏应用失败（可能缺少自动化权限）', entry.bundleId, error)
    return false
  }
}

const toggleApp = async (entry: AppShortcutType): Promise<void> => {
  const front = await frontBundleId()
  const isFront = Boolean(entry.bundleId && front && front === entry.bundleId)
  if (isFront) {
    // 隐藏失败时退化为「再激活一次」：至少不会出现按了毫无反应的感觉
    const hidden = await hideApp(entry)
    if (!hidden) await activateApp(entry)
    return
  }
  await activateApp(entry)
}

/**
 * 占用检测：返回 available=false 时 error 说明被谁占了。
 * selfPath 用于「给同一个应用重新录制」时忽略它自己原有的绑定。
 */
export const checkAccelerator = (
  accelerator: string,
  selfPath = ''
): ShortCutCheckType => {
  const raw = String(accelerator || '').trim()
  const key = canonical(raw)
  if (!key) return { available: false, error: '快捷键不能为空' }

  // 至少一个强修饰键，避免把单个字母变成全局热键后无法输入
  const parts = raw.split('+').map((part) => part.trim().toLowerCase())
  const hasStrong = parts.some((part) => ['cmd', 'command', 'meta', 'super', 'ctrl', 'control', 'alt', 'option', 'commandorcontrol', 'cmdorctrl'].includes(part))
  if (!hasStrong) return { available: false, error: '请至少包含 Command / Control / Option 中的一个' }

  const searchCut = getSearchShortCut()
  if (searchCut && canonical(searchCut) === key) {
    return { available: false, error: `已被「打开搜索」（${searchCut}）占用` }
  }

  const clipCut = getClipboardShortCut()
  if (clipCut && canonical(clipCut) === key) {
    return { available: false, error: `已被「唤起剪贴板」（${clipCut}）占用` }
  }

  for (const [path, binding] of bindings) {
    if (path === selfPath) continue
    if (canonical(binding.accelerator) === key) {
      return { available: false, error: `已被「${displayName(binding.entry)}」占用` }
    }
  }

  // 自己原来的快捷键：重新录制成同一个键，直接视为可用
  if (selfPath && canonical(bindings.get(selfPath)?.accelerator ?? '') === key) {
    return { available: true, error: '' }
  }

  if (globalShortcut.isRegistered(raw)) {
    return { available: false, error: '该快捷键已被其他应用占用' }
  }

  // 试注册一个空回调来确认是否被系统 / 其它应用占用，成功立刻注销
  let probe = false
  try {
    probe = globalShortcut.register(raw, () => {})
  } catch {
    return { available: false, error: '快捷键格式无效，请换一个组合键' }
  }
  if (probe) {
    globalShortcut.unregister(raw)
    return { available: true, error: '' }
  }
  return { available: false, error: '该快捷键已被系统或其他应用占用' }
}

/** 把一条绑定真正注册到系统；失败时记录原因并把旧绑定装回去 */
const registerBinding = (entry: AppShortcutType): boolean => {
  const previous = bindings.get(entry.path)
  if (previous) {
    if (globalShortcut.isRegistered(previous.accelerator)) {
      globalShortcut.unregister(previous.accelerator)
    }
    bindings.delete(entry.path)
  }

  const accelerator = entry.accelerator.trim()
  let registered = false
  try {
    registered = globalShortcut.register(accelerator, () => {
      void toggleApp(entry)
    })
  } catch (error) {
    console.error('注册应用快捷键失败', accelerator, error)
    registered = false
  }
  // register 返回 true 也可能被系统组合键抢占，回查一次实际状态
  if (registered && !globalShortcut.isRegistered(accelerator)) registered = false

  if (!registered) {
    errors.set(entry.path, `${accelerator} 注册失败，可能已被系统占用`)
    if (previous) {
      try {
        if (globalShortcut.register(previous.accelerator, () => void toggleApp(previous.entry))) {
          bindings.set(entry.path, previous)
        }
      } catch (error) {
        console.error('恢复原应用快捷键失败', error)
      }
    }
    return false
  }

  bindings.set(entry.path, { accelerator, entry })
  errors.delete(entry.path)
  return true
}

/** 读-改-写 config.content，只替换 appShortCuts 字段，其它设置原样保留 */
const saveToConfig = (list: AppShortcutType[]): void => {
  const row = findOne('select * from config where id = 1') as { content: string } | undefined
  let content: Record<string, unknown> = {}
  if (row?.content) {
    try {
      content = JSON.parse(row.content) as Record<string, unknown>
    } catch {
      content = {}
    }
  }
  content.appShortCuts = list
  const serialized = JSON.stringify(content)
  const changes = update('update config set content=@content where id = 1', { content: serialized })
  if (!changes) insert('insert into config (id, content) values (1, @content)', { content: serialized })
}

const readConfigList = (): AppShortcutType[] => {
  const list = config().appShortCuts
  if (!Array.isArray(list)) return []
  return list.filter(
    (item): item is AppShortcutType =>
      Boolean(item) && typeof item.path === 'string' && typeof item.accelerator === 'string'
  )
}

/** 设置页展示用：配置里的绑定 + 运行时注册状态 */
const listWithState = (): AppShortcutStateType[] =>
  readConfigList().map((item) => {
    const binding = bindings.get(item.path)
    const registered = Boolean(
      binding && canonical(binding.accelerator) === canonical(item.accelerator) &&
        globalShortcut.isRegistered(binding.accelerator)
    )
    return {
      ...item,
      registered,
      error: registered ? '' : errors.get(item.path) ?? '未生效'
    }
  })

ipcMain.handle(
  'appShortCut:check',
  (_event: IpcMainInvokeEvent, accelerator: string, selfPath = '') =>
    checkAccelerator(accelerator, typeof selfPath === 'string' ? selfPath : '')
)

ipcMain.handle('appShortCut:list', () => listWithState())

ipcMain.handle(
  'appShortCut:set',
  (_event: IpcMainInvokeEvent, entry: AppShortcutType): { ok: boolean; error: string } => {
    if (!entry || typeof entry.path !== 'string' || !entry.path) {
      return { ok: false, error: '应用信息不完整' }
    }
    const accelerator = String(entry.accelerator || '').trim()
    const check = checkAccelerator(accelerator, entry.path)
    if (!check.available) return { ok: false, error: check.error }

    const normalized: AppShortcutType = {
      path: entry.path,
      name: entry.name || entry.path.split('/').pop()?.replace(/\.app$/i, '') || '未命名应用',
      alias: entry.alias || '',
      bundleId: entry.bundleId || '',
      accelerator
    }

    if (!registerBinding(normalized)) {
      return { ok: false, error: errors.get(normalized.path) ?? '注册失败' }
    }

    const next = readConfigList().filter((item) => item.path !== normalized.path)
    next.push(normalized)
    saveToConfig(next)
    return { ok: true, error: '' }
  }
)

ipcMain.handle('appShortCut:remove', (_event: IpcMainInvokeEvent, path: string) => {
  if (typeof path !== 'string' || !path) return false
  const binding = bindings.get(path)
  if (binding && globalShortcut.isRegistered(binding.accelerator)) {
    globalShortcut.unregister(binding.accelerator)
  }
  bindings.delete(path)
  errors.delete(path)
  saveToConfig(readConfigList().filter((item) => item.path !== path))
  return true
})

/** 启动时按配置重放注册：失败只记录原因，不打断启动 */
export const registerAppShortCuts = (): void => {
  for (const entry of readConfigList()) {
    if (!entry.accelerator) continue
    const check = checkAccelerator(entry.accelerator, entry.path)
    if (!check.available) {
      errors.set(entry.path, check.error)
      continue
    }
    registerBinding(entry)
  }
}
