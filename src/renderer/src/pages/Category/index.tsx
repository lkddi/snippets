import { BatchToolbar } from '@renderer/components/BatchToolbar'
import { CategoryItem } from '@renderer/components/CategoryItem'
import { FooterMenu } from '@renderer/components/FooterMenu'
import { QuickNav } from '@renderer/components/QuickNav'
import { Resizer } from '@renderer/components/Resizer'
import { useStore } from '@renderer/store/useStore'
import { Outlet, useFetcher, useLoaderData } from 'react-router-dom'
import './category.scss'

export const Category = () => {
  const categories = useLoaderData() as CategoryType[]
  const fetcher = useFetcher()
  const categoryBatchMode = useStore((state) => state.categoryBatchMode)
  const setCategoryBatchMode = useStore((state) => state.setCategoryBatchMode)
  const selectedCategoryIds = useStore((state) => state.selectedCategoryIds)
  const setSelectedCategoryIds = useStore((state) => state.setSelectedCategoryIds)

  const deleteSelected = (ids: number[]): void => {
    fetcher.submit({ ids: ids.join(',') }, { method: 'DELETE', action: '/config/category' })
    // 提交后立即退出批量模式并清空选中，避免残留失效 id
    setCategoryBatchMode(false)
  }

  return (
    <main className="category-page">
      <div className="categories">
        <QuickNav />
        {categoryBatchMode && (
          <BatchToolbar
            allIds={categories.map((category) => category.id)}
            selectedIds={selectedCategoryIds}
            setSelectedIds={setSelectedCategoryIds}
            onExit={() => setCategoryBatchMode(false)}
            onDelete={deleteSelected}
            confirmText={`确定删除选中的 ${selectedCategoryIds.length} 个分类吗？分类下的片段将移入「未分类」。`}
            hint="删除分类后，其下片段会移入「未分类」"
          />
        )}
        {categories.map((category) => (
          <CategoryItem category={category} key={category.id} />
        ))}
      </div>
      {/* 分类列宽可拖拽调整，宽度持久化到 localStorage */}
      <Resizer
        storageKey="categoryColumnWidth"
        cssVar="--category-width"
        defaultWidth={160}
        min={120}
        max={480}
        className="resizer"
      />
      <FooterMenu />
      <div className="content">
        <Outlet />
      </div>
    </main>
  )
}
