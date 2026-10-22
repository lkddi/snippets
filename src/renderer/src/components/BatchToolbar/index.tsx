import { Delete } from '@icon-park/react'
import { useState } from 'react'
import { Checkbox } from '../Checkbox'
import styles from './batchToolbar.module.scss'

interface Props {
  /** 当前列表全部条目 id，用于全选/取消全选 */
  allIds: number[]
  selectedIds: number[]
  setSelectedIds: (ids: number[]) => void
  onExit: () => void
  onDelete: (ids: number[]) => void
  /** 删除确认弹窗文案 */
  confirmText: string
  /** 工具条下的提示文案，比如分类删除会把片段移入未分类 */
  hint?: string
}

/** 批量管理工具条：全选 / 已选计数 / 删除所选 / 退出批量模式 */
export const BatchToolbar = ({
  allIds,
  selectedIds,
  setSelectedIds,
  onExit,
  onDelete,
  confirmText,
  hint
}: Props) => {
  const [deleting, setDeleting] = useState(false)
  const allChecked = allIds.length > 0 && selectedIds.length === allIds.length

  const handleDelete = (): void => {
    if (!selectedIds.length) return
    if (!window.confirm(confirmText)) return
    setDeleting(true)
    onDelete(selectedIds)
  }

  return (
    <div className={styles.toolbar}>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={allChecked}
          onChange={() => setSelectedIds(allChecked ? [] : allIds)}
        />
        <span className="cursor-pointer" onClick={() => setSelectedIds(allChecked ? [] : allIds)}>
          {allChecked ? '取消全选' : '全选'}
        </span>
        <span className="opacity-60">已选 {selectedIds.length} 项</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          className={[styles.btn, !selectedIds.length ? 'opacity-40 pointer-events-none' : '', deleting ? 'pointer-events-none' : ''].join(' ')}
          onClick={handleDelete}
        >
          <Delete theme="outline" size="12" strokeWidth={3} />
          删除
        </button>
        <button className={styles.btn} onClick={onExit}>
          完成
        </button>
      </div>
      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
  )
}
