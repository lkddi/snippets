import { ipcMain, IpcMainInvokeEvent, nativeImage } from 'electron'
import { closeSync, existsSync, openSync, readSync, readdirSync, statSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { findOne } from './db/query'

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

const previewFile = (path: string): SearchPreviewType | null => {
  if (!existsSync(path)) return null
  const name = basename(path)
  const stat = statSync(path)
  const ext = extname(path).slice(1).toLowerCase()

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
 * 文件按类型分三路：图片出缩略图、文本/代码出正文、其余出大小与修改时间；
 * 片段取正文，应用只展示路径（macOS 侧拿不到稳定的大图标）。
 */
ipcMain.handle(
  'preview:item',
  (_event: IpcMainInvokeEvent, target: SearchPreviewTarget): SearchPreviewType | null => {
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
