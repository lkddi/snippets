import isPropValid from '@emotion/is-prop-valid'
import Error from '@renderer/components/Error'
import Result from '@renderer/components/Result'
import Search from '@renderer/components/Search'
import useIgnoreMouseEvents from '@renderer/hooks/useIgnoreMouseEvents'
import { useEffect, useRef } from 'react'
import { StyleSheetManager } from 'styled-components'

function Home(): JSX.Element {
  const mainRef = useRef<HTMLDivElement | null>(null)
  const { bindIgnoreMouseEvents } = useIgnoreMouseEvents()

  // 初始化（建表、注册快捷键）已收敛到主进程，见 src/main/index.ts。
  // 这里只负责窗口的鼠标穿透交互，并且必须在 effect 里绑定、卸载时清理。
  useEffect(() => {
    return bindIgnoreMouseEvents(mainRef)
  }, [])

  return (
    <StyleSheetManager shouldForwardProp={isPropValid}>
      <main className="relative p-3" ref={mainRef}>
        <Error />
        {/* Alfred 风格面板外壳：搜索栏与结果列表共用一个圆角容器 */}
        <div className="launcher-shell">
          <Search />
          <Result />
        </div>
      </main>
    </StyleSheetManager>
  )
}

export default Home
