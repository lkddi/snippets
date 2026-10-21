import { clipboard, dialog, globalShortcut, ipcMain, IpcMainInvokeEvent } from 'electron'
import { exec } from 'node:child_process'
import { config, del, findAll, findOne, insert as insertRow } from './db/query'
import { findWindow, getByNameWindow } from './windows'

/** 剪贴板轮询间隔（毫秒） */
const POLL_INTERVAL = 1000
/** 历史记录上限，超出后删最旧的 */
const CLIPBOARD_LIMIT = 200
/** 双击 Option 的判定窗口（毫秒） */
const DOUBLE_PRESS_INTERVAL = 450
/** 忽略 150ms 内的重复 keydown（按键自动重复） */
const REPEAT_IGNORE_INTERVAL = 150

/** 剪贴板专用的已注册快捷键，与 search 的 registeredShortCut 各自独立维护，避免互相 unregister */
let registeredClipShortCut = ''

/** 已启动的 uiohook 实例引用：退出前 stop 用，避免强杀 hook 线程 */
let hookInstance: { stop: () => void } | null = null

/** 轮询用内存缓存：与"库里的最新一条"等价，用于去重 */
let lastContent = ''

const toggleClipboardWindow = (): void => {
  const win = getByNameWindow('clipboard')
  if (win.isDestroyed()) return
  if (win.isVisible()) {
    win.hide()
  } else {
    win.show()
    win.focus()
  }
}

/** 轮询剪贴板：内容非空且与最新一条不同才入库，超出上限删最旧，然后通知窗口刷新 */
const pollClipboard = (): void => {
  try {
    const content = clipboard.readText()
    // 与最近一条相同则跳过（最简单的去重方案，不做"历史中上移"）
    if (!content || content === lastContent) return
    lastContent = content

    insertRow(
      'insert into clipboard_items (content, created_at) values (@content, datetime())',
      { content }
    )
    del(
      'delete from clipboard_items where id not in (select id from clipboard_items order by id desc limit @limit)',
      { limit: CLIPBOARD_LIMIT }
    )

    // 窗口是懒创建的，只对已存在的窗口推送刷新事件
    findWindow('clipboard')?.webContents.send('clipboard:updated')
  } catch (error) {
    console.error('记录剪贴板内容失败', error)
  }
}

/**
 * 双击 Option 唤起：uiohook 是原生模块，加载失败（如架构不匹配）时
 * 降级为仅支持 accelerator 模式并打印错误，绝不允许让主进程崩溃
 */
const startDoubleOptionHook = async (): Promise<void> => {
  try {
    const { uIOhook, UiohookKey } = await import('uiohook-napi')
    let firstAltDownAt = 0
    let lastAltDownAt = 0

    uIOhook.on('keydown', (event) => {
      const now = Date.now()
      const isAlt =
        event.keycode === UiohookKey.Alt || event.keycode === UiohookKey.AltRight

      if (isAlt) {
        // 先更新时间再判断：持续按住时自动重复的 keydown 会一直落在 150ms 内被吞掉
        const isRepeat = now - lastAltDownAt < REPEAT_IGNORE_INTERVAL
        lastAltDownAt = now
        if (isRepeat) return

        if (firstAltDownAt && now - firstAltDownAt <= DOUBLE_PRESS_INTERVAL) {
          // 双击成立：复位状态并唤起剪贴板窗口
          firstAltDownAt = 0
          toggleClipboardWindow()
        } else {
          firstAltDownAt = now
        }
        return
      }

      // 期间按下任何其它按键都打断双击判定
      firstAltDownAt = 0
    })
    uIOhook.start()
    hookInstance = uIOhook
    // 便于排查：start 成功只代表钩子线程起来了，macOS 未授予"输入监控"权限时
    // 事件会被系统静默丢弃（不报错、收不到 keydown），这是双击 Option 无反应的头号原因
    console.log('[clipboard] uiohook 键盘监听已启动（若无反应请检查 输入监控 权限）')
  } catch (error) {
    console.error('加载 uiohook 失败，双击 Option 唤起不可用，可在设置中改用快捷键模式', error)
  }
}

/** 应用退出前停止 uiohook 全局键盘监听，避免退出时强杀 hook 线程 */
export const stopClipboardHook = (): void => {
  try {
    hookInstance?.stop()
  } catch (error) {
    console.error('停止剪贴板键盘监听失败', error)
  }
  hookInstance = null
}

/**
 * 注册剪贴板快捷键（标准 accelerator 模式）。
 * 注册/恢复/冲突处理风格与 shortCut.ts 保持一致，但使用独立的变量，
 * 避免"改剪贴板快捷键把 search 快捷键弄丢"这类互相影响。
 */
export const registerClipShortCut = (shortCut: string, notify = false): boolean => {
  const accelerator = (shortCut || '').trim()
  // 'doubleOption' 是特殊值：走双击 Option 检测，不占用全局快捷键。
  // 切回该模式时必须注销之前注册的标准快捷键，否则当次会话内会继续生效
  if (!accelerator || accelerator === 'doubleOption') {
    if (registeredClipShortCut && globalShortcut.isRegistered(registeredClipShortCut)) {
      globalShortcut.unregister(registeredClipShortCut)
    }
    registeredClipShortCut = ''
    return true
  }

  if (registeredClipShortCut === accelerator && globalShortcut.isRegistered(accelerator)) {
    return true
  }

  const previous = registeredClipShortCut
  if (previous && globalShortcut.isRegistered(previous)) {
    globalShortcut.unregister(previous)
  }
  registeredClipShortCut = ''

  let success = false
  try {
    success = globalShortcut.register(accelerator, toggleClipboardWindow)
  } catch (error) {
    console.error('注册剪贴板快捷键失败', error)
    success = false
  }

  if (success) {
    registeredClipShortCut = accelerator
    return true
  }

  // 新键注册失败时把旧键装回去，避免"改坏一次就彻底没有热键"
  if (previous) {
    try {
      if (globalShortcut.register(previous, toggleClipboardWindow)) {
        registeredClipShortCut = previous
      }
    } catch (error) {
      console.error('恢复剪贴板快捷键失败', error)
    }
  }

  if (notify) {
    dialog.showErrorBox('温馨提示', `剪贴板快捷键 ${accelerator} 注册失败，可能已被其他应用占用`)
  }
  return false
}

// 设置页专用：保存前先试注册，成功与否由设置页回显，这里不弹系统对话框
ipcMain.handle('clipboardShortCut', (_event: IpcMainInvokeEvent, shortCut: string) => {
  return registerClipShortCut(shortCut, false)
})

ipcMain.handle('clipboard:list', (_event: IpcMainInvokeEvent, keyword = '') => {
  const kw = typeof keyword === 'string' ? keyword.trim() : ''
  if (kw) {
    return findAll(
      'select * from clipboard_items where content like @keyword order by id desc limit 50',
      { keyword: `%${kw}%` }
    )
  }
  return findAll('select * from clipboard_items order by id desc limit 50')
})

ipcMain.handle('clipboard:delete', (_event: IpcMainInvokeEvent, id: number) => {
  return del('delete from clipboard_items where id = @id', { id })
})

ipcMain.handle('clipboard:clear', () => {
  return del('delete from clipboard_items', {})
})

ipcMain.handle('clipboard:paste', (_event: IpcMainInvokeEvent, id: number) => {
  const row = findOne('select content from clipboard_items where id = @id', { id }) as
    | { content: string }
    | undefined
  if (!row) return false

  clipboard.writeText(row.content)
  const win = findWindow('clipboard')
  if (win && !win.isDestroyed()) win.hide()

  // 用 osascript 模拟 Cmd+V 实现自动粘贴（需要辅助功能权限）；
  // 失败时静默降级为仅写回剪贴板，用户手动 Cmd+V 即可
  if (process.platform === 'darwin') {
    exec(
      `osascript -e 'tell application "System Events" to keystroke "v" using command down'`,
      (error) => {
        if (error) console.error('自动粘贴失败，内容已写回剪贴板', error)
      }
    )
  }
  return true
})

/** 启动剪贴板监听（轮询 + 双击 Option 检测），在 app ready 后调用 */
export const initClipboard = (): void => {
  // 先对齐"最新一条"再开始轮询，避免把上一次退出前的旧内容当成新记录再插一遍
  try {
    const row = findOne('select content from clipboard_items order by id desc limit 1') as
      | { content: string }
      | undefined
    lastContent = row?.content ?? ''
  } catch (error) {
    console.error('初始化剪贴板历史失败', error)
    lastContent = ''
  }
  setInterval(pollClipboard, POLL_INTERVAL)
  void startDoubleOptionHook()
}

/** 读取 config 里的剪贴板快捷键并注册，启动阶段不弹窗 */
export const registerAppClipboardShortCut = (): void => {
  const configData = config()
  if (configData.clipboardShortCut) {
    registerClipShortCut(configData.clipboardShortCut, false)
  }
}
