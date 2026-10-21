import { app, ipcMain, IpcMainInvokeEvent, shell } from 'electron'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { pinyin } from 'pinyin-pro'
import { getByNameWindow } from './windows'

const execFileAsync = promisify(execFile)

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
  /** 本地化中文名（来自 zh_CN.lproj / Info.plist），读不到为空字符串，如 WeChat -> 微信 */
  nameZh: string
  /** Info.plist 里的图标文件名（CFBundleIconFile / CFBundleIconName） */
  iconFile: string
  /** 各名称的拼音全拼（无声调小写），如「微信」-> weixin、「WeChat」-> wechat */
  pinyinFull: string[]
  /** 各名称的拼音首字母，如「微信」-> wx、「Visual Studio Code」-> vsc */
  pinyinInitials: string[]
}

// 应用列表与图标都缓存在内存：应用启动时扫描一次，
// 之后复用结果，避免每敲一个字都遍历 /Applications
let appCache: AppEntry[] = []
let scanPromise: Promise<void> | null = null
const iconCache = new Map<string, string>()

/**
 * 生成名称的拼音检索字段：
 * - 中文（或中英混合）：全拼 weixin + 首字母 wx
 * - 纯英文：紧凑小写原名 + 单词首字母缩写（如 Visual Studio Code -> vsc）
 */
const buildPinyinFields = (name: string): { pinyinFull: string; pinyinInitials: string } => {
  const hasChinese = /[\u4e00-\u9fa5]/.test(name)
  if (hasChinese) {
    // v: true 让「微信 pinyinWeixin」这类混合名里的英文也转成可检索的拼音字母
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
  const lower = name.toLowerCase()
  // 英文名按空格/分隔符取首字母缩写，支持 vsc -> Visual Studio Code 的模糊匹配
  const pinyinInitials = lower
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
  return { pinyinFull: lower.replace(/[^a-z0-9]/g, ''), pinyinInitials }
}

/** 跳过 Helper / Agent / Updater 等附属 app，避免结果里出现一堆 XX Helper */
const isMainApp = (fileName: string): boolean =>
  fileName.endsWith('.app') && !/(helper|agent|updater|uninstall)/i.test(fileName)

/** 扫描各应用目录的顶层 .app 包（只读文件名，速度极快；中文名随后异步补齐） */
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
      const name = fileName.replace(/\.app$/i, '')
      const fields = buildPinyinFields(name)
      apps.push({
        name,
        path: join(dir, fileName),
        nameZh: '',
        iconFile: '',
        pinyinFull: [fields.pinyinFull],
        pinyinInitials: [fields.pinyinInitials]
      })
    }
  }
  return apps
}

/** 名称规范化后比较，用于判断本地化名是否与文件名重复 */
const normalizeName = (name: string): string => name.toLowerCase().replace(/[\s.]/g, '')

/**
 * 读取 .app 的本地化中文名：
 * 1. Contents/Resources/zh*.lproj/InfoPlist.strings（真正中文显示名，如 Calculator -> 计算器）
 * 2. 回退 Contents/Info.plist 的 CFBundleDisplayName / CFBundleName
 * 全部用系统自带 plutil 转成 JSON 解析，避免引第三方 plist 库
 */
const readBundleInfo = async (
  appPath: string
): Promise<{ zhName: string; iconFile: string }> => {
  try {
    const resourcesDir = join(appPath, 'Contents', 'Resources')
    const zhLproj = existsSync(resourcesDir)
      ? readdirSync(resourcesDir).find((entry) => /^zh(_CN|[-_]Hans(CN)?)?\.lproj$/i.test(entry))
      : undefined
    let zhName = ''
    if (zhLproj) {
      const stringsPath = join(resourcesDir, zhLproj, 'InfoPlist.strings')
      if (existsSync(stringsPath)) {
        const { stdout } = await execFileAsync('plutil', ['-convert', 'json', '-o', '-', stringsPath])
        const data = JSON.parse(stdout) as Record<string, string>
        zhName = data.CFBundleDisplayName || data.CFBundleName || ''
      }
    }

    // Info.plist 提供图标文件名，同时兜底中文名
    let iconFile = ''
    if (!zhName || !iconFile) {
      const { stdout } = await execFileAsync('plutil', [
        '-convert',
        'json',
        '-o',
        '-',
        join(appPath, 'Contents', 'Info.plist')
      ])
      const data = JSON.parse(stdout) as Record<string, string>
      if (!zhName) zhName = data.CFBundleDisplayName || data.CFBundleName || ''
      iconFile = data.CFBundleIconFile || data.CFBundleIconName || ''
    }
    return { zhName, iconFile }
  } catch {
    // 没有中文名 / 图标信息 / plist 损坏都无所谓，各有兜底
    return { zhName: '', iconFile: '' }
  }
}

/**
 * 为所有应用补齐本地化中文名 / 图标文件名，并把中文名的拼音字段合并进检索集合。
 * 并行执行，全部完成后中文名搜索才可用；因此应用启动时预跑一遍。
 */
const enrichBundleInfo = async (apps: AppEntry[]): Promise<void> => {
  await Promise.all(
    apps.map(async (item) => {
      const { zhName, iconFile } = await readBundleInfo(item.path)
      item.iconFile = iconFile
      if (!zhName) return
      item.nameZh = zhName
      // 中文名与文件名实质相同（如 wpsoffice -> WPS Office）就不重复收录拼音
      if (normalizeName(zhName) === normalizeName(item.name)) return
      const fields = buildPinyinFields(zhName)
      item.pinyinFull.push(fields.pinyinFull)
      item.pinyinInitials.push(fields.pinyinInitials)
    })
  )
}

/** 首次搜索 / 启动时扫盘 + 补中文名，结果缓存复用 */
const ensureScanned = (): Promise<void> => {
  if (!scanPromise) {
    scanPromise = (async () => {
      appCache = scanApps()
      await enrichBundleInfo(appCache)
    })()
  }
  return scanPromise
}

/**
 * 单个名称与关键词的相关度权重（越小越靠前）：
 * 0 完全匹配 > 1 前缀匹配 > 2 拼音全拼完全/前缀 > 3 首字母前缀
 * > 4 包含 > 5 拼音全拼包含 > 6 首字母包含
 */
const nameRelevance = (name: string, pinyinFull: string, pinyinInitials: string, keyword: string): number => {
  const lowerName = name.toLowerCase()
  const compactName = lowerName.replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
  if (lowerName === keyword || compactName === keyword) return 0
  if (lowerName.startsWith(keyword) || compactName.startsWith(keyword)) return 1
  if (pinyinFull === keyword || pinyinFull.startsWith(keyword)) return 2
  if (keyword.length >= 2 && pinyinInitials.startsWith(keyword)) return 3
  if (lowerName.includes(keyword) || compactName.includes(keyword)) return 4
  if (pinyinFull.includes(keyword)) return 5
  if (keyword.length >= 2 && pinyinInitials.includes(keyword)) return 6
  return Number.POSITIVE_INFINITY
}

/** 应用与关键词的相关度：文件名 / 中文名 / 各拼音字段取最优 */
const relevance = (item: AppEntry, keyword: string): number => {
  let best = nameRelevance(item.name, item.pinyinFull[0] ?? '', item.pinyinInitials[0] ?? '', keyword)
  if (item.nameZh) {
    // 中文名的拼音字段在数组尾部，倒序取最后一个
    const zhFull = item.pinyinFull[item.pinyinFull.length - 1] ?? ''
    const zhInitials = item.pinyinInitials[item.pinyinInitials.length - 1] ?? ''
    best = Math.min(best, nameRelevance(item.nameZh, zhFull, zhInitials, keyword))
  }
  return best
}

/**
 * 从 .app 包内直接提取真实图标：
 * 1. Contents/Resources/<CFBundleIconFile>.icns 用系统 sips 转 64px PNG
 * 2. 失败时回退 app.getFileIcon（部分环境下只给通用占位图）
 */
const extractBundleIcon = async (appPath: string, iconFile: string): Promise<string> => {
  if (!iconFile) return ''
  const icnsPath = join(
    appPath,
    'Contents',
    'Resources',
    iconFile.endsWith('.icns') ? iconFile : `${iconFile}.icns`
  )
  if (!existsSync(icnsPath)) return ''

  const tmpPng = join(tmpdir(), `snippets-icon-${process.pid}-${Math.random().toString(36).slice(2)}.png`)
  try {
    // -Z 64 限制最长边 64px，结果列表 30px 展示在 retina 下也足够清晰
    await execFileAsync('sips', ['-s', 'format', 'png', '-Z', '64', icnsPath, '--out', tmpPng])
    const png = await readFile(tmpPng)
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    return ''
  } finally {
    rmSync(tmpPng, { force: true })
  }
}

const loadIcon = async (path: string, iconFile: string): Promise<string> => {
  const cached = iconCache.get(path)
  if (cached) return cached

  // 首选：包内 icns 直读，保证是「原软件的图标」
  let dataUrl = ''
  try {
    dataUrl = await extractBundleIcon(path, iconFile)
  } catch (error) {
    console.error('提取应用图标失败', path, error)
  }

  // 兜底：Electron 图标服务（个别环境只返回通用占位图，可接受）
  if (!dataUrl) {
    try {
      const image = await app.getFileIcon(path, { size: 'normal' })
      if (!image.isEmpty()) dataUrl = image.toDataURL()
    } catch (error) {
      console.error('读取应用图标失败', path, error)
    }
  }

  if (dataUrl) iconCache.set(path, dataUrl)
  return dataUrl
}

const searchApps = async (keyword: string): Promise<AppType[]> => {
  const keywordTrimmed = keyword.trim().toLowerCase()
  if (!keywordTrimmed) return []

  // 应用启动时已预扫；这里兜底等待（冷启动后第一次搜索会稍慢一次）
  await ensureScanned()

  const matched = appCache
    .map((item) => ({ item, score: relevance(item, keywordTrimmed) }))
    .filter((entry) => entry.score !== Number.POSITIVE_INFINITY)
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.item.name.localeCompare(b.item.name, 'zh-Hans-CN')
    )
    .slice(0, MAX_RESULTS)
    .map((entry) => entry.item)

  // 图标是异步取的，等全部加载完一次性返回；附带中文名/拼音供副标题展示
  return Promise.all(
    matched.map(async (item) => ({
      name: item.name,
      path: item.path,
      icon: await loadIcon(item.path, item.iconFile),
      pinyin: item.nameZh ? undefined : item.pinyinFull[0],
      alias: item.nameZh && item.nameZh !== item.name ? item.nameZh : undefined
    }))
  )
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
  scanPromise = null
  iconCache.clear()
  return ensureScanned()
})

// 应用启动即预扫盘并补齐中文名，用户第一次搜索时结果就是全的
void app.whenReady().then(() => {
  void ensureScanned()
})
