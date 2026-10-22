import { Delete, Edit } from '@icon-park/react'
import dayjs from 'dayjs'
import { useContextMenu } from 'mantine-contextmenu'
import { NavLink, useSubmit } from 'react-router-dom'
import { useStore } from '@renderer/store/useStore'
import { Checkbox } from '../Checkbox'
import styles from './styles.module.scss'
interface Props {
  content: ContentType
}
export const ContentItem = ({ content }: Props) => {
  const submit = useSubmit()
  const { showContextMenu } = useContextMenu()
  const contentBatchMode = useStore((state) => state.contentBatchMode)
  const toggleContentSelected = useStore((state) => state.toggleContentSelected)
  const selectedContentIds = useStore((state) => state.selectedContentIds)
  const editContentId = useStore((state) => state.editContentId)
  const setEditContentId = useStore((state) => state.setEditContentId)
  const selected = selectedContentIds.includes(content.id)

  const submitName = (title: string): void => {
    const value = title.trim()
    if (value && value !== content.title) {
      // 与删除一样显式指向列表路由，PUT 只改标题（内容仍在详情页编辑保存）
      submit(
        { id: content.id, title: value },
        { method: 'PUT', action: `/config/category/contentList/${content.category_id}` }
      )
    }
    setEditContentId(0)
  }

  const contextMenu = () =>
    showContextMenu(
      [
        {
          key: 'rename',
          icon: <Edit theme="outline" size="18" strokeWidth={3} />,
          title: '重命名片段',
          onClick: () => setEditContentId(content.id)
        },
        {
          key: 'remove',
          icon: <Delete theme="outline" size="18" strokeWidth={3} />,
          title: '删除片段',
          // 显式指向列表路由：从片段详情页右键删除时，
          // 隐式提交会落到 content/:id 的 action（没处理 DELETE）导致删不掉
          onClick: () => {
            submit(
              { id: content.id },
              { method: 'DELETE', action: `/config/category/contentList/${content.category_id}` }
            )
          }
        }
      ],
      { className: 'contextMenu' }
    )

  // 批量模式下禁用跳转/右键，点击条目即切换选中
  if (contentBatchMode) {
    return (
      <div
        className={[selected ? styles.active : '', styles.link, 'flex items-center gap-1.5'].join(' ')}
        onClick={() => toggleContentSelected(content.id)}
      >
        <Checkbox checked={selected} onChange={() => toggleContentSelected(content.id)} />
        <div className="truncate flex-1">{content.title}</div>
        <div className="text-[10px] opacity-80 shrink-0">
          {dayjs(content.created_at).format('YY/MM/DD')}
        </div>
      </div>
    )
  }

  // 内联重命名：Enter 提交、Esc 取消、失焦提交
  if (editContentId === content.id) {
    return (
      <div className={styles.input}>
        <input
          defaultValue={content.title}
          name="title"
          autoFocus
          onBlur={(e) => submitName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            } else if (e.key === 'Escape') {
              setEditContentId(0)
            }
          }}
        />
      </div>
    )
  }

  return (
    <NavLink
      to={`/config/category/contentList/${content.category_id}/content/${content.id}`}
      className={({ isActive }) => [isActive ? styles.active : '', styles.link].join(' ')}
      onDragStart={(e) => {
        e.dataTransfer.setData('id', String(content.id))
      }}
      onContextMenu={contextMenu()}
    >
      <div className="truncate">{content.title}</div>
      <div className="text-[10px] opacity-80">{dayjs(content.created_at).format('YY/MM/DD')}</div>
    </NavLink>
  )
}
