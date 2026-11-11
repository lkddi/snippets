import { app, clipboard, dialog, globalShortcut, ipcMain, IpcMainInvokeEvent, nativeImage, shell } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { config, del, findAll, findOne, insert as insertRow } from './db/query'
import { findWindow, getByNameWindow } from './windows'
import { captureFrontmostApp, pasteBackToFrontApp } from './pasteBack'

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

/** 当前已注册的剪贴板快捷键（'doubleOption' 时为空），供应用快捷键做占用检测 */
export const getClipboardShortCut = (): string => registeredClipShortCut

/** 已启动的 uiohook 实例引用：退出前 stop 用，避免强杀 hook 线程 */
let hookInstance: { stop: () => void } | null = null
/** 钩子是否已启动：文本扩展模块共用同一个原生钩子，必须只有一处 start/stop */
let hookStarted = false
/** 最近一次收到全局按键的时间：用于判断「输入监控」权限是否给了（收不到事件即权限问题） */
let lastKeyEventAt = 0

/** 去重键：文本用内容，图片/文件用 hash/路径，避免同样的图片被重复入库 */
let lastKey = ''

/** 图片剪贴板的落盘目录（面板预览与粘贴都从这里读） */
const imageDir = (): string => {
  const dir = join(app.getPath('userData'), 'clipboard-images')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

interface CapturedType {
  kind: 'text' | 'image' | 'file'
  content: string
  path: string
  meta: string
  key: string
}

/** Finder 里复制文件时，剪贴板上是 public.file-url */
const readFileUrl = (): string => {
  try {
    const buffer = clipboard.readBuffer('public.file-url')
    if (!buffer || !buffer.length) return ''
    const url = buffer.toString('utf8').trim()
    if (!url.startsWith('file://')) return ''
    return decodeURIComponent(url.slice('file://'.length))
  } catch {
    return ''
  }
}

/**
 * 读取当前剪贴板内容并归类。优先级：文件 > 图片 > 文本 ——
 * 复制文件时系统也可能同时提供图片预览，必须让文件优先生效。
 */
const captureClipboard = (): CapturedType | null => {
  const filePath = readFileUrl()
  if (filePath) {
    return {
      kind: 'file',
      content: filePath,
      path: filePath,
      meta: extname(filePath).replace('.', '').toLowerCase(),
      key: `file:${filePath}`
    }
  }

  const image = clipboard.readImage()
  if (!image.isEmpty()) {
    const png = image.toPNG()
    const hash = createHash('sha1').update(png).digest('hex')
    const file = join(imageDir(), `${hash}.png`)
    if (!existsSync(file)) writeFileSync(file, png)
    const size = image.getSize()
    return {
      kind: 'image',
      content: `图片 ${size.width}×${size.height}`,
      path: file,
      meta: `${size.width}x${size.height}|${png.length}`,
      key: `image:${hash}`
    }
  }

  const text = clipboard.readText()
  if (!text) return null
  return { kind: 'text', content: text, path: '', meta: '', key: `text:${text}` }
}

const toggleClipboardWindow = (): void => {
  const win = getByNameWindow('clipboard')
  if (win.isDestroyed()) return
  if (win.isVisible()) {
    win.hide()
  } else {
    // 必须在面板拿焦点之前记录最前台应用，回车粘贴时才能把内容送回原来的光标处
    captureFrontmostApp()
    win.show()
    win.focus()
  }
}

/** 轮询剪贴板：内容非空且与最新一条不同才入库，超出上限删最旧，然后通知窗口刷新 */
const pollClipboard = (): void => {
  try {
    const captured = captureClipboard()
    if (!captured) {
      // 剪贴板被清空：下次有内容时应当重新入库
      lastKey = ''
      return
    }
    if (captured.key === lastKey) return
    lastKey = captured.key

    insertRow(
      `insert into clipboard_items (content, created_at, kind, path, meta)
       values (@content, datetime(), @kind, @path, @meta)`,
      {
        content: captured.content,
        kind: captured.kind,
        path: captured.path,
        meta: captured.meta
      }
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
 * 降级为仅支持 accelerator 模式并打印错误，绝不允许让主进程崩溃。
 *
 * 注意：这是全局唯一的原生键盘钩子持有者。文本扩展模块只能调用
 * ensureClipboardHookStarted() 复用它，绝不能自己 start/stop ——
 * 之前 expander 在规则清空时 uIOhook.stop()，把这里的双击检测一起关了，
 * 表现就是「剪贴板快捷键突然失效」，且重新加规则也不会恢复。
 */
const startDoubleOptionHook = async (): Promise<void> => {
  if (hookStarted) return
  try {
    const { uIOhook, UiohookKey } = await import('uiohook-napi')
    let firstAltDownAt = 0
    let lastAltDownAt = 0
    // 诊断用：只打印前 5 个全局按键事件。如果按 Option 后终端没有任何
    // "[clipboard][debug]" 输出，说明钩子根本没收到事件（权限/事件 tap 问题）
    let debugKeyDownLeft = 5

    uIOhook.on('keydown', (event) => {
      lastKeyEventAt = Date.now()
      if (debugKeyDownLeft > 0) {
        debugKeyDownLeft--
        console.log(
          `[clipboard][debug] 收到全局 keydown keycode=${event.keycode} altKey=${event.altKey}` +
            (debugKeyDownLeft === 0 ? '（诊断日志到此为止）' : '')
        )
      }
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
    try {
      uIOhook.start()
    } catch (error) {
      // start 抛错通常是事件 tap 创建失败（权限被拒），与"收不到事件"要区分开
      console.error('[clipboard] uiohook start() 失败（事件 tap 创建失败，通常是权限问题）', error)
      return
    }
    hookInstance = uIOhook
    hookStarted = true
    // 便于排查：start 成功只代表钩子线程起来了，macOS 未授予"输入监控"权限时
    // 事件会被系统静默丢弃（不报错、收不到 keydown），这是双击 Option 无反应的头号原因
    console.log('[clipboard] uiohook 键盘监听已启动（若无反应请检查 输入监控 权限）')
  } catch (error) {
    console.error('加载 uiohook 失败，双击 Option 唤起不可用，可在设置中改用快捷键模式', error)
  }
}

/** 供其它模块（文本扩展）复用的启动入口：幂等，重复调用不会二次 start */
export const ensureClipboardHookStarted = async (): Promise<boolean> => {
  if (!hookStarted) await startDoubleOptionHook()
  return hookStarted
}

/** 钩子运行状态 + 最近按键时间：设置页据此提示「输入监控」权限是否缺失 */
export const getClipboardHookStatus = (): {
  running: boolean
  lastEventAt: number
  shortCut: string
} => ({ running: hookStarted, lastEventAt: lastKeyEventAt, shortCut: registeredClipShortCut })

/** 应用退出前停止 uiohook 全局键盘监听，避免退出时强杀 hook 线程 */
export const stopClipboardHook = (): void => {
  try {
    hookInstance?.stop()
  } catch (error) {
    console.error('停止剪贴板键盘监听失败', error)
  }
  hookInstance = null
  hookStarted = false
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
  const row = findOne('select content, kind, path from clipboard_items where id = @id', { id }) as
    | { content: string; kind?: string; path?: string }
    | undefined
  if (!row) return false

  // 按类型还原到剪贴板：图片重新写回图像本身，文件写回 file-url（Finder 可直接粘贴文件）
  if (row.kind === 'image' && row.path && existsSync(row.path)) {
    const image = nativeImage.createFromPath(row.path)
    if (!image.isEmpty()) clipboard.writeImage(image)
    else clipboard.writeText(row.content)
  } else if (row.kind === 'file' && row.path) {
    clipboard.clear()
    clipboard.writeBuffer('public.file-url', Buffer.from(`file://${encodeURI(row.path)}`))
  } else {
    clipboard.writeText(row.content)
  }

  const win = findWindow('clipboard')
  if (win && !win.isDestroyed()) win.hide()

  // 隐藏面板后焦点不会立刻回到原应用：等片刻后把唤起面板前记录的应用
  // 显式调回前台，最后才发 Cmd+V，保证内容粘回原来的光标处
  pasteBackToFrontApp()
  return true
})

/** 可直接出缩略图的图片文件扩展名：Finder 里复制的图片文件也要能预览画面 */
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'heic', 'svg']

/** 生成缩略图预览：预览不需要原图，缩到 480px 内再转 base64，避免大图撑爆 IPC */
const buildImagePreview = (file: string, bytes: number, name?: string): ClipboardPreviewType | null => {
  const image = nativeImage.createFromPath(file)
  if (image.isEmpty()) return null
  const size = image.getSize()
  const scale = Math.min(1, 480 / Math.max(size.width, size.height))
  const thumb =
    scale < 1
      ? image.resize({
          width: Math.max(1, Math.round(size.width * scale)),
          height: Math.max(1, Math.round(size.height * scale))
        })
      : image
  return {
    kind: 'image',
    dataUrl: thumb.toDataURL(),
    width: size.width,
    height: size.height,
    bytes,
    ...(name ? { name } : {})
  }
}

/** 面板右侧预览：图片返回缩略图 data URL（避免渲染层直接读磁盘），文本返回正文片段 */
ipcMain.handle('clipboard:preview', (_event: IpcMainInvokeEvent, id: number) => {
  const row = findOne('select content, kind, path, meta from clipboard_items where id = @id', {
    id
  }) as { content: string; kind?: string; path?: string; meta?: string } | undefined
  if (!row) return null

  if (row.kind === 'image' && row.path && existsSync(row.path)) {
    const preview = buildImagePreview(row.path, Number((row.meta ?? '').split('|')[1] ?? 0))
    if (preview) return preview
  }

  if (row.kind === 'file' && row.path) {
    // Finder 里 Cmd+C 复制图片文件时 kind 是 file，但用户同样期待看到画面缩略图
    const ext = (row.meta || extname(row.path).slice(1)).toLowerCase()
    if (IMAGE_EXTS.includes(ext) && existsSync(row.path)) {
      let bytes = 0
      try {
        bytes = statSync(row.path).size
      } catch {
        bytes = 0
      }
      const preview = buildImagePreview(row.path, bytes, basename(row.path))
      if (preview) return preview
    }
    return { kind: 'file', path: row.path, name: basename(row.path), ext: row.meta ?? '' }
  }

  const text = row.content
  return { kind: 'text', text: text.slice(0, 4000), truncated: text.length > 4000 }
})

/** 设置页诊断：钩子是否在跑、最近是否收到过按键（判断「输入监控」权限） */
ipcMain.handle('clipboard:hook-status', () => getClipboardHookStatus())

/**
 * 打开 macOS「输入监控」授权面板。
 * 重装 / 换签名的应用会被系统当成新应用，需要重新授权，
 * 双击 Option 失效时用户可以直接跳过去勾选。
 */
ipcMain.handle('clipboard:open-permission', () => {
  if (process.platform !== 'darwin') return false
  void shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent'
  )
  return true
})

/**
 * 按配置的保存天数清理过期剪贴板记录，0 或负数表示永久保留。
 * 每次执行都实时读配置，改完设置无需重启即生效
 */
const cleanExpiredItems = (): void => {
  try {
    const days = Number(config().clipboardRetentionDays)
    if (!days || days <= 0) return
    del(
      "delete from clipboard_items where created_at < datetime('now', @offset)",
      { offset: `-${days} days` }
    )
  } catch (error) {
    console.error('清理过期剪贴板记录失败', error)
  }
}

/** 启动剪贴板监听（轮询 + 双击 Option 检测），在 app ready 后调用 */
export const initClipboard = (): void => {
  // 先对齐"最新一条"再开始轮询，避免把上一次退出前的旧内容当成新记录再插一遍
  try {
    const row = findOne(
      'select content, kind, path from clipboard_items order by id desc limit 1'
    ) as { content: string; kind?: string; path?: string } | undefined
    lastKey = row
      ? row.kind === 'file' || row.kind === 'image'
        ? `${row.kind}:${row.path ?? ''}`
        : `text:${row.content}`
      : ''
  } catch (error) {
    console.error('初始化剪贴板历史失败', error)
    lastKey = ''
  }
  // 启动时清一次过期记录，之后每小时清一次（记录以天为粒度过期，无需更频繁）
  cleanExpiredItems()
  setInterval(cleanExpiredItems, 60 * 60 * 1000)
  setInterval(pollClipboard, POLL_INTERVAL)
  void ensureClipboardHookStarted()
}

/** 读取 config 里的剪贴板快捷键并注册，启动阶段不弹窗 */
export const registerAppClipboardShortCut = (): void => {
  const configData = config()
  if (configData.clipboardShortCut) {
    registerClipShortCut(configData.clipboardShortCut, false)
  }
}
