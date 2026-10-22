import { ipcMain, IpcMainInvokeEvent, shell } from 'electron'
import { getByNameWindow } from './windows'

/** 各搜索引擎的检索 URL 模板，{q} 会被替换为 URL 编码后的关键词 */
const ENGINE_TEMPLATES: Record<string, string> = {
  baidu: 'https://www.baidu.com/s?wd={q}',
  google: 'https://www.google.com/search?q={q}',
  bing: 'https://www.bing.com/search?q={q}',
  duckduckgo: 'https://duckduckgo.com/?q={q}'
}

/**
 * 打开网页搜索：未知引擎回落百度，避免拼出非法 URL。
 * 成功后收起搜索窗，把焦点还给用户。
 */
ipcMain.handle('web:open', (_event: IpcMainInvokeEvent, engine: string, query: string) => {
  const template = ENGINE_TEMPLATES[engine] ?? ENGINE_TEMPLATES.baidu
  const url = template.replace('{q}', encodeURIComponent(String(query ?? '')).replace(/%20/g, '+'))
  void shell.openExternal(url)

  const win = getByNameWindow('search')
  if (!win.isDestroyed()) win.hide()
  return true
})
