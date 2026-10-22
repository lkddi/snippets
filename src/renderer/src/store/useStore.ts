import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
interface StateProps {
  /** 搜索结果 */
  data: ContentType[]
  setData: (data: ContentType[]) => void
  /** 本机应用搜索结果，聚合展示时排在片段前面 */
  apps: AppType[]
  setApps: (apps: AppType[]) => void
  /** 文件搜索结果（设置里配置的目录），排在应用之后 */
  files: FileType[]
  setFiles: (files: FileType[]) => void
  /** 网页搜索兜底项：有关键词就存在，展示在结果末尾 */
  web: WebSearchType | null
  setWeb: (web: WebSearchType | null) => void
  search: string
  setSearch: (search: string) => void
  error: string
  setError: (message: string) => void
  id: number
  setId: (id: number) => void
  editCategoryId: number
  setEditCategoryId: (id: number) => void
  /** 正在内联重命名的片段 id（0 表示无，瞬态） */
  editContentId: number
  setEditContentId: (id: number) => void
  /** 分类批量管理模式与选中集合（瞬态，不持久化） */
  categoryBatchMode: boolean
  setCategoryBatchMode: (mode: boolean) => void
  selectedCategoryIds: number[]
  toggleCategorySelected: (id: number) => void
  setSelectedCategoryIds: (ids: number[]) => void
  /** 片段批量管理模式与选中集合 */
  contentBatchMode: boolean
  setContentBatchMode: (mode: boolean) => void
  selectedContentIds: number[]
  toggleContentSelected: (id: number) => void
  setSelectedContentIds: (ids: number[]) => void
}

/**
 * 注意：配置不再放这里。
 * 之前 config.databaseDirectory 存在 localStorage，一旦被清空，主进程就会把库目录置空
 * 并回落到桌面上的另一个数据库，表现为"片段全丢了"。配置现在以数据库 / 主进程文件为准。
 */
export const useStore = create(
  persist<StateProps, [], [], Pick<StateProps, 'error' | 'id' | 'editCategoryId'>>(
    (set) => ({
      data: [],
      setData: (data) => set({ data }),
      apps: [],
      setApps: (apps) => set({ apps }),
      files: [],
      setFiles: (files) => set({ files }),
      web: null,
      setWeb: (web) => set({ web }),
      search: '',
      setSearch: (content) => set({ search: content }),
      error: '',
      setError: (message) => set({ error: message }),
      id: 0,
      setId: (id) => set({ id }),
      editCategoryId: 0,
      setEditCategoryId: (editCategoryId) => set({ editCategoryId }),
      editContentId: 0,
      setEditContentId: (editContentId) => set({ editContentId }),
      categoryBatchMode: false,
      setCategoryBatchMode: (categoryBatchMode) =>
        set({ categoryBatchMode, selectedCategoryIds: [] }),
      selectedCategoryIds: [],
      toggleCategorySelected: (id) =>
        set((state) => ({
          selectedCategoryIds: state.selectedCategoryIds.includes(id)
            ? state.selectedCategoryIds.filter((item) => item !== id)
            : [...state.selectedCategoryIds, id]
        })),
      setSelectedCategoryIds: (selectedCategoryIds) => set({ selectedCategoryIds }),
      contentBatchMode: false,
      setContentBatchMode: (contentBatchMode) => set({ contentBatchMode, selectedContentIds: [] }),
      selectedContentIds: [],
      toggleContentSelected: (id) =>
        set((state) => ({
          selectedContentIds: state.selectedContentIds.includes(id)
            ? state.selectedContentIds.filter((item) => item !== id)
            : [...state.selectedContentIds, id]
        })),
      setSelectedContentIds: (selectedContentIds) => set({ selectedContentIds })
    }),
    {
      name: 'houdunren-storage',
      storage: createJSONStorage(() => localStorage),
      // 搜索框内容与各类搜索结果都是瞬态数据，持久化后重开搜索窗会
      // 显示上一次的旧结果（文件/网页兜底尤其明显），这里全部排除
      partialize: (state) => ({
        error: state.error,
        id: state.id,
        editCategoryId: state.editCategoryId
      })
    }
  )
)
