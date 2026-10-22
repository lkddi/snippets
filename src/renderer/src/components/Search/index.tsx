import { Search as SearchIcon, SettingOne } from '@icon-park/react'
import useSearch from '@renderer/hooks/useSearch'
import { ChangeEvent } from 'react'
import './search.scss'

export default function Search() {
  const { handleSearch, search } = useSearch()

  // 搜索窗现在是置顶的，打开配置窗之前先把它收起来，否则会压住配置窗
  const openWindow = (name: WindowNameType): void => {
    window.api.closeWindow('search')
    window.api.openWindow(name)
  }

  return (
    <main className="launcher">
      {/* Alfred 式搜索栏：左侧放大镜 + 大号输入框，右侧设置入口 */}
      <section className="search-bar drag">
        <SearchIcon
          theme="outline"
          size="20"
          fill="#94a3b8"
          strokeWidth={4}
          className="search-glyph"
        />
        <input
          className="search-input nodrag"
          value={search}
          onChange={(e: ChangeEvent<HTMLInputElement>) => handleSearch(e)}
          placeholder="搜索应用 / 文件 / 片段，回车用搜索引擎搜索"
          autoFocus
          spellCheck={false}
        />
        <SettingOne
          theme="outline"
          size="18"
          fill="#94a3b8"
          strokeWidth={4}
          className="setting-gear nodrag"
          onClick={() => openWindow('code')}
        />
      </section>
    </main>
  )
}
