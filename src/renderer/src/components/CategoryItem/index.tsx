import { FolderClose } from '@icon-park/react'
import useCategory from '@renderer/hooks/useCategory'
import { useStore } from '@renderer/store/useStore'
import { NavLink, useFetcher } from 'react-router-dom'
import styles from './styles.module.scss'

interface Props {
  category: CategoryType
}

export const CategoryItem = ({ category }: Props) => {
  const editCategoryId = useStore((state) => state.editCategoryId)
  const setEditCategoryId = useStore((state) => state.setEditCategoryId)
  const fetcher = useFetcher()
  const { contextMenu, dragHandle } = useCategory(category)

  const linkStyls = (isActive: boolean): string => (isActive ? styles.active : styles.link)

  const closeEdit = (): void => setEditCategoryId(0)

  const submitName = (name: string): void => {
    const value = name.trim()
    if (value && value !== category.name) {
      fetcher.submit({ id: category.id, name: value }, { method: 'PUT' })
    }
    closeEdit()
  }

  return (
    <>
      {editCategoryId === category.id ? (
        <div className={styles.input}>
          <input
            defaultValue={category.name}
            name="name"
            autoFocus
            // 之前只有 Enter 能退出编辑，误触双击后只能刷新页面
            onBlur={(e) => submitName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // 统一走 onBlur 提交，避免 Enter 与 blur 重复提交
                e.currentTarget.blur()
              } else if (e.key === 'Escape') {
                closeEdit()
              }
            }}
          />
        </div>
      ) : (
        <NavLink
          onDoubleClick={() => setEditCategoryId(category.id)}
          to={`/config/category/contentList/${category.id}`}
          className={({ isActive }) => linkStyls(isActive)}
          onContextMenu={contextMenu()}
          {...dragHandle}
        >
          <div className="flex items-center gap-1">
            <FolderClose theme="outline" size="12" strokeWidth={3} />
            <div className="truncate">{category.name}</div>
          </div>
        </NavLink>
      )}
    </>
  )
}
