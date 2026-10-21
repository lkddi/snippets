import { useStore } from '@renderer/store/useStore'
import { useCallback, useEffect, useState } from 'react'

export default () => {
  const data = useStore((state) => state.data)
  const setData = useStore((state) => state.setData)
  const apps = useStore((state) => state.apps)
  const setApps = useStore((state) => state.setApps)
  const search = useStore((state) => state.search)
  const setSearch = useStore((state) => state.setSearch)
  const setId = useStore((state) => state.setId)

  // 合并列表的选中下标：前 apps.length 项是应用，其余是片段
  const [activeIndex, setActiveIndex] = useState(0)
  const total = apps.length + data.length

  // 列表变化时把选中项复位到第一条，避免下标越界
  useEffect(() => {
    setActiveIndex(0)
  }, [apps.length, data.length])

  // 清空结果并收起窗口，应用与片段两条执行路径共用
  const clearAndHide = useCallback((): void => {
    setData([])
    setApps([])
    setSearch('')
    // 之前这里调用不存在的 window.api.hideWindow()，隐藏窗口统一用 closeWindow
    window.api.closeWindow('search')
  }, [setData, setApps, setSearch])

  // 片段：复制内容后收起（保持原有行为）
  const selectItem = useCallback(
    async (targetId: number): Promise<void> => {
      const content = data.find((item) => item.id === targetId)?.content
      if (content) await navigator.clipboard.writeText(content)
      clearAndHide()
    },
    [data, clearAndHide]
  )

  // 应用：直接启动，主进程打开成功后会收起搜索窗
  const activateApp = useCallback(
    async (path: string): Promise<void> => {
      await window.api.openApp(path)
      clearAndHide()
    },
    [clearAndHide]
  )

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp': {
          if (total === 0) return
          e.preventDefault()
          // findIndex 式回环：到顶后跳到最后一项
          setActiveIndex((index) => (index <= 0 ? total - 1 : index - 1))
          break
        }
        case 'ArrowDown': {
          if (total === 0) return
          e.preventDefault()
          setActiveIndex((index) => (index < 0 || index >= total - 1 ? 0 : index + 1))
          break
        }
        case 'Enter': {
          if (total === 0) {
            window.api.closeWindow('search')
            return
          }
          if (activeIndex < apps.length) {
            // 防御：结果缩短发生在 commit 与 effect 之间时下标可能越界
            const appItem = apps[activeIndex]
            if (appItem) void activateApp(appItem.path)
          } else {
            const contentId = data[activeIndex - apps.length]?.id
            if (contentId) void selectItem(contentId)
          }
          break
        }
        case 'Escape': {
          window.api.closeWindow('search')
          break
        }
      }
    },
    [total, activeIndex, apps, data, activateApp, selectItem]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyEvent)
    return () => {
      document.removeEventListener('keydown', handleKeyEvent)
    }
  }, [handleKeyEvent])

  // store 里的 id 保留同步（其它地方可能消费），指向第一条例行片段
  useEffect(() => {
    setId(data[0]?.id ?? 0)
  }, [data, setId])

  return { apps, data, search, activeIndex, setActiveIndex, activateApp, selectItem }
}
