import { useStore } from '@renderer/store/useStore'
import { ChangeEvent, useEffect, useRef } from 'react'

const SEARCH_DELAY = 150

export default () => {
  const setData = useStore((s) => s.setData)
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => clearTimeout(timer.current)
  }, [])

  const query = async (keyword: string): Promise<void> => {
    if (!keyword.trim()) {
      setData([])
      return
    }
    const data = await window.api.sql<ContentType[]>(
      `select * from contents where title like @keyword or content like @keyword order by id desc limit 6`,
      'findAll',
      { keyword: `%${keyword}%` }
    )
    setData(data)
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
