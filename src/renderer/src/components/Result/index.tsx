import useSelect from '@renderer/hooks/useSelect'
import { Fragment } from 'react'
import { Earth, FileCodeOne, FileText, FolderClose } from '@icon-park/react'
import classNames from 'classnames'
import './styles.scss'

/** 网页搜索引擎显示名（与 webSearch.ts 的模板一一对应） */
const ENGINE_LABELS: Record<string, string> = {
  baidu: '百度',
  google: 'Google',
  bing: '必应',
  duckduckgo: 'DuckDuckGo'
}

export default function Result() {
  const { apps, files, data, web, activeIndex, setActiveIndex, activateApp, activateFile, activateWeb, selectItem } =
    useSelect()

  // 文件与网页兜底在各自分组的下标偏移
  const filesOffset = apps.length
  const dataOffset = filesOffset + files.length
  const webIndex = dataOffset + data.length

  // 无结果时保留容器（保持搜索窗背景完整），但不渲染分组
  if (apps.length === 0 && files.length === 0 && data.length === 0 && !web) return <main className="result" />

  return (
    <main className="result">
      {apps.length > 0 && (
        <Fragment>
          <div className="group-label">应用</div>
          {apps.map((item, index) => (
            <div
              key={item.path}
              className={classNames('item', { active: index === activeIndex })}
              onClick={() => void activateApp(item.path)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              {item.icon ? (
                <img className="item-icon" src={item.icon} alt="" />
              ) : (
                <span className="item-icon item-fallback">{item.name.slice(0, 1)}</span>
              )}
              <span className="item-title">{item.name}</span>
              {/* 副标题优先展示本地化中文名（WeChat -> 微信），其次拼音 */}
              {(item.alias || item.pinyin) && (
                <span className="item-subtitle">{item.alias || item.pinyin}</span>
              )}
            </div>
          ))}
        </Fragment>
      )}
      {files.length > 0 && (
        <Fragment>
          <div className="group-label">文件</div>
          {files.map((item, index) => {
            const itemIndex = filesOffset + index
            return (
              <div
                key={item.path}
                className={classNames('item', { active: itemIndex === activeIndex })}
                onClick={() => void activateFile(item.path)}
                onMouseEnter={() => setActiveIndex(itemIndex)}
              >
                <span className="item-icon item-fallback file">
                  {item.isDir ? (
                    <FolderClose theme="outline" size="16" fill="currentColor" strokeWidth={4} />
                  ) : (
                    <FileText theme="outline" size="16" fill="currentColor" strokeWidth={4} />
                  )}
                </span>
                <span className="item-title">{item.name}</span>
                <span className="item-subtitle item-path" title={item.path}>
                  {item.isDir ? '文件夹' : '文件'}
                </span>
              </div>
            )
          })}
        </Fragment>
      )}
      {data.length > 0 && (
        <Fragment>
          <div className="group-label">片段</div>
          {data.map((item, index) => {
            const itemIndex = dataOffset + index
            return (
              <div
                key={item.id}
                className={classNames('item', { active: itemIndex === activeIndex })}
                onClick={() => void selectItem(item.id)}
                onMouseEnter={() => setActiveIndex(itemIndex)}
              >
                <span className="item-icon item-fallback snippet">
                  <FileCodeOne theme="outline" size="16" fill="currentColor" strokeWidth={4} />
                </span>
                <span className="item-title">{item.title}</span>
              </div>
            )
          })}
        </Fragment>
      )}
      {web && (
        <Fragment>
          <div className="group-label">网页</div>
          <div
            className={classNames('item', { active: webIndex === activeIndex })}
            onClick={() => void activateWeb()}
            onMouseEnter={() => setActiveIndex(webIndex)}
          >
            <span className="item-icon item-fallback web">
              <Earth theme="outline" size="16" fill="currentColor" strokeWidth={4} />
            </span>
            <span className="item-title">
              用 {ENGINE_LABELS[web.engine] ?? '百度'} 搜索「{web.query}」
            </span>
            <span className="item-subtitle">浏览器打开</span>
          </div>
        </Fragment>
      )}
    </main>
  )
}
