import { Delete } from '@icon-park/react'
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
  const selected = selectedContentIds.includes(content.id)

  const contextMenu = () =>
    showContextMenu(
      [
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
