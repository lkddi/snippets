import { dialog, ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import * as query from './query'
import { setMainConfig, getMainConfig } from './config'
import { initTable } from './tables'
import { reopenDb } from './connect'

const ACTIONS: SqlActionType[] = [
  'findAll',
  'findOne',
  'insert',
  'update',
  'del',
  'config',
  'deleteCategory'
]

ipcMain.handle(
  'sql',
  (_event: IpcMainInvokeEvent, sql: string, type: SqlActionType, params = {}) => {
    // 渲染进程可以随意传 type / sql，这里至少把 type 限制在已知动作内
    if (!ACTIONS.includes(type)) {
      throw new Error(`不支持的 SQL 操作类型: ${type}`)
    }
    try {
      const action = query[type] as (sql: string, params?: Record<string, any>) => unknown
      return action(sql, params)
    } catch (error) {
      console.error(`[sql:${type}] ${sql}`, error)
      throw error
    }
  }
)

ipcMain.handle('selectDatabaseDirectory', async () => {
  const res = await dialog.showOpenDialog({
    title: '选择目录',
    properties: ['openDirectory', 'createDirectory']
  })
  return res.canceled ? '' : res.filePaths[0]
})

ipcMain.on('setDatabaseDirectory', (_event: IpcMainEvent, path: string) => {
  const directory = typeof path === 'string' ? path.trim() : ''
  if (!directory) return
  // 目录没变就不要重开连接
  if (directory === getMainConfig().databaseDirectory) return

  // 目录持久化在主进程，避免 localStorage 被清空后静默回落到桌面数据库
  setMainConfig({ databaseDirectory: directory })
  try {
    reopenDb()
    initTable()
  } catch (error) {
    console.error('切换数据库目录失败', error)
  }
})

ipcMain.on('initTable', () => {
  try {
    initTable()
  } catch (error) {
    console.error('初始化数据表失败', error)
  }
})
