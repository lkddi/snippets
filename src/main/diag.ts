import { app } from 'electron'
import { appendFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 轻量诊断日志：出问题时用户不用开终端，日志就在
 * userData/lingxi.log（macOS: ~/Library/Application Support/snippets/lingxi.log）。
 *
 * 只记录"窗口为什么没出现"这类只能靠现场数据判断的事件：
 * 快捷键触发、show/hide 前后的 isVisible/isFocused、渲染进程崩溃。
 * 上限 512KB，超了就清空重写，绝不无限增长。
 */
const MAX_BYTES = 512 * 1024
let logPath = ''

const path = (): string => {
  if (!logPath) logPath = join(app.getPath('userData'), 'lingxi.log')
  return logPath
}

export const diag = (tag: string, data?: unknown): void => {
  try {
    const file = path()
    try {
      if (statSync(file).size > MAX_BYTES) writeFileSync(file, '')
    } catch {
      // 文件还不存在，正常
    }
    const payload = data === undefined ? '' : ` ${JSON.stringify(data)}`
    appendFileSync(file, `[${new Date().toISOString()}] ${tag}${payload}\n`)
  } catch {
    // 日志失败绝不能影响主流程
  }
}

export const diagPath = path
