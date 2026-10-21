import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
interface StateProps {
  /** 搜索结果 */
  data: ContentType[]
  setData: (data: ContentType[]) => void
  /** 本机应用搜索结果，聚合展示时排在片段前面 */
  apps: AppType[]
  setApps: (apps: AppType[]) => void
  search: string
  setSearch: (search: string) => void
  error: string
  setError: (message: string) => void
  id: number
  setId: (id: number) => void
  editCategoryId: number
  setEditCategoryId: (id: number) => void
}

/**
 * 注意：配置不再放这里。
 * 之前 config.databaseDirectory 存在 localStorage，一旦被清空，主进程就会把库目录置空
 * 并回落到桌面上的另一个数据库，表现为"片段全丢了"。配置现在以数据库 / 主进程文件为准。
 */
export const useStore = create(
  persist<StateProps>(
    (set) => ({
      data: [],
      setData: (data) => set({ data }),
      apps: [],
      setApps: (apps) => set({ apps }),
      search: '',
      setSearch: (content) => set({ search: content }),
      error: '',
      setError: (message) => set({ error: message }),
      id: 0,
      setId: (id) => set({ id }),
      editCategoryId: 0,
      setEditCategoryId: (editCategoryId) => set({ editCategoryId })
    }),
    {
      name: 'houdunren-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
)
