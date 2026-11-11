import { clipboard, ipcMain } from 'electron'
import { exec, execFileSync } from 'node:child_process'
import { findWindow } from './windows'

/**
 * 唤起浮层（搜索窗 / 剪贴板面板）前记录的最前台应用：
 * 粘贴时要把它调回前台再 Cmd+V，否则面板隐藏后焦点未就绪，
 * 内容会粘到错误目标或直接丢失
 */
let frontmostBundleId = ''
let frontmostPid = 0

/**
 * 在浮层窗口 show() 之前调用，同步记录当前最前台应用的 bundleId 与 PID。
 *
 * 必须同步：之前用异步 osascript 查 System Events（单次 200~300ms），
 * 查询返回时面板早已拿到焦点，不仅会记错应用，查询失败时还会一直沿用
 * 上一次的旧值 —— 表现就是"回车粘贴后跳到了毫不相干的应用"。
 * lsappinfo 是 LaunchServices 自带工具，无需自动化权限，两次调用共 ~25ms。
 */
export const captureFrontmostApp = (): void => {
  if (process.platform !== 'darwin') return
  try {
    const asn = execFileSync('lsappinfo', ['front'], { encoding: 'utf8' }).trim()
    if (!asn) throw new Error('lsappinfo front 无返回')
    const info = execFileSync('lsappinfo', ['info', '-only', 'bundleid', '-only', 'pid', asn], {
      encoding: 'utf8'
    })
    const bundleId = info.match(/"CFBundleIdentifier"="([^"]+)"/)?.[1] ?? ''
    const pid = Number(info.match(/"pid"=(\d+)/)?.[1] ?? 0)
    // 最前台是我们自己的窗口（比如从面板里再唤起另一个面板），粘贴回去没有意义
    if (pid === process.pid) {
      frontmostBundleId = ''
      frontmostPid = 0
      return
    }
    frontmostBundleId = bundleId
    frontmostPid = pid
  } catch {
    // 捕获失败就清空，绝不能沿用上一次的旧值（会粘到无关应用）
    frontmostBundleId = ''
    frontmostPid = 0
  }
}

/**
 * 浮层隐藏后调用：把唤起前记录的应用调回前台并模拟 Cmd+V。
 * - 激活用 `open -b <bundleId>`（LaunchServices，无需任何权限，运行中的应用只做激活）
 * - 模拟按键仍走 System Events，需要辅助功能权限；失败时内容已写回剪贴板，手动 Cmd+V 即可
 */
export const pasteBackToFrontApp = (): void => {
  if (process.platform !== 'darwin') return
  if (!frontmostBundleId && !frontmostPid) return

  // 双保险：优先 open -b 按激活；万一失败再试 System Events 按 PID 前置
  const activateByPid = frontmostPid
    ? `tell application "System Events" to set frontmost of (first application process whose unix id is ${frontmostPid}) to true`
    : null
  const script = [
    'delay 0.2',
    frontmostBundleId
      ? `do shell script "open -b ${frontmostBundleId}"`
      : activateByPid,
    'delay 0.15',
    'tell application "System Events" to keystroke "v" using command down'
  ]
    .filter(Boolean)
    .join('\n')

  exec(`osascript <<'AS'
${script}
AS`, (error) => {
    if (error) console.error('自动粘贴失败，内容已写回剪贴板', error)
  })
  // 一次性使用：粘贴完就作废，避免下次唤起失败时误用旧目标
  frontmostBundleId = ''
  frontmostPid = 0
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
