import { useStore } from '@renderer/store/useStore'
import { useCallback, useEffect, useState } from 'react'

export default () => {
  const data = useStore((state) => state.data)
  const setData = useStore((state) => state.setData)
  const apps = useStore((state) => state.apps)
  const setApps = useStore((state) => state.setApps)
  const files = useStore((state) => state.files)
  const setFiles = useStore((state) => state.setFiles)
  const web = useStore((state) => state.web)
  const setWeb = useStore((state) => state.setWeb)
  const search = useStore((state) => state.search)
  const setSearch = useStore((state) => state.setSearch)
  const setId = useStore((state) => state.setId)

  // 合并列表的选中下标：应用 → 文件 → 片段 → 网页兜底
  const [activeIndex, setActiveIndex] = useState(0)
  const webCount = web ? 1 : 0
  const total = apps.length + files.length + data.length + webCount

  // 列表变化时把选中项复位到第一条，避免下标越界
  useEffect(() => {
    setActiveIndex(0)
  }, [apps.length, files.length, data.length, webCount])

  // 清空结果并收起窗口，所有执行路径共用
  const clearAndHide = useCallback((): void => {
    setData([])
    setApps([])
    setFiles([])
    setWeb(null)
    setSearch('')
    // 之前这里调用不存在的 window.api.hideWindow()，隐藏窗口统一用 closeWindow
    window.api.closeWindow('search')
  }, [setData, setApps, setFiles, setWeb, setSearch])

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

  // 文件 / 文件夹：用默认应用打开，主进程成功后收起搜索窗
  const activateFile = useCallback(
    async (path: string): Promise<void> => {
      await window.api.openFile(path)
      clearAndHide()
    },
    [clearAndHide]
  )

  // 网页搜索兜底：主进程 openExternal 后同样收起搜索窗
  const activateWeb = useCallback(async (): Promise<void> => {
    if (!web) return
    await window.api.openWebSearch(web.engine, web.query)
    clearAndHide()
  }, [web, clearAndHide])

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
          // 防御：结果缩短发生在 commit 与 effect 之间时下标可能越界
          const safeIndex = Math.min(activeIndex, total - 1)
          if (safeIndex < apps.length) {
            const appItem = apps[safeIndex]
            if (appItem) void activateApp(appItem.path)
          } else if (safeIndex < apps.length + files.length) {
            const fileItem = files[safeIndex - apps.length]
            if (fileItem) void activateFile(fileItem.path)
          } else if (safeIndex < apps.length + files.length + data.length) {
            const contentId = data[safeIndex - apps.length - files.length]?.id
            if (contentId) void selectItem(contentId)
          } else {
            void activateWeb()
          }
          break
        }
        case 'Escape': {
          window.api.closeWindow('search')
          break
        }
      }
    },
    [total, activeIndex, apps, files, data, activateApp, activateFile, activateWeb, selectItem]
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

  return {
    apps,
    files,
    data,
    web,
    search,
    activeIndex,
    setActiveIndex,
    activateApp,
    activateFile,
    activateWeb,
    selectItem
  }
}
