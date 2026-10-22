import { Correct } from '@icon-park/react'
import styles from './checkbox.module.scss'

interface Props {
  checked: boolean
  onChange?: () => void
}

/** 批量管理的勾选框：阻止事件冒泡，避免触发条目的点击行为 */
export const Checkbox = ({ checked, onChange }: Props) => {
  return (
    <span
      className={[styles.checkbox, checked ? styles.checked : ''].join(' ')}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onChange?.()
      }}
    >
      {checked && <Correct theme="filled" size="9" fill="#ffffff" strokeWidth={4} />}
    </span>
  )
}
