import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 主进程侧配置（只保存"启动前就必须知道"的信息）
 * 数据库目录不能存在数据库自身里，否则会陷入"先有目录还是先有库"的死循环，
 * 因此单独持久化到 userData 目录，避免被渲染进程 localStorage 清空后回落到桌面。
 */
interface MainConfig {
  databaseDirectory: string
  /** 是否已完成首次初始化（用于只灌一次演示数据） */
  initialized?: boolean
}

const defaultConfig: MainConfig = {
  databaseDirectory: '',
  initialized: false
}

let cache: MainConfig | null = null

const configFile = (): string => join(app.getPath('userData'), 'snippets-config.json')

export const getMainConfig = (): MainConfig => {
  if (cache) return cache
  let next: MainConfig = { ...defaultConfig }
  try {
    const file = configFile()
    if (existsSync(file)) {
      next = { ...defaultConfig, ...JSON.parse(readFileSync(file, 'utf-8')) }
    }
  } catch (error) {
    console.error('读取主进程配置失败', error)
  }
  cache = next
  return next
}

export const setMainConfig = (patch: Partial<MainConfig>): MainConfig => {
  const next = { ...getMainConfig(), ...patch }
  cache = next
  try {
    writeFileSync(configFile(), JSON.stringify(next, null, 2), 'utf-8')
  } catch (error) {
    console.error('写入主进程配置失败', error)
  }
  return next
}
