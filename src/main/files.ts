import { dialog, ipcMain, IpcMainInvokeEvent, shell } from 'electron'
import { promises as fsp } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { pinyin } from 'pinyin-pro'
import { config } from './db/query'
import { getByNameWindow } from './windows'

/** 搜索结果最多返回条数 */
const MAX_RESULTS = 6

/** 递归扫描深度上限：够覆盖常用目录，又不会把整块硬盘翻一遍 */
const MAX_DEPTH = 4

/** 扫描条目总量上限，防止配置了超大目录（如整个家目录）把内存吃满 */
const MAX_ENTRIES = 30000

/** 扫描缓存有效期：5 分钟后下次搜索会自动重建 */
const CACHE_TTL = 5 * 60 * 1000

/** 跳过的目录名：依赖目录 / 系统垃圾，对"找文件"没有价值还拖慢扫描 */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.Trash',
  'Library',
  'venv',
  '.venv',
  '__pycache__',
  '.cache',
  'dist',
  'build'
])

interface FileEntry {
  name: string
  path: string
  isDir: boolean
  /** 拼音全拼（无声调小写），中文文件名才参与，英文文件名为空串 */
  pinyinFull: string
  /** 拼音首字母，如「项目计划」-> xmjh */
  pinyinInitials: string
}

// 扫描结果缓存在内存：签名（目录列表）或 5 分钟 TTL 过期才重建
let fileCache: FileEntry[] = []
let cacheSignature = ''
let cacheTime = 0
let scanPromise: Promise<void> | null = null

/** 配置里的搜索目录列表（读主进程 config 表） */
const searchDirectories = (): string[] => {
  const dirs = config().searchDirectories
  return Array.isArray(dirs) ? dirs.filter((d) => typeof d === 'string' && d) : []
}

/** 中文名转拼音检索字段（与 apps.ts 的规则一致，但文件名里中英混合很常见） */
const buildPinyinFields = (name: string): { pinyinFull: string; pinyinInitials: string } => {
  if (!/[\u4e00-\u9fa5]/.test(name)) return { pinyinFull: '', pinyinInitials: '' }
  const pinyinFull = pinyin(name, { toneType: 'none', type: 'array', v: true })
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  const pinyinInitials = pinyin(name, { pattern: 'first', toneType: 'none', type: 'array', v: true })
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return { pinyinFull, pinyinInitials }
}

/** 递归扫一个目录：限制深度、跳过隐藏/依赖目录、条目超限即停 */
const walkDir = async (dir: string, depth: number, entries: FileEntry[]): Promise<void> => {
  if (depth > MAX_DEPTH || entries.length >= MAX_ENTRIES) return

  let dirents
  try {
    dirents = await fsp.readdir(dir, { withFileTypes: true })
  } catch {
    // 无权限 / 已删除的目录直接跳过
    return
  }

  for (const dirent of dirents) {
    if (entries.length >= MAX_ENTRIES) return
    if (dirent.name.startsWith('.')) continue

    const fullPath = join(dir, dirent.name)
    if (dirent.isDirectory()) {
      if (SKIP_DIRS.has(dirent.name)) continue
      entries.push({ ...wrapEntry(dirent.name, fullPath, true), ...buildPinyinFields(dirent.name) })
      await walkDir(fullPath, depth + 1, entries)
    } else if (dirent.isFile()) {
      entries.push({ ...wrapEntry(dirent.name, fullPath, false), ...buildPinyinFields(dirent.name) })
    }
  }
}

/** 拆出来避免和 buildPinyinFields 展开顺序混淆：先定基础字段 */
const wrapEntry = (name: string, path: string, isDir: boolean) => ({
  name,
  path,
  isDir,
  pinyinFull: '',
  pinyinInitials: ''
})

/** 扫描全部配置目录并缓存；签名 / TTL 未过期时直接复用 */
const ensureScanned = (): Promise<void> => {
  const signature = searchDirectories().join('\n')
  const expired = Date.now() - cacheTime > CACHE_TTL

  if (scanPromise && signature === cacheSignature && !expired) return scanPromise
  if (!signature) {
    fileCache = []
    cacheSignature = signature
    cacheTime = Date.now()
    scanPromise = Promise.resolve()
    return scanPromise
  }

  cacheSignature = signature
  cacheTime = Date.now()
  scanPromise = (async () => {
    const entries: FileEntry[] = []
    for (const dir of searchDirectories()) {
      const expanded = dir.startsWith('~') ? join(homedir(), dir.slice(1)) : dir
      // 目录本身也作为一条结果（搜"项目"时能看到项目文件夹本身）
      const base = basename(expanded) || expanded
      entries.push({ name: base, path: expanded, isDir: true, ...buildPinyinFields(base) })
      await walkDir(expanded, 1, entries)
    }
    fileCache = entries
  })()
  return scanPromise
}

/** 文件名与关键词的相关度（越小越靠前），复用应用搜索的分层逻辑 */
const relevance = (item: FileEntry, keyword: string): number => {
  const lowerName = item.name.toLowerCase()
  const compactName = lowerName.replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
  if (lowerName === keyword || compactName === keyword) return 0
  if (lowerName.startsWith(keyword) || compactName.startsWith(keyword)) return 1
  if (item.pinyinFull && (item.pinyinFull === keyword || item.pinyinFull.startsWith(keyword))) return 2
  if (keyword.length >= 2 && item.pinyinInitials && item.pinyinInitials.startsWith(keyword)) return 3
  if (lowerName.includes(keyword) || compactName.includes(keyword)) return 4
  if (item.pinyinFull && item.pinyinFull.includes(keyword)) return 5
  if (keyword.length >= 2 && item.pinyinInitials && item.pinyinInitials.includes(keyword)) return 6
  return Number.POSITIVE_INFINITY
}

const searchFiles = async (keyword: string): Promise<FileType[]> => {
  const keywordTrimmed = keyword.trim().toLowerCase()
  if (!keywordTrimmed || !searchDirectories().length) return []

  await ensureScanned()

  return fileCache
    .map((item) => ({ item, score: relevance(item, keywordTrimmed) }))
    .filter((entry) => entry.score !== Number.POSITIVE_INFINITY)
    .sort(
      (a, b) =>
        a.score - b.score ||
        Number(b.item.isDir) - Number(a.item.isDir) ||
        a.item.name.localeCompare(b.item.name, 'zh-Hans-CN')
    )
    .slice(0, MAX_RESULTS)
    .map((entry) => ({ name: entry.item.name, path: entry.item.path, isDir: entry.item.isDir }))
}

ipcMain.handle('files:search', (_event: IpcMainInvokeEvent, keyword: string) => {
  return searchFiles(typeof keyword === 'string' ? keyword : '')
})

/** 打开文件（默认应用）或文件夹（Finder）；失败时在 Finder 中显示兜底 */
ipcMain.handle('files:open', async (_event: IpcMainInvokeEvent, path: string) => {
  if (typeof path !== 'string' || !path) return false
  const error = await shell.openPath(path)
  if (error) {
    console.error('打开文件失败', path, error)
    shell.showItemInFolder(path)
  }
  const win = getByNameWindow('search')
  if (!win.isDestroyed()) win.hide()
  return true
})

/** 设置页「添加目录」：弹出系统目录选择框 */
ipcMain.handle('files:selectDir', async (_event: IpcMainInvokeEvent) => {
  const result = await dialog.showOpenDialog({
    title: '选择要搜索的目录',
    properties: ['openDirectory']
  })
  if (result.canceled || !result.filePaths.length) return ''
  return result.filePaths[0]
})

// 目录配置变化后由设置页调用，下次搜索强制重扫
ipcMain.on('files:invalidate', () => {
  cacheSignature = ''
  scanPromise = null
})
