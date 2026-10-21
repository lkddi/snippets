import { Delete } from '@icon-park/react'
import { useContextMenu } from 'mantine-contextmenu'
import { useSubmit } from 'react-router-dom'
import styles from './styles.module.scss'
import useContent from '../useContent'
import { DragEvent } from 'react'
export default (category: CategoryType) => {
  const submit = useSubmit()
  const { showContextMenu } = useContextMenu()
  const { updateContentCategory } = useContent()

  const contextMenu = () =>
    showContextMenu(
      [
        {
          key: 'remove',
          icon: <Delete theme="outline" size="18" strokeWidth={3} />,
          title: '删除分类',
          onClick: () => {
            submit({ id: category.id }, { method: 'DELETE' })
          }
        }
      ],
      { className: 'contextMenu' }
    )

  const dragHandle = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      const el = e.currentTarget as HTMLDivElement
      el.classList.add(styles.darging)
    },
    onDragLeave: (e: DragEvent) => {
      const el = e.currentTarget as HTMLDivElement
      el.classList.remove(styles.darging)
    },
    onDrop: (e: DragEvent) => {
      const el = e.currentTarget as HTMLDivElement
      el.classList.remove(styles.darging)
      const id = Number(e.dataTransfer?.getData('id'))
      // 拖拽的不是片段（没带 id）时直接忽略，避免把 category_id 改成 NaN
      if (!Number.isFinite(id) || id <= 0) return
      void updateContentCategory(id, category.id)
    }
  }

  return { contextMenu, dragHandle }
}
