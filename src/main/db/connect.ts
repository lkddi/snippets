import Database, * as BetterSqlite3 from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getMainConfig } from './config'

/** 单例连接：之前每次查询都会 new 一个连接且从不关闭，造成句柄泄漏与 SQLITE_BUSY */
let connection: BetterSqlite3.Database | null = null
let connectionFile = ''

const DB_FILE_NAME = 'hd.db'

const resolveDirectory = (): string => {
  const custom = getMainConfig().databaseDirectory
  if (custom && existsSync(custom)) return custom

  const desktop = app.getPath('desktop')
  if (desktop && existsSync(desktop)) return desktop

  // 桌面被删除 / 被 iCloud 接管时兜底，避免直接抛错
  const userData = app.getPath('userData')
  if (!existsSync(userData)) mkdirSync(userData, { recursive: true })
  return userData
}

const open = (): BetterSqlite3.Database => {
  const directory = resolveDirectory()
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true })

  const file = join(directory, DB_FILE_NAME)
  const database = new Database(file)
  database.pragma('journal_mode = WAL')
  database.pragma('busy_timeout = 5000')

  connection = database
  connectionFile = file
  return database
}

export const db = (): BetterSqlite3.Database => {
  if (connection && connection.open) return connection
  return open()
}

export const getDatabaseFile = (): string => {
  db()
  return connectionFile
}

export const closeDb = (): void => {
  if (connection && connection.open) connection.close()
  connection = null
}

/** 切换数据库目录后重新打开连接 */
export const reopenDb = (): BetterSqlite3.Database => {
  closeDb()
  return open()
}
