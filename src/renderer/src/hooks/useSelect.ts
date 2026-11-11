import { useStore } from '@renderer/store/useStore'
import { useCallback, useEffect, useRef, useState } from 'react'

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
  const preview = useStore((state) => state.preview)
  const setPreview = useStore((state) => state.setPreview)

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
    setPreview(null)
    // 之前这里调用不存在的 window.api.hideWindow()，隐藏窗口统一用 closeWindow
    window.api.closeWindow('search')
  }, [setData, setApps, setFiles, setWeb, setSearch, setPreview])

  // 片段：内容写回剪贴板并自动粘回唤起前的光标处（与剪贴板面板同一链路），
  // 失败（无辅助功能权限等）时降级为仅复制，用户手动 Cmd+V
  const selectItem = useCallback(
    async (targetId: number): Promise<void> => {
      const content = data.find((item) => item.id === targetId)?.content
      if (content) await window.api.pasteSnippet(content)
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

  // 文件所在文件夹：在 Finder / 资源管理器中显示并选中（Cmd+回车）
  const revealFile = useCallback(
    async (path: string): Promise<void> => {
      await window.api.revealFile(path)
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

  /** 选中项 → 预览目标。网页兜底行没有可预览内容，返回 null（此时空格照常输入） */
  const buildTarget = useCallback(
    (index: number): SearchPreviewTarget | null => {
      if (index < apps.length) {
        const app = apps[index]
        return app ? { kind: 'app', path: app.path, name: app.name } : null
      }
      const fileIndex = index - apps.length
      if (fileIndex < files.length) {
        const file = files[fileIndex]
        return file ? { kind: 'file', path: file.path } : null
      }
      const dataIndex = fileIndex - files.length
      if (dataIndex < data.length) {
        const content = data[dataIndex]
        return content ? { kind: 'snippet', id: content.id } : null
      }
      return null
    },
    [apps, files, data]
  )

  // 请求序号：连按方向键快速切换时只采用最后一次请求的结果，避免预览闪回旧内容
  const previewSeq = useRef(0)
  const previewRef = useRef<SearchPreviewType | null>(null)
  previewRef.current = preview

  const loadPreview = useCallback(
    async (index: number): Promise<void> => {
      const target = buildTarget(index)
      if (!target) return
      const seq = ++previewSeq.current
      // 系统 Quick Look 出图要几百毫秒，先占位，避免按空格后长时间没有反应
      const slowTimer = setTimeout(() => {
        if (seq === previewSeq.current) {
          const name =
            target.kind === 'app' ? target.name : target.kind === 'file' ? (target.path.split('/').pop() ?? '') : ''
          setPreview({ kind: 'loading', name })
        }
      }, 220)
      const result = await window.api.previewItem(target)
      clearTimeout(slowTimer)
      if (seq !== previewSeq.current) return
      setPreview(result)
    },
    [buildTarget, setPreview]
  )

  /** 预览已打开则收起，返回是否真的收起过（Esc 优先关预览再关窗口） */
  const closePreview = useCallback((): boolean => {
    if (!previewRef.current) return false
    previewSeq.current++
    setPreview(null)
    return true
  }, [setPreview])

  // 关键词变了 → 结果整体换掉，旧预览必须收起，否则预览和列表对不上
  useEffect(() => {
    if (previewRef.current) {
      previewSeq.current++
      setPreview(null)
    }
  }, [apps, files, data, web, setPreview])

  // 预览打开时用方向键换选中项，预览内容跟着切
  useEffect(() => {
    if (previewRef.current) void loadPreview(activeIndex)
    // 只在选中项变化时联动，loadPreview 换引用无需重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex])

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
            if (fileItem) {
              // Cmd+回车（Windows 上 Ctrl+回车）= 打开文件所在文件夹并选中
              if (e.metaKey || e.ctrlKey) void revealFile(fileItem.path)
              else void activateFile(fileItem.path)
            }
          } else if (safeIndex < apps.length + files.length + data.length) {
            const contentId = data[safeIndex - apps.length - files.length]?.id
            if (contentId) void selectItem(contentId)
          } else {
            void activateWeb()
          }
          break
        }
        case 'Space': {
          // 输入法用空格上屏候选词，绝不能抢；Shift+空格 保留给确实要输入空格的场景
          if (e.isComposing || e.shiftKey) break
          if (total === 0) break
          // 防御：结果缩短后下标可能越界
          const safeIndex = Math.min(activeIndex, total - 1)
          // 网页兜底行没有可预览内容，空格照常输入
          if (!buildTarget(safeIndex)) break
          e.preventDefault()
          if (closePreview()) break
          void loadPreview(safeIndex)
          break
        }
        case 'KeyY': {
          // ⌘Y 交给系统 Quick Look 面板，想看完整排版时用它
          if (!(e.metaKey || e.ctrlKey)) break
          const current = previewRef.current
          if (!current || !('path' in current)) break
          e.preventDefault()
          void window.api.openQuickLook(current.path)
          break
        }
        case 'Escape': {
          // 先关预览，再按一次才收起窗口
          if (closePreview()) break
          window.api.closeWindow('search')
          break
        }
      }
    },
    [
      total,
      activeIndex,
      apps,
      files,
      data,
      activateApp,
      activateFile,
      revealFile,
      activateWeb,
      selectItem,
      buildTarget,
      loadPreview,
      closePreview
    ]
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
