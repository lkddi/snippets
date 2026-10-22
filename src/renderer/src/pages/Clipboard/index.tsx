import { Delete } from '@icon-park/react'
import { Input } from 'antd'
import classNames from 'classnames'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import { ChangeEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './clipboard.scss'

// 相对时间展示需要 relativeTime 插件 + 中文语言包
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

/** 预览文本截断长度：超出部分反正被 line-clamp-2 裁掉，留着只会拖慢布局/绘制 */
const PREVIEW_MAX = 600

/** 单行展示数据：相对时间与预览文本随列表加载一次性算好，悬停重渲染时零重算 */
interface RowViewType {
  item: ClipboardItemType
  timeText: string
  preview: string
}

interface RowProps {
  row: RowViewType
  index: number
  active: boolean
  onHover: (index: number) => void
  onPaste: (id: number) => void
  onRemove: (id: number) => void
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
  return (
    <div
      className={classNames('item', { active })}
      onClick={() => onPaste(row.item.id)}
      onMouseEnter={() => onHover(index)}
    >
      <span className="preview">{row.preview}</span>
      <span className="time">{row.timeText}</span>
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
  const [items, setItems] = useState<ClipboardItemType[]>([])
  const [keyword, setKeyword] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  // keyword 用 ref 中转：load / 粘贴 / 删除等回调保持稳定引用，
  // 既省掉输入过滤词时的重复订阅，也让行级 memo 的回调 prop 恒定不变
  const keywordRef = useRef(keyword)
  keywordRef.current = keyword

  const load = useCallback(async (): Promise<void> => {
    const list = await window.api.clipboardList(keywordRef.current)
    setItems(list)
    // 选中项夹在有效范围内，避免删除/刷新后越界
    setActiveIndex((index) => Math.min(index, Math.max(0, list.length - 1)))
  }, [])

  useEffect(() => {
    void load()
  }, [keyword, load])

  // 主进程有新剪贴板记录时刷新列表（携带当前过滤词重新查询）
  useEffect(() => {
    return window.api.onClipboardUpdated(() => void load())
  }, [load])

  const pasteItem = useCallback(async (id: number): Promise<void> => {
    // 主进程：写回剪贴板 → 尝试自动粘贴 → 隐藏窗口；这里再刷新一次排序
    await window.api.clipboardPaste(id)
    void load()
  }, [load])

  const removeItem = useCallback(
    async (id: number): Promise<void> => {
      await window.api.clipboardDelete(id)
      void load()
    },
    [load]
  )

  const clearAll = useCallback(async (): Promise<void> => {
    await window.api.clipboardClear()
    void load()
  }, [load])

  const handleFilter = (e: ChangeEvent<HTMLInputElement>): void => {
    setKeyword(e.target.value)
  }

  const handleHover = useCallback((index: number): void => {
    setActiveIndex(index)
  }, [])

  // 相对时间 / 预览文本只在列表数据变化时重算一次，
  // 悬停切换高亮时行组件直接复用，dayjs 不再每行每帧重跑
  const rows = useMemo<RowViewType[]>(
    () =>
      items.map((item) => ({
        item,
        timeText: dayjs(item.created_at).fromNow(),
        preview:
          item.content.length > PREVIEW_MAX
            ? item.content.slice(0, PREVIEW_MAX) + '…'
            : item.content
      })),
    [items]
  )

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp': {
          if (items.length === 0) return
          e.preventDefault()
          setActiveIndex((index) => (index <= 0 ? items.length - 1 : index - 1))
          break
        }
        case 'ArrowDown': {
          if (items.length === 0) return
          e.preventDefault()
          setActiveIndex((index) => (index < 0 || index >= items.length - 1 ? 0 : index + 1))
          break
        }
        case 'Enter': {
          const item = items[activeIndex]
          if (item) void pasteItem(item.id)
          break
        }
        case 'Escape': {
          window.api.closeWindow('clipboard')
          break
        }
      }
    },
    // pasteItem 已是稳定引用，不再需要纳入闭包依赖
    [items, activeIndex, pasteItem]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyEvent)
    return () => {
      document.removeEventListener('keydown', handleKeyEvent)
    }
  }, [handleKeyEvent])

  const pasteById = useCallback((id: number) => void pasteItem(id), [pasteItem])
  const removeById = useCallback((id: number) => void removeItem(id), [removeItem])

  return (
    <main className="p-3">
      <div className="clipboard-page">
        <section className="drag flex items-center gap-2 pb-2 border-b border-slate-200">
          <Input
            value={keyword}
            onChange={handleFilter}
            placeholder="过滤剪贴板内容"
            autoFocus
            allowClear
            className="nodrag"
          />
        </section>
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
          {items.length === 0 && <div className="empty">暂无剪贴板记录</div>}
        </section>
        <footer className="nodrag">
          <span className="clipboard-hint">
            <kbd>↑</kbd>
            <kbd>↓</kbd> 选择
            <kbd>↩</kbd> 粘贴
            <kbd>esc</kbd> 关闭
          </span>
          <span
            className="cursor-pointer text-xs text-slate-500 hover:text-red-500 select-none"
            onClick={() => void clearAll()}
          >
            清空全部
          </span>
        </footer>
      </div>
    </main>
  )
}
