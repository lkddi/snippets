import { Delete } from '@icon-park/react'
import { Input } from 'antd'
import classNames from 'classnames'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import { ChangeEvent, useCallback, useEffect, useState } from 'react'
import './clipboard.scss'

// 相对时间展示需要 relativeTime 插件 + 中文语言包
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

export const Clipboard = (): JSX.Element => {
  const [items, setItems] = useState<ClipboardItemType[]>([])
  const [keyword, setKeyword] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const load = useCallback(async (kw = ''): Promise<void> => {
    const list = await window.api.clipboardList(kw)
    setItems(list)
    // 选中项夹在有效范围内，避免删除/刷新后越界
    setActiveIndex((index) => Math.min(index, Math.max(0, list.length - 1)))
  }, [])

  useEffect(() => {
    void load(keyword)
  }, [keyword, load])

  // 主进程有新剪贴板记录时刷新列表（携带当前过滤词重新查询）
  useEffect(() => {
    return window.api.onClipboardUpdated(() => void load(keyword))
  }, [keyword, load])

  const pasteItem = async (id: number): Promise<void> => {
    // 主进程：写回剪贴板 → 尝试自动粘贴 → 隐藏窗口；这里再刷新一次排序
    await window.api.clipboardPaste(id)
    void load(keyword)
  }

  const removeItem = async (id: number): Promise<void> => {
    await window.api.clipboardDelete(id)
    void load(keyword)
  }

  const clearAll = async (): Promise<void> => {
    await window.api.clipboardClear()
    void load(keyword)
  }

  const handleFilter = (e: ChangeEvent<HTMLInputElement>): void => {
    setKeyword(e.target.value)
  }

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
    // pasteItem 依赖 keyword，一并纳入闭包依赖
    [items, activeIndex, keyword]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyEvent)
    return () => {
      document.removeEventListener('keydown', handleKeyEvent)
    }
  }, [handleKeyEvent])

  return (
    <main className="p-3">
      <div className="clipboard-page bg-slate-50 rounded-lg p-3">
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
          {items.map((item, index) => (
            <div
              key={item.id}
              className={classNames('item', { active: index === activeIndex })}
              onClick={() => void pasteItem(item.id)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className="preview">{item.content}</span>
              <span className="time">{dayjs(item.created_at).fromNow()}</span>
              {/* stopPropagation 避免触发行点击（复制 + 自动粘贴） */}
              <span
                className="remove"
                onClick={(e) => {
                  e.stopPropagation()
                  void removeItem(item.id)
                }}
              >
                <Delete theme="outline" size="15" fill="#ef4444" strokeWidth={3} />
              </span>
            </div>
          ))}
          {items.length === 0 && <div className="empty">暂无剪贴板记录</div>}
        </section>
        <footer className="nodrag flex justify-end">
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
