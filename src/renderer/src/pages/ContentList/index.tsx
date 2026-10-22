import { ContentItem } from '@renderer/components/ContentItem'
import { BatchToolbar } from '@renderer/components/BatchToolbar'
import { ContentSearch } from '@renderer/components/ContentSearch'
import { Resizer } from '@renderer/components/Resizer'
import { useStore } from '@renderer/store/useStore'
import { Outlet, useFetcher, useLoaderData, useParams } from 'react-router-dom'
import './contentList.scss'
export const ContentList = () => {
  const contents = useLoaderData() as ContentType[]
  const params = useParams()
  const fetcher = useFetcher()
  const contentBatchMode = useStore((state) => state.contentBatchMode)
  const setContentBatchMode = useStore((state) => state.setContentBatchMode)
  const selectedContentIds = useStore((state) => state.selectedContentIds)
  const setSelectedContentIds = useStore((state) => state.setSelectedContentIds)

  const deleteSelected = (ids: number[]): void => {
    // 提交目标固定为列表路由：当前停在片段详情页时，隐式提交会命中错误的 action
    const action =
      params.cid !== undefined
        ? `/config/category/contentList/${params.cid}`
        : '/config/category/contentList'
    fetcher.submit({ ids: ids.join(',') }, { method: 'DELETE', action })
    // 提交后立即退出批量模式并清空选中，避免残留失效 id
    setContentBatchMode(false)
  }

  return (
    <main className="contentList-page">
      <div className="list">
        <ContentSearch />
        {contentBatchMode && (
          <BatchToolbar
            allIds={contents.map((content) => content.id)}
            selectedIds={selectedContentIds}
            setSelectedIds={setSelectedContentIds}
            onExit={() => setContentBatchMode(false)}
            onDelete={deleteSelected}
            confirmText={`确定删除选中的 ${selectedContentIds.length} 个片段吗？删除后不可恢复。`}
          />
        )}
        {contents.map((content) => (
          <ContentItem content={content} key={content.id} />
        ))}
      </div>
      {/* 片段列宽可拖拽调整，宽度持久化到 localStorage */}
      <Resizer
        storageKey="contentColumnWidth"
        cssVar="--content-width"
        defaultWidth={250}
        min={160}
        max={480}
        className="resizer"
      />
      <div className="content">
        <Outlet />
      </div>
    </main>
  )
}
