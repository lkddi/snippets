import { pinyin } from 'pinyin-pro'
import { useStore } from '@renderer/store/useStore'
import { ChangeEvent, useEffect, useRef } from 'react'

const SEARCH_DELAY = 150

/** 片段标题的拼音检索缓存：id -> { title, 全拼, 首字母 } */
interface PinyinIndex {
  title: string
  pinyinFull: string
  pinyinInitials: string
}

const buildPinyinIndex = (title: string): PinyinIndex => {
  const hasChinese = /[\u4e00-\u9fa5]/.test(title)
  if (!hasChinese) {
    const lower = title.toLowerCase()
    return {
      title,
      pinyinFull: lower.replace(/[^a-z0-9]/g, ''),
      pinyinInitials: lower
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .map((word) => word[0])
        .join('')
    }
  }
  return {
    title,
    pinyinFull: pinyin(title, { toneType: 'none', type: 'array', v: true })
      .join('')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ''),
    pinyinInitials: pinyin(title, { pattern: 'first', toneType: 'none', type: 'array', v: true })
      .join('')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
  }
}

/** 标题是否命中关键词：中文名 / 拼音全拼 / 首字母 任一匹配即可 */
const matchTitle = (entry: PinyinIndex, keyword: string): boolean => {
  const lowerTitle = entry.title.toLowerCase()
  const compactTitle = lowerTitle.replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
  return (
    lowerTitle.includes(keyword) ||
    compactTitle.includes(keyword) ||
    entry.pinyinFull.includes(keyword) ||
    (keyword.length >= 2 && entry.pinyinInitials.includes(keyword))
  )
}

/** 拼音索引缓存：避免每敲一个字都对全部标题重算拼音 */
let pinyinCache: { key: string; entries: PinyinIndex[] } | null = null

const loadTitleIndex = async (): Promise<PinyinIndex[]> => {
  const rows = await window.api.sql<Array<Pick<ContentType, 'id' | 'title'>>>(
    'select id, title from contents order by id desc',
    'findAll'
  )
  const key = rows.map((row) => row.id).join(',')
  if (pinyinCache && pinyinCache.key === key) return pinyinCache.entries
  const entries = rows.map((row) => buildPinyinIndex(row.title))
  pinyinCache = { key, entries }
  return entries
}

export default () => {
  const setData = useStore((s) => s.setData)
  const setApps = useStore((s) => s.setApps)
  const setFiles = useStore((s) => s.setFiles)
  const setWeb = useStore((s) => s.setWeb)
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => clearTimeout(timer.current)
  }, [])

  const query = async (keyword: string): Promise<void> => {
    if (!keyword.trim()) {
      // 清空搜索时把应用 / 文件 / 网页兜底结果一并清掉
      setData([])
      setApps([])
      setFiles([])
      setWeb(null)
      return
    }
    const lowerKeyword = keyword.trim().toLowerCase()

    // 应用 / 文件 / 片段三路搜索并行执行，互不阻塞
    const [contents, likeMatched, pinyinEntries, matchedFiles] = await Promise.all([
      window.api.searchApps(lowerKeyword),
      window.api.sql<ContentType[]>(
        `select * from contents where title like @keyword or content like @keyword order by id desc limit 6`,
        'findAll',
        { keyword: `%${keyword}%` }
      ),
      loadTitleIndex(),
      window.api.searchFiles(lowerKeyword)
    ])

    // 拼音命中但 LIKE 没命中的标题（如输入 wx 找「微信使用技巧」），补进结果
    const likeIds = new Set(likeMatched.map((item) => item.id))
    const pinyinOnlyTitles = pinyinEntries
      .filter((entry) => matchTitle(entry, lowerKeyword))
      .map((entry) => entry.title)
      .filter((title) => !likeMatched.some((item) => item.title === title))

    let pinyinMatched: ContentType[] = []
    if (pinyinOnlyTitles.length) {
      // better-sqlite3 只支持命名参数，按 @v0/@v1... 生成占位符
      const placeholders = pinyinOnlyTitles.map((_, index) => `@v${index}`).join(',')
      const params: Record<string, string> = {}
      pinyinOnlyTitles.forEach((title, index) => {
        params[`v${index}`] = title
      })
      pinyinMatched = await window.api.sql<ContentType[]>(
        `select * from contents where title in (${placeholders}) order by id desc limit 6`,
        'findAll',
        params
      )
    }

    // LIKE 结果在前（内容也参与匹配），拼音补充结果在后，合并去重后截断
    const merged = [...likeMatched]
    for (const item of pinyinMatched) {
      if (!likeIds.has(item.id)) merged.push(item)
    }

    setData(merged.slice(0, 6))
    setApps(contents)
    setFiles(matchedFiles)

    // 网页搜索兜底：命中「github 关键词」这类关键字时切到对应引擎，
    // 否则用设置里的默认引擎（判定逻辑在主进程，配置改了立即生效）
    const target = await window.api.resolveWebSearch(keyword.trim())
    setWeb({ engine: target.engine, engineName: target.engineName, query: target.query })
  }

  const handleSearch = (e: ChangeEvent<HTMLInputElement>): void => {
    const keyword = e.target.value
    setSearch(keyword)
    // 防抖：避免每敲一个字都查一次库
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void query(keyword)
    }, SEARCH_DELAY)
  }

  return { search, handleSearch }
}
