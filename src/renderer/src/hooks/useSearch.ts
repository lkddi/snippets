import { useStore } from '@renderer/store/useStore'
import { ChangeEvent, useEffect, useRef } from 'react'

const SEARCH_DELAY = 150

export default () => {
  const setData = useStore((s) => s.setData)
  const setApps = useStore((s) => s.setApps)
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => clearTimeout(timer.current)
  }, [])

  const query = async (keyword: string): Promise<void> => {
    if (!keyword.trim()) {
      // 清空搜索时把应用结果一并清掉
      setData([])
      setApps([])
      return
    }
    // 应用搜索（主进程扫盘）与片段搜索（SQLite）并行执行，互不阻塞
    const [contents, apps] = await Promise.all([
      window.api.sql<ContentType[]>(
        `select * from contents where title like @keyword or content like @keyword order by id desc limit 6`,
        'findAll',
        { keyword: `%${keyword}%` }
      ),
      window.api.searchApps(keyword)
    ])
    setData(contents)
    setApps(apps)
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
