/**
 * 网页搜索：支持「关键字 + 关键词」触发指定引擎（github snippets、jd 机械键盘…），
 * 没有关键字时用设置里的默认引擎。
 */
import { ipcMain, IpcMainInvokeEvent, shell } from 'electron'
import { config } from './db/query'
import { buildSearchUrl, DEFAULT_WEB_ENGINES } from './webEngines'
import { getByNameWindow } from './windows'

const engines = (): WebEngineType[] => {
  const list = config().webEngines
  return Array.isArray(list) && list.length ? list : DEFAULT_WEB_ENGINES
}

/** 默认引擎：配置里指定但被停用时，退回第一个启用的引擎 */
const defaultEngine = (list: WebEngineType[]): WebEngineType => {
  const enabled = list.filter((engine) => engine.enabled)
  const configured = enabled.find((engine) => engine.id === config().webSearchEngine)
  return configured ?? enabled[0] ?? DEFAULT_WEB_ENGINES[0]
}

/**
 * 解析搜索词：命中「关键字 + 空格 + 关键词」时切到对应引擎并去掉关键字前缀。
 * 只匹配已启用的引擎，且关键字后必须是空格，避免把 githubabc 当成 github 搜索。
 */
export const resolveWebTarget = (
  rawQuery: string
): { engine: string; engineName: string; query: string } => {
  const list = engines()
  const query = String(rawQuery ?? '').trim()
  const enabled = list.filter((engine) => engine.enabled)

  const lower = query.toLowerCase()
  const matched = enabled.find((engine) => {
    const keyword = engine.keyword.toLowerCase()
    return lower.startsWith(`${keyword} `)
  })

  if (matched) {
    const term = query.slice(matched.keyword.length).trim()
    if (term) return { engine: matched.id, engineName: matched.name, query: term }
  }

  const fallback = defaultEngine(list)
  return { engine: fallback.id, engineName: fallback.name, query }
}

ipcMain.handle('web:resolve', (_event: IpcMainInvokeEvent, query: string) =>
  resolveWebTarget(typeof query === 'string' ? query : '')
)

/** 引擎列表（含停用项），设置页与搜索框共用 */
ipcMain.handle('web:engines', () => engines())

/**
 * 打开网页搜索：未知引擎回落默认引擎，避免拼出非法 URL。
 * 成功后收起搜索窗，把焦点还给用户。
 */
ipcMain.handle('web:open', (_event: IpcMainInvokeEvent, engineId: string, query: string) => {
  const list = engines()
  const engine = list.find((item) => item.id === engineId) ?? defaultEngine(list)
  const keyword = String(query ?? '').trim()
  void shell.openExternal(buildSearchUrl(engine.url, keyword))

  const win = getByNameWindow('search')
  if (!win.isDestroyed()) win.hide()
  return true
})
