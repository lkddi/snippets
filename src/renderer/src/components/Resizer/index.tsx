import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './resizer.module.scss'

interface Props {
  /** localStorage 存储键，记住用户拖出来的宽度 */
  storageKey: string
  /** 写到 documentElement 上的 CSS 变量名，页面布局用 var(--xxx) 消费 */
  cssVar: string
  defaultWidth?: number
  min?: number
  max?: number
  /** 额外类名（页面里用它声明 grid-area） */
  className?: string
}

const readSavedWidth = (storageKey: string, defaultWidth: number, min: number, max: number): number => {
  const saved = Number(localStorage.getItem(storageKey))
  return Number.isFinite(saved) && saved >= min && saved <= max ? saved : defaultWidth
}

/**
 * 垂直拖拽分隔条：按住左右拖动调整列宽，宽度写入 CSS 变量并持久化。
 * 列的布局由各页面 grid 里 `var(--cssVar)` 控制，本组件只负责拖拽与存取。
 */
export const Resizer = ({ storageKey, cssVar, defaultWidth = 160, min = 100, max = 560, className = '' }: Props) => {
  const [width, setWidth] = useState(() => readSavedWidth(storageKey, defaultWidth, min, max))
  const widthRef = useRef(width)
  widthRef.current = width

  useEffect(() => {
    document.documentElement.style.setProperty(cssVar, `${width}px`)
  }, [cssVar, width])

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = widthRef.current

      const onMove = (ev: MouseEvent): void => {
        setWidth(Math.min(max, Math.max(min, startWidth + (ev.clientX - startX))))
      }
      const onUp = (): void => {
        localStorage.setItem(storageKey, String(widthRef.current))
        document.body.classList.remove('column-resizing')
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      // 拖拽期间禁用文本选中，否则鼠标划过列表会触发大面积选蓝
      document.body.classList.add('column-resizing')
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [cssVar, min, max, storageKey]
  )

  return <div className={[styles.resizer, className].join(' ')} onMouseDown={startDrag} title="拖动调整宽度" />
}
