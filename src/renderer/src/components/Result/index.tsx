import useSelect from '@renderer/hooks/useSelect'
import { Fragment } from 'react'
import { FileCodeOne } from '@icon-park/react'
import classNames from 'classnames'
import './styles.scss'

export default function Result() {
  const { apps, data, activeIndex, setActiveIndex, activateApp, selectItem } = useSelect()

  // 无结果时保留容器（保持搜索窗背景完整），但不渲染分组
  if (apps.length === 0 && data.length === 0) return <main className="result" />

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
      {data.length > 0 && (
        <Fragment>
          <div className="group-label">片段</div>
          {data.map((item, index) => {
            // 片段的选中下标要加上前面应用的数量
            const itemIndex = apps.length + index
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
    </main>
  )
}
