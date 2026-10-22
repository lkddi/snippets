import { clipboard, ipcMain } from 'electron'
import { exec } from 'node:child_process'
import { findWindow } from './windows'

/**
 * 唤起浮层（搜索窗 / 剪贴板面板）前记录的最前台应用名：
 * 粘贴时要把它调回前台再 Cmd+V，否则面板隐藏后焦点未就绪，
 * 内容会粘到错误目标或直接丢失
 */
let frontmostAppBeforeShow = ''

/** 在浮层窗口 show() 之前调用，记录当前最前台应用 */
export const captureFrontmostApp = (): void => {
  if (process.platform !== 'darwin') return
  exec(
    `osascript -e 'tell application "System Events" to name of first application process whose frontmost is true'`,
    (error, stdout) => {
      if (error) return
      frontmostAppBeforeShow = stdout.trim()
    }
  )
}

/**
 * 隐藏浮层后调用：把唤起前记录的应用调回前台并模拟 Cmd+V（需要辅助功能权限）。
 * 失败时静默降级为仅写回剪贴板，用户手动 Cmd+V 即可
 */
export const pasteBackToFrontApp = (): void => {
  if (process.platform !== 'darwin') return
  const appName = frontmostAppBeforeShow.replace(/["\\]/g, '')
  const script = [
    'delay 0.15',
    'tell application "System Events"',
    appName
      ? `set frontmost of (first application process whose name is "${appName}") to true`
      : null,
    'delay 0.1',
    'keystroke "v" using command down',
    'end tell'
  ]
    .filter(Boolean)
    .join('\n')
  exec(`osascript <<'AS'
${script}
AS`, (error) => {
    if (error) console.error('自动粘贴失败，内容已写回剪贴板', error)
  })
}

/**
 * 搜索窗选中片段回车：内容写回剪贴板 → 收起搜索窗 → 粘回唤起前的光标处。
 * 与 clipboard:paste 同一套回填逻辑；副作用是会覆盖当前剪贴板内容
 */
ipcMain.handle('snippet:paste', (_event, content: string) => {
  if (typeof content !== 'string' || !content.trim()) return false
  clipboard.writeText(content)
  const win = findWindow('search')
  if (win && !win.isDestroyed()) win.hide()
  pasteBackToFrontApp()
  return true
})
