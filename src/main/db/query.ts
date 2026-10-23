import { db } from './connect'
import { DEFAULT_WEB_ENGINES, normalizeEngines } from '../webEngines'

type ParamsType = Record<string, any>

export const findAll = (sql: string, params: ParamsType = {}) => {
  return db().prepare(sql).all(params)
}

export const findOne = (sql: string, params: ParamsType = {}) => {
  return db().prepare(sql).get(params)
}

export const insert = (sql: string, params: ParamsType = {}) => {
  return db().prepare(sql).run(params).lastInsertRowid
}

export const update = (sql: string, params: ParamsType = {}) => {
  return db().prepare(sql).run(params).changes
}

export const del = (sql: string, params: ParamsType = {}) => {
  return db().prepare(sql).run(params).changes
}

/** 删除分类并把其下片段移到"未分类"，两条语句必须处于同一事务 */
export const deleteCategory = (_sql: string, params: { id: number | string }) => {
  const database = db()
  const detach = database.prepare('update contents set category_id = 0 where category_id = @id')
  const remove = database.prepare('delete from categories where id = @id')

  const transaction = database.transaction((id: number | string) => {
    detach.run({ id })
    return remove.run({ id }).changes
  })

  return transaction(params.id)
}

export const config = (): ConfigDataType => {
  const fallback: ConfigDataType = {
    shortCut: '',
    databaseDirectory: '',
    clipboardShortCut: 'doubleOption',
    clipboardRetentionDays: 7,
    launchAtLogin: false,
    hideDockIcon: false,
    webSearchEngine: 'baidu',
    webEngines: DEFAULT_WEB_ENGINES,
    searchDirectories: [],
    appShortCuts: [],
    language: 'system'
  }
  const row = findOne('select * from config where id = 1') as { content: string } | undefined
  if (!row?.content) return fallback
  try {
    const parsed = JSON.parse(row.content) as Partial<ConfigDataType>
    // 老版本配置里没有 webEngines，这里补上内置清单并做一次清洗
    return { ...fallback, ...parsed, webEngines: normalizeEngines(parsed.webEngines) }
  } catch (error) {
    console.error('配置内容解析失败', error)
    return fallback
  }
}
