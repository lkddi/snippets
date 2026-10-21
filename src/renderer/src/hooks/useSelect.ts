import { useStore } from '@renderer/store/useStore'
import { useCallback, useEffect } from 'react'

export default () => {
  const data = useStore((state) => state.data)
  const setData = useStore((state) => state.setData)
  const search = useStore((state) => state.search)
  const setSearch = useStore((state) => state.setSearch)
  const id = useStore((state) => state.id)
  const setId = useStore((state) => state.setId)

  //选中代码行
  const selectItem = useCallback(
    async (targetId: number) => {
      const content = data.find((item) => item.id === targetId)?.content
      if (content) await navigator.clipboard.writeText(content)
      setData([])
      setSearch('')
      // 之前这里调用不存在的 window.api.hideWindow()，隐藏窗口统一用 closeWindow
      window.api.closeWindow('search')
    },
    [data, setData, setSearch]
  )

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp': {
          if (data.length === 0) return
          e.preventDefault()
          const index = data.findIndex((item) => item.id === id)
          // findIndex 为 -1 时取最后一项，避免 data[-2] 越界
          const prev = index <= 0 ? data.length - 1 : index - 1
          setId(data[prev].id)
          break
        }
        case 'ArrowDown': {
          if (data.length === 0) return
          e.preventDefault()
          const index = data.findIndex((item) => item.id === id)
          const next = index < 0 || index >= data.length - 1 ? 0 : index + 1
          setId(data[next].id)
          break
        }
        case 'Enter': {
          if (!id || data.length === 0) {
            window.api.closeWindow('search')
            return
          }
          void selectItem(id)
          break
        }
        case 'Escape': {
          window.api.closeWindow('search')
          break
        }
      }
    },
    [data, id, selectItem, setId]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyEvent)
    return () => {
      document.removeEventListener('keydown', handleKeyEvent)
    }
  }, [handleKeyEvent])

  useEffect(() => {
    setId(data[0]?.id ?? 0)
  }, [data, setId])

  return { data, id, search, selectItem }
}
