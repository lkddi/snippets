import { app, ipcMain, IpcMainInvokeEvent, nativeImage } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readSync,
  readdirSync,
  rmSync,
  statSync,
  Stats
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findOne } from './db/query'
import { findWindow } from './windows'

/** PDF 走 Chromium 内置阅读器，比缩略图强得多 */
const PDF_EXTS = ['pdf']

/** 视频 / 音频直接内嵌播放，等同系统"快速查看"的体验 */
const VIDEO_EXTS = ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'flv', 'wmv', 'mpg', 'mpeg']
const AUDIO_EXTS = ['mp3', 'wav', 'aac', 'flac', 'm4a', 'aiff', 'ogg', 'opus', 'wma']

/**
 * 交给系统 Quick Look 出首页缩略图的类型：
 * Office / iWork / 字体 / 电子书这类 Chromium 自己不认识的文档。
 * 只收文档类，dmg / iso 这种大镜像出图慢且没信息量。
 */
const QL_EXTS = [
  'doc',
  'docx',
  'docm',
  'xls',
  'xlsx',
  'xlsm',
  'ppt',
  'pptx',
  'pptm',
  'pages',
  'numbers',
  'key',
  'rtf',
  'rtfd',
  'odt',
  'ods',
  'odp',
  'epub',
  'ttf',
  'otf',
  'ttc',
  'sketch',
  'ai',
  'psd'
]

/** 超大文件系统出图很慢，超过这个体积就只显示文件信息 */
const QL_MAX_BYTES = 80 * 1024 * 1024
/** qlmanage 冷启动 + 生成缩略图，超时就放弃，避免预览卡住 */
const QL_TIMEOUT = 5000
/** qlmanage 失败按路径缓存一次，避免同目录反复起进程 */
const thumbCache = new Map<string, string | null>()

/** 能直接出缩略图的图片扩展名 */
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'heic', 'svg']

/** 按纯文本预览的扩展名（代码 / 配置 / 日志这类，预览比"文件信息"有用得多） */
const TEXT_EXTS = [
  'txt',
  'md',
  'markdown',
  'json',
  'jsonc',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'vue',
  'css',
  'scss',
  'less',
  'html',
  'htm',
  'xml',
  'yml',
  'yaml',
  'toml',
  'ini',
  'conf',
  'env',
  'csv',
  'log',
  'sh',
  'zsh',
  'bash',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'php',
  'sql',
  'lua',
  'gitignore'
]

/** 文本预览上限：再长就不是"扫一眼"的场景了，超出只提示截断 */
const TEXT_LIMIT = 20 * 1024
/** 图片预览最大边长：够在 500px 窗口里看清，又不至于把 data URL 撑太大 */
const IMAGE_MAX = 900
/** 文件夹条目数上限，只用于展示"共 N 项" */
const DIR_ENTRY_LIMIT = 999

/** 含 NUL 字节基本可判定为二进制（图片/压缩包/可执行文件） */
const isTextLike = (buffer: Buffer): boolean => {
  return !buffer.includes(0)
}

/** 只读文件开头 limit 字节：大文件不该整份读进内存 */
const readHead = (path: string, limit: number): Buffer => {
  const fd = openSync(path, 'r')
  try {
    const buffer = Buffer.alloc(limit)
    const read = readSync(fd, buffer, 0, limit, 0)
    return buffer.subarray(0, read)
  } finally {
    closeSync(fd)
  }
}

/**
 * 调系统 Quick Look（qlmanage）把文件渲染成首页缩略图。
 * qlmanage 是 Finder 快速预览的同一套生成器，Office / Pages / 字体都能出图；
 * Windows 上没有这个命令，直接返回 null 由调用方降级成文件信息。
 */
const quickLookThumb = (path: string, stat: Stats): Promise<string | null> => {
  if (process.platform !== 'darwin') return Promise.resolve(null)
  const key = `${path}|${stat.mtimeMs}|${stat.size}`
  if (thumbCache.has(key)) return Promise.resolve(thumbCache.get(key) ?? null)

  return new Promise((resolve) => {
    let dir = ''
    try {
      dir = mkdtempSync(join(tmpdir(), 'lingxi-ql-'))
    } catch {
      return resolve(null)
    }

    let settled = false
    const finish = (value: string | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        // 清理失败不影响结果
      }
      // 只缓存成功与"生成不出图"两类，超时的不缓存以便下次重试
      if (value) {
        thumbCache.set(key, value)
        if (thumbCache.size > 40) {
          const oldest = thumbCache.keys().next().value
          if (oldest) thumbCache.delete(oldest)
        }
      }
      resolve(value)
    }

    const child = spawn('/usr/bin/qlmanage', ['-t', '-s', '1200', '-o', dir, path], {
      stdio: 'ignore'
    })
    const timer = setTimeout(() => {
      child.kill()
      finish(null)
    }, QL_TIMEOUT)

    child.on('error', () => finish(null))
    child.on('close', () => {
      try {
        const file = readdirSync(dir).find((name) => /\.(png|jpe?g|tiff?)$/i.test(name))
        if (!file) return finish(null)
        const image = nativeImage.createFromPath(join(dir, file))
        if (image.isEmpty()) return finish(null)
        const size = image.getSize()
        const scale = Math.min(1, IMAGE_MAX / Math.max(size.width, size.height))
        const thumb =
          scale < 1
            ? image.resize({
                width: Math.max(1, Math.round(size.width * scale)),
                height: Math.max(1, Math.round(size.height * scale))
              })
            : image
        finish(thumb.toDataURL())
      } catch {
        finish(null)
      }
    })
  })
}

const previewFile = async (path: string): Promise<SearchPreviewType | null> => {
  if (!existsSync(path)) return null
  const name = basename(path)
  const stat = statSync(path)
  const ext = extname(path).slice(1).toLowerCase()
  // 派生自 file:// 页面，可以直接被 iframe / video 加载（路径里的中文空格都已转义）
  const fileUrl = pathToFileURL(path).href

  if (stat.isDirectory()) {
    // .app 走应用分支，这里只剩真正的文件夹
    let entries = 0
    try {
      entries = Math.min(readdirSync(path).length, DIR_ENTRY_LIMIT)
    } catch {
      entries = 0
    }
    return {
      kind: 'info',
      name,
      path,
      bytes: 0,
      modified: stat.mtime.toISOString(),
      ext,
      isDir: true,
      entries
    }
  }

  if (IMAGE_EXTS.includes(ext)) {
    const image = nativeImage.createFromPath(path)
    if (!image.isEmpty()) {
      const size = image.getSize()
      const scale = Math.min(1, IMAGE_MAX / Math.max(size.width, size.height))
      const thumb =
        scale < 1
          ? image.resize({
              width: Math.max(1, Math.round(size.width * scale)),
              height: Math.max(1, Math.round(size.height * scale))
            })
          : image
      return {
        kind: 'image',
        name,
        path,
        dataUrl: thumb.toDataURL(),
        width: size.width,
        height: size.height,
        bytes: stat.size
      }
    }
  }

  if (PDF_EXTS.includes(ext)) {
    return { kind: 'pdf', name, path, url: fileUrl, bytes: stat.size }
  }

  if (VIDEO_EXTS.includes(ext) || AUDIO_EXTS.includes(ext)) {
    return {
      kind: 'media',
      name,
      path,
      url: fileUrl,
      media: VIDEO_EXTS.includes(ext) ? 'video' : 'audio',
      bytes: stat.size
    }
  }

  if (TEXT_EXTS.includes(ext) || stat.size <= 64 * 1024) {
    try {
      const head = readHead(path, TEXT_LIMIT)
      if (isTextLike(head.subarray(0, 2048))) {
        return {
          kind: 'text',
          name,
          path,
          text: head.toString('utf8'),
          truncated: stat.size > TEXT_LIMIT,
          bytes: stat.size
        }
      }
    } catch {
      // 读失败（权限 / 编码）就走下面的文件信息
    }
  }

  // 剩下的是 Chromium 不认识的文档格式，借系统 Quick Look 出首页图（Word / Pages / 字体…）
  if (QL_EXTS.includes(ext) && stat.size <= QL_MAX_BYTES) {
    const dataUrl = await quickLookThumb(path, stat)
    if (dataUrl) return { kind: 'thumb', name, path, dataUrl, bytes: stat.size, ext }
  }

  return {
    kind: 'info',
    name,
    path,
    bytes: stat.size,
    modified: stat.mtime.toISOString(),
    ext,
    isDir: false,
    entries: 0
  }
}

/**
 * 搜索窗空格预览。
 * 优先级：图片/PDF/音视频用 Chromium 自己渲染（可交互），
 * Office 等文档调系统 Quick Look 出首页图，其余落到文件信息卡；
 * 片段取正文，应用只展示路径（macOS 侧拿不到稳定的大图标）。
 */
/**
 * 用系统 Quick Look 面板（Finder 里空格弹出的那个）打开文件。
 * 面板由系统的 qlmanage 进程渲染，只会以独立浮层出现，无法嵌进我们的窗口，
 * 这也是"空格即系统预览"的实现方式。
 * 返回 false 表示这台机器上调不起来（非 macOS / qlmanage 失败），调用方回退内嵌预览。
 */
let quickLookChild: ChildProcess | null = null

ipcMain.handle('preview:quicklook', (_event: IpcMainInvokeEvent, path: string): Promise<boolean> => {
  if (process.platform !== 'darwin' || !path || !existsSync(path)) return Promise.resolve(false)
  try {
    quickLookChild?.kill()
  } catch {
    // 上一个预览窗口已经自己关掉了
  }

  return new Promise((resolve) => {
    let settled = false
    let timer: NodeJS.Timeout | undefined
    const settle = (value: boolean): void => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve(value)
    }

    let child: ChildProcess
    try {
      child = spawn('/usr/bin/qlmanage', ['-p', path], { stdio: 'ignore' })
      // 只 unref，不 detach：既能检查退出时机（预览窗口关闭），又不会拖住应用退出
      child.unref()
    } catch (error) {
      console.error('打开系统预览失败', error)
      return settle(false)
    }
    quickLookChild = child

    // 400ms 还活着就认为面板已经弹出来了；期间退出且非 0 视为失败
    timer = setTimeout(() => settle(true), 400)

    child.on('error', () => settle(false))
    child.on('exit', (code) => {
      // 还没到 400ms 就退出：只有正常退出才算成功（某些系统上 qlmanage 会转交后立即返回）
      settle((code ?? 0) === 0)
      if (quickLookChild !== child) return
      quickLookChild = null
      // 系统预览窗口关掉后把焦点还给搜索窗，方便接着输入
      if (!app.isReady()) return
      app.focus({ steal: true })
      const win = findWindow('search')
      if (win && !win.isDestroyed() && win.isVisible()) win.focus()
    })
  })
})

ipcMain.handle(
  'preview:item',
  async (_event: IpcMainInvokeEvent, target: SearchPreviewTarget): Promise<SearchPreviewType | null> => {
    try {
      if (!target) return null
      if (target.kind === 'app') {
        return { kind: 'app', name: target.name || basename(target.path), path: target.path }
      }
      if (target.kind === 'snippet') {
        const row = findOne('select title, content from contents where id = @id', {
          id: target.id
        }) as { title: string; content: string } | undefined
        if (!row) return null
        const text = row.content ?? ''
        return {
          kind: 'snippet',
          title: row.title,
          text: text.slice(0, TEXT_LIMIT),
          truncated: text.length > TEXT_LIMIT
        }
      }
      if (target.kind === 'file' && target.path) return previewFile(target.path)
      return null
    } catch (error) {
      console.error('生成预览失败', error)
      return null
    }
  }
)
