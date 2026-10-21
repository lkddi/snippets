import useSelect from '@renderer/hooks/useSelect'
import classNames from 'classnames'
import './styles.scss'

export default function Result() {
  const { apps, data, activeIndex, setActiveIndex, activateApp, selectItem } = useSelect()

  // 无结果时保留容器（保持搜索窗背景完整），但不渲染分组
  if (apps.length === 0 && data.length === 0) return <main className="result" />

  return (
    <main className="result">
      {apps.length > 0 && (
        <>
          <div className="group-label">应用</div>
          {apps.map((item, index) => (
            <div
              key={item.path}
              className={classNames('item', { active: index === activeIndex })}
              onClick={() => void activateApp(item.path)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              {item.icon && <img src={item.icon} alt="" />}
              <span>{item.name}</span>
            </div>
          ))}
        </>
      )}
      {data.length > 0 && (
        <>
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
                <span>{item.title}</span>
              </div>
            )
          })}
        </>
      )}
    </main>
  )
}
