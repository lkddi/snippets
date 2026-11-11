import { Delete, FilePdf, FileText, FileZip, Link, Pic } from '@icon-park/react'
import { Input, InputRef } from 'antd'
import classNames from 'classnames'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/zh-tw'
import { ChangeEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useFocusOnShow from '@renderer/hooks/useFocusOnShow'
import { useT, useI18nStore } from '@renderer/i18n'
import './clipboard.scss'

// 相对时间展示需要 relativeTime 插件
dayjs.extend(relativeTime)

/** 列表标题截断长度：整段文本只取首行即可，长内容徒增布局成本 */
const TITLE_MAX = 200
/** 预览正文长度上限（主进程已截到 4000，这里再兜一层） */
const PREVIEW_MAX = 4000

/** 类型筛选 */
type FilterType = 'all' | ClipboardKindType

/** 单行展示数据：标题/副标题/时间随列表加载一次性算好，悬停重渲染时零重算 */
interface RowViewType {
  item: ClipboardItemType
  kind: ClipboardKindType
  title: string
  isUrl: boolean
  timeText: string
}

interface RowProps {
  row: RowViewType
  index: number
  active: boolean
  onHover: (index: number) => void
  onPaste: (id: number) => void
  onRemove: (id: number) => void
}

const isHttpUrl = (text: string): boolean => /^https?:\/\//i.test(text.trim())

/** 图片尺寸与体积："1528x806|4851234" → "1528×806 · 4.6 MB" */
const formatImageMeta = (meta: string): string => {
  const [size, bytes] = meta.split('|')
  const [width, height] = (size ?? '').split('x')
  const mb = Number(bytes) / 1024 / 1024
  const volume = Number.isFinite(mb) && mb > 0 ? ` · ${mb >= 1 ? mb.toFixed(1) : (mb * 1024).toFixed(0)} ${mb >= 1 ? 'MB' : 'KB'}` : ''
  return width && height ? `${width}×${height}${volume}` : volume.replace(/^ · /, '')
}

/** 文件扩展名 → 图标（选中行用白色，避免和蓝色高亮背景融在一起） */
const FileIcon = ({ ext, active = false }: { ext: string; active?: boolean }): JSX.Element => {
  const common = {
    theme: 'outline' as const,
    size: 16,
    fill: active ? '#fff' : '#0a84ff',
    strokeWidth: 3
  }
  if (ext === 'pdf') return <FilePdf {...common} />
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <FileZip {...common} />
  return <FileText {...common} />
}

/**
 * 单行用 memo 包住：悬停切换高亮时只有旧/新两行重渲染，
 * 之前整列表（50 行）跟着每次 mouseEnter 重算，长内容时会有可感知的卡顿
 */
const ClipboardRow = memo(function ClipboardRow({
  row,
  index,
  active,
  onHover,
  onPaste,
  onRemove
}: RowProps): JSX.Element {
  const icon = ((): JSX.Element => {
    if (row.kind === 'image') {
      return <Pic theme="outline" size={16} fill={active ? '#fff' : '#0a84ff'} strokeWidth={3} />
    }
    if (row.kind === 'file') {
      return <FileIcon ext={(row.item.meta || '').toLowerCase()} active={active} />
    }
    if (row.isUrl) {
      return <Link theme="outline" size={16} fill={active ? '#fff' : '#0a84ff'} strokeWidth={3} />
    }
    return <FileText theme="outline" size={16} fill={active ? '#fff' : '#64748b'} strokeWidth={3} />
  })()

  return (
    <div
      className={classNames('item', { active })}
      onClick={() => onPaste(row.item.id)}
      onMouseEnter={() => onHover(index)}
    >
      <span className="kind-icon">{icon}</span>
      <span className="item-title">{row.title}</span>
      {row.kind !== 'text' && (
        <span className="item-type">
          {row.kind === 'image'
            ? formatImageMeta(row.item.meta)
            : (row.item.meta || '').toUpperCase()}
        </span>
      )}
      {/* 前 9 条映射 ⌘1~⌘9，与 Alfred 一致，窗口内直接数字键粘贴 */}
      {index < 9 && <span className="item-key">⌘{index + 1}</span>}
      {/* stopPropagation 避免触发行点击（复制 + 自动粘贴） */}
      <span
        className="remove"
        onClick={(e) => {
          e.stopPropagation()
          onRemove(row.item.id)
        }}
      >
        <Delete theme="outline" size="15" fill="#ef4444" strokeWidth={3} />
      </span>
    </div>
  )
})

export const Clipboard = (): JSX.Element => {
  const t = useT()
  const [items, setItems] = useState<ClipboardItemType[]>([])
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [activeIndex, setActiveIndex] = useState(0)
  const [preview, setPreview] = useState<ClipboardPreviewType | null>(null)
  /** 预览结果按 id 缓存：来回移动选中时不再重复请求主进程（图片 base64 较大） */
  const previewCache = useRef(new Map<number, ClipboardPreviewType | null>())

  // 相对时间随语言切换：中文用 zh-cn / zh-tw，其余用内置 en
  const locale = useI18nStore((s) => s.locale)
  const systemLocale = useI18nStore((s) => s.systemLocale)
  useEffect(() => {
    const eff = locale === 'system' ? systemLocale : locale
    dayjs.locale(eff === 'zh-TW' ? 'zh-tw' : eff === 'zh-CN' ? 'zh-cn' : 'en')
  }, [locale, systemLocale])

  // keyword 用 ref 中转：load / 粘贴 / 删除等回调保持稳定引用，
  // 既省掉输入过滤词时的重复订阅，也让行级 memo 的回调 prop 恒定不变
  const keywordRef = useRef(keyword)
  keywordRef.current = keyword

  // 面板是懒创建后反复 hide/show 复用的，autoFocus 只管首次挂载，
  // 每次唤起都要把光标放回过滤输入框
  const filterInputRef = useRef<InputRef>(null)
  useFocusOnShow(filterInputRef)

  const load = useCallback(async (): Promise<void> => {
    const list = await window.api.clipboardList(keywordRef.current)
    setItems(list)
    // 选中项夹在有效范围内，避免删除/刷新后越界
    setActiveIndex((index) => Math.min(index, Math.max(0, list.length - 1)))
  }, [])

  useEffect(() => {
    void load()
  }, [keyword, load])

  // 面板是失焦即隐藏的浮层：focus 事件等价于「重新唤起」，
  // 把上次的过滤词、类型筛选与选中位置清掉，恢复完整列表再开始新的选择
  useEffect(() => {
    const reset = (): void => {
      if (keywordRef.current) {
        // 清词后 keyword 变化会自动触发 load
        setKeyword('')
      } else {
        // 没输入过过滤词也要刷一次，唤起时拿到最新记录
        void load()
      }
      setFilter('all')
      setActiveIndex(0)
    }
    window.addEventListener('focus', reset)
    return () => window.removeEventListener('focus', reset)
  }, [load])

  // 主进程有新剪贴板记录时刷新列表（携带当前过滤词重新查询）
  useEffect(() => {
    return window.api.onClipboardUpdated(() => void load())
  }, [load])

  const pasteItem = useCallback(async (id: number): Promise<void> => {
    // 主进程：按类型写回剪贴板 → 尝试自动粘贴 → 隐藏窗口；这里再刷新一次排序
    await window.api.clipboardPaste(id)
    void load()
  }, [load])

  const removeItem = useCallback(
    async (id: number): Promise<void> => {
      previewCache.current.delete(id)
      await window.api.clipboardDelete(id)
      void load()
    },
    [load]
  )

  const clearAll = useCallback(async (): Promise<void> => {
    previewCache.current.clear()
    await window.api.clipboardClear()
    void load()
  }, [load])

  const handleFilter = (e: ChangeEvent<HTMLInputElement>): void => {
    setKeyword(e.target.value)
    setActiveIndex(0)
  }

  const handleHover = useCallback((index: number): void => {
    setActiveIndex(index)
  }, [])

  // 标题 / 时间只在数据或筛选变化时重算一次，悬停切换高亮直接复用行组件
  const rows = useMemo<RowViewType[]>(
    () =>
      items
        .filter((item) => filter === 'all' || item.kind === filter)
        .map((item) => {
          const timeText = dayjs(item.created_at).fromNow()
          if (item.kind === 'image') {
            return { item, kind: item.kind, title: t('clipboard.kindImage'), isUrl: false, timeText }
          }
          if (item.kind === 'file') {
            // content 存的是完整路径，列表只显示文件名（体积/类型在右侧）
            const name = (item.path || item.content).split('/').pop() ?? item.content
            return { item, kind: item.kind, title: name, isUrl: false, timeText }
          }
          const raw = item.content.replace(/\s+/g, ' ').trim()
          return {
            item,
            kind: item.kind,
            title: raw.slice(0, TITLE_MAX),
            isUrl: isHttpUrl(raw),
            timeText
          }
        }),
    [items, filter, t]
  )

  // 选中项变化时取其预览；命中缓存则直接复用
  const activeRow = rows[activeIndex]
  const activeId = activeRow?.item.id ?? 0
  useEffect(() => {
    if (!activeId) {
      setPreview(null)
      return
    }
    if (previewCache.current.has(activeId)) {
      setPreview(previewCache.current.get(activeId) ?? null)
      return
    }
    let cancelled = false
    void window.api.clipboardPreview(activeId).then((result) => {
      previewCache.current.set(activeId, result)
      if (!cancelled) setPreview(result)
    })
    return () => {
      cancelled = true
    }
  }, [activeId])

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      // ⌘/Ctrl + 数字：直接粘贴第 N 条（与 Alfred 的 ⌘1~⌘9 一致）
      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        const matched = /^Digit([1-9])$/.exec(e.code)
        if (matched) {
          e.preventDefault()
          const target = rows[Number(matched[1]) - 1]
          if (target) void pasteItem(target.item.id)
          return
        }
        // ⌘⌫ 删除当前选中
        if (e.code === 'Backspace') {
          e.preventDefault()
          if (activeId) void removeItem(activeId)
          return
        }
      }

      switch (e.code) {
        case 'ArrowUp': {
          if (rows.length === 0) return
          e.preventDefault()
          setActiveIndex((index) => (index <= 0 ? rows.length - 1 : index - 1))
          break
        }
        case 'ArrowDown': {
          if (rows.length === 0) return
          e.preventDefault()
          setActiveIndex((index) => (index < 0 || index >= rows.length - 1 ? 0 : index + 1))
          break
        }
        case 'Enter': {
          if (activeRow) void pasteItem(activeRow.item.id)
          break
        }
        case 'Escape': {
          window.api.closeWindow('clipboard')
          break
        }
      }
    },
    [rows, activeId, activeRow, pasteItem, removeItem]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyEvent)
    return () => {
      document.removeEventListener('keydown', handleKeyEvent)
    }
  }, [handleKeyEvent])

  const pasteById = useCallback((id: number) => void pasteItem(id), [pasteItem])
  const removeById = useCallback((id: number) => void removeItem(id), [removeItem])

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: t('clipboard.filterAll') },
    { key: 'text', label: t('clipboard.filterText') },
    { key: 'image', label: t('clipboard.filterImage') },
    { key: 'file', label: t('clipboard.filterFile') }
  ]

  return (
    <main className="p-3">
      <div className="clipboard-page">
        <header className="clipboard-head drag">
          <Input
            value={keyword}
            onChange={handleFilter}
            placeholder={t('clipboard.filterPlaceholder')}
            autoFocus
            allowClear
            className="nodrag"
            ref={filterInputRef}
          />
        </header>

        <div className="clipboard-body">
          <section className="clipboard-list nodrag">
            {rows.map((row, index) => (
              <ClipboardRow
                key={row.item.id}
                row={row}
                index={index}
                active={index === activeIndex}
                onHover={handleHover}
                onPaste={pasteById}
                onRemove={removeById}
              />
            ))}
            {rows.length === 0 && <div className="empty">{t('clipboard.empty')}</div>}
          </section>

          <aside className="clipboard-preview nodrag">
            {preview === null ? (
              <div className="preview-empty">{t('clipboard.previewEmpty')}</div>
            ) : preview.kind === 'image' ? (
              <>
                <div className="preview-image">
                  <img src={preview.dataUrl} alt="" />
                </div>
                {/* 图片文件带文件名，截图/复制图像则只有尺寸信息 */}
                {preview.name && (
                  <div className="preview-name" title={preview.name}>
                    {preview.name}
                  </div>
                )}
                <div className="preview-meta">{formatImageMeta(`${preview.width}x${preview.height}|${preview.bytes}`)}</div>
              </>
            ) : preview.kind === 'file' ? (
              <div className="preview-file">
                <FileIcon ext={preview.ext} />
                <div className="preview-file-name" title={preview.name}>
                  {preview.name}
                </div>
                <div className="preview-file-path" title={preview.path}>
                  {preview.path}
                </div>
              </div>
            ) : (
              <>
                <pre className="preview-text">{preview.text.slice(0, PREVIEW_MAX)}</pre>
                {preview.truncated && (
                  <div className="preview-note">{t('clipboard.previewTruncated')}</div>
                )}
              </>
            )}
            {activeRow && (
              <div className="preview-time">
                {t('clipboard.copiedAt')} {activeRow.timeText}
              </div>
            )}
          </aside>
        </div>

        <footer className="nodrag">
          <div className="clipboard-filters">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                className={classNames('filter-chip', { active: filter === item.key })}
                onClick={() => {
                  setFilter(item.key)
                  setActiveIndex(0)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <span
            className="cursor-pointer text-xs text-slate-500 hover:text-red-500 select-none"
            onClick={() => void clearAll()}
          >
            {t('clipboard.clearAll')}
          </span>
        </footer>
      </div>
    </main>
  )
}
