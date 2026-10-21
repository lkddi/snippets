import { app, ipcMain, IpcMainInvokeEvent, shell } from 'electron'
import { readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getByNameWindow } from './windows'

/** 最多返回的应用条数，与片段搜索的展示规模保持一致 */
const MAX_RESULTS = 8

/** 参与扫描的应用目录：系统应用、全局安装、用户目录安装 */
const appDirectories = (): string[] => [
  '/Applications',
  '/System/Applications',
  join(homedir(), 'Applications')
]

interface AppEntry {
  name: string
  path: string
}

// 应用列表与图标都缓存在内存：首次搜索时扫描一次，
// 之后复用结果，避免每敲一个字都遍历 /Applications
let appCache: AppEntry[] = []
let scanned = false
const iconCache = new Map<string, string>()

/** 跳过 Helper / Agent / Updater 等附属 app，避免结果里出现一堆 XX Helper */
const isMainApp = (fileName: string): boolean =>
  fileName.endsWith('.app') && !/(helper|agent|updater|uninstall)/i.test(fileName)

/** 扫描各应用目录的顶层 .app 包 */
const scanApps = (): AppEntry[] => {
  const apps: AppEntry[] = []
  for (const dir of appDirectories()) {
    let entries: string[] = []
    try {
      entries = readdirSync(dir)
    } catch {
      // 目录不存在（如用户没有 ~/Applications）直接跳过
      continue
    }
    for (const fileName of entries) {
      if (!isMainApp(fileName)) continue
      apps.push({ name: fileName.replace(/\.app$/i, ''), path: join(dir, fileName) })
    }
  }
  return apps
}

/** 相关度权重：完全匹配 > 前缀匹配 > 包含匹配 */
const relevance = (name: string, keyword: string): number => {
  const lowerName = name.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()
  if (lowerName === lowerKeyword) return 0
  if (lowerName.startsWith(lowerKeyword)) return 1
  return 2
}

/** 读取应用图标并转 dataURL，失败返回空字符串（列表降级为无图标展示） */
const loadIcon = async (path: string): Promise<string> => {
  const cached = iconCache.get(path)
  if (cached) return cached
  try {
    // normal 尺寸为 32x32，在结果列表里展示足够清晰
    const image = await app.getFileIcon(path, { size: 'normal' })
    const dataUrl = image.toDataURL()
    iconCache.set(path, dataUrl)
    return dataUrl
  } catch (error) {
    console.error('读取应用图标失败', path, error)
    return ''
  }
}

const searchApps = async (keyword: string): Promise<AppType[]> => {
  const keywordTrimmed = keyword.trim()
  if (!keywordTrimmed) return []

  // 懒扫描：第一次搜索才扫盘，不拖慢应用启动
  if (!scanned) {
    appCache = scanApps()
    scanned = true
  }

  const matched = appCache
    .filter((item) => item.name.toLowerCase().includes(keywordTrimmed.toLowerCase()))
    .sort(
      (a, b) =>
        relevance(a.name, keywordTrimmed) - relevance(b.name, keywordTrimmed) ||
        a.name.localeCompare(b.name)
    )
    .slice(0, MAX_RESULTS)

  // 图标是异步取的，等全部加载完一次性返回
  return Promise.all(matched.map(async (item) => ({ ...item, icon: await loadIcon(item.path) })))
}

ipcMain.handle('apps:search', (_event: IpcMainInvokeEvent, keyword: string) => {
  return searchApps(typeof keyword === 'string' ? keyword : '')
})

ipcMain.handle('apps:open', async (_event: IpcMainInvokeEvent, path: string) => {
  if (typeof path !== 'string' || !path) return false
  // openPath 成功时返回空字符串，失败时返回错误描述
  const error = await shell.openPath(path)
  if (error) {
    console.error('打开应用失败', path, error)
    return false
  }
  // 启动成功后收起搜索窗，把焦点还给用户正在使用的应用
  const win = getByNameWindow('search')
  if (!win.isDestroyed()) win.hide()
  return true
})

// 应用安装/卸载后触发重扫，同时清掉过期图标缓存
ipcMain.handle('apps:rescan', () => {
  appCache = scanApps()
  scanned = true
  iconCache.clear()
})
