import { app, ipcMain, shell } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** 本仓库最新 Release 的 GitHub API 与兜底跳转页 */
const RELEASES_API = 'https://api.github.com/repos/lkddi/snippets/releases/latest'
const RELEASE_PAGE = 'https://github.com/lkddi/snippets/releases/latest'

/** 作者信息：说明页展示用 */
const AUTHOR_INFO = {
  name: 'lkddi',
  blog: 'https://ay.lc',
  repo: 'https://github.com/lkddi/snippets'
}

interface LatestRelease {
  version: string
  url: string
}

/** 拉取 GitHub 最新 Release；网络不通 / 被墙 / 限流时返回 null，由渲染层展示失败态 */
const fetchLatestRelease = async (): Promise<LatestRelease | null> => {
  try {
    const res = await fetch(RELEASES_API, {
      headers: { 'User-Agent': 'snippets-app', Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(6000)
    })
    if (!res.ok) return null
    const data = (await res.json()) as { tag_name?: string; html_url?: string }
    if (!data.tag_name) return null
    return { version: data.tag_name.replace(/^v/, ''), url: data.html_url || RELEASE_PAGE }
  } catch {
    return null
  }
}

/**
 * 读取应用自身版本：打包态 app.getVersion() 读 asar 内 package.json 没问题，
 * 但直接 `electron out/main` 跑时会返回 Electron 本体版本（如 28.2.7）。
 * main 打包后位于 <asar>/out/main，向上两级正好是应用的 package.json；
 * 开发态 __dirname = 项目/out/main，向上两级是项目根的 package.json，同样正确
 */
const readAppVersion = (): string => {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8')) as {
      version?: string
    }
    if (pkg.version) return pkg.version
  } catch {
    // 读不到时退回 app.getVersion()（打包态仍然正确）
  }
  return app.getVersion()
}

ipcMain.handle('about:info', async (): Promise<AboutInfoType> => {
  const currentVersion = readAppVersion()
  const latest = await fetchLatestRelease()
  return {
    currentVersion,
    latestVersion: latest?.version ?? '',
    releaseUrl: latest?.url ?? RELEASE_PAGE,
    hasUpdate: Boolean(latest) && latest!.version !== currentVersion,
    fetchFailed: !latest,
    author: AUTHOR_INFO
  }
})

/** 打开外部链接：只放行 http/https，防止渲染层传任意协议 */
ipcMain.handle('about:openUrl', (_event, url: string): boolean => {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return false
  void shell.openExternal(url)
  return true
})
