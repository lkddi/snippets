import { AllApplication, Checklist, FolderFailed } from '@icon-park/react'
import { useStore } from '@renderer/store/useStore'
import { NavLink } from 'react-router-dom'
import styles from './styles.module.scss'
export const QuickNav = () => {
  const categoryBatchMode = useStore((state) => state.categoryBatchMode)
  const setCategoryBatchMode = useStore((state) => state.setCategoryBatchMode)

  return (
    <main className="mb-3 border-b">
      <div className="px-2 mt-2 mb-1 text-[10px] opacity-90 flex justify-between items-center">
        <span>快捷操作</span>
        {/* 分类批量管理入口 */}
        <Checklist
          theme="outline"
          size="12"
          strokeWidth={3}
          className={[categoryBatchMode ? 'text-blue-600' : '', 'cursor-pointer'].join(' ')}
          onClick={() => setCategoryBatchMode(!categoryBatchMode)}
        />
      </div>
      <NavLink
        to={`/config/category/contentList`}
        end
        className={({ isActive }) => (isActive ? styles.active : styles.link)}
      >
        <div className="flex items-center gap-1">
          <AllApplication theme="outline" size="12" strokeWidth={3} />
          <div className="truncate ">所有片段</div>
        </div>
      </NavLink>
      <NavLink
        to={`/config/category/contentList/0`}
        end
        className={({ isActive }) => (isActive ? styles.active : styles.link)}
      >
        <div className="flex items-center gap-1">
          <FolderFailed theme="outline" size="12" strokeWidth={3} />
          <div className="truncate">未分类</div>
        </div>
      </NavLink>
    </main>
  )
}
