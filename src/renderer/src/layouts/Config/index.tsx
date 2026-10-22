import {
  ApplicationOne,
  Clipboard,
  Code,
  DatabaseConfig,
  FolderSearch,
  Info,
  Keyboard,
  Power
} from '@icon-park/react'
//右键菜单
import { MantineProvider } from '@mantine/core'
import { ContextMenuProvider } from 'mantine-contextmenu'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import '@mantine/core/styles.layer.css'
import 'mantine-contextmenu/styles.layer.css'
import './styles.scss'

type NavItem = {
  to: string
  label: string
  icon: typeof Power
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: '偏好设置',
    items: [
      { to: '/config/general', label: '通用', icon: Power },
      { to: '/config/shortcuts', label: '快捷键', icon: Keyboard },
      { to: '/config/apps', label: '应用快捷键', icon: ApplicationOne },
      { to: '/config/search', label: '搜索', icon: FolderSearch },
      { to: '/config/clipboard', label: '剪贴板', icon: Clipboard },
      { to: '/config/data', label: '数据', icon: DatabaseConfig },
      { to: '/config/about', label: '说明', icon: Info }
    ]
  },
  {
    label: '内容',
    items: [{ to: '/config/category/contentList', label: '代码片段', icon: Code }]
  }
]

export default function Config() {
  const location = useLocation()
  // 代码片段是多列布局，自己管理滚动，内容区这里不能再加内边距和滚动条
  const embedded = location.pathname.includes('/category')

  return (
    <MantineProvider defaultColorScheme="auto">
      <ContextMenuProvider>
        <div className="settings-shell">
          <aside className="settings-nav">
            <div className="nav-brand">
              <span className="brand-mark">灵</span>
              <span className="brand-text">
                <b>灵犀</b>
                <i>快捷启动 · 效率工具箱</i>
              </span>
            </div>

            {NAV_GROUPS.map((group) => (
              <div className="nav-group" key={group.label}>
                <div className="nav-group-label">{group.label}</div>
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                    >
                      <Icon theme="outline" size={16} fill="currentColor" strokeWidth={4.6} />
                      <span>{item.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            ))}

            <div className="nav-footer">⌘, 随时打开设置</div>
          </aside>

          <section className={embedded ? 'settings-content is-embedded' : 'settings-content'}>
            <Outlet />
          </section>
        </div>
      </ContextMenuProvider>
    </MantineProvider>
  )
}
