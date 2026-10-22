import { RouteError } from '@renderer/components/RouteError'
import Config from '@renderer/layouts/Config'
import Home from '@renderer/layouts/Home'
import { Category } from '@renderer/pages/Category'
import CategoryAction from '@renderer/pages/Category/CategoryAction'
import CategoryLoader from '@renderer/pages/Category/CategoryLoader'
import { Clipboard } from '@renderer/pages/Clipboard'
import { Content } from '@renderer/pages/Content'
import ContentAction from '@renderer/pages/Content/ContentAction'
import ContentLoader from '@renderer/pages/Content/ContentLoader'
import { ContentList } from '@renderer/pages/ContentList'
import ContentListAction from '@renderer/pages/ContentList/ContentListAction'
import ContentListLoader from '@renderer/pages/ContentList/ContentListLoader'
import { Setting, type SettingSection } from '@renderer/pages/Setting'
import SettingAction from '@renderer/pages/Setting/SettingAction'
import SettingLoader from '@renderer/pages/Setting/SettingLoader'
import { Welcome } from '@renderer/pages/Welcome'
import { createHashRouter, Navigate } from 'react-router-dom'

/** 设置窗口的分区：左侧导航的每一项对应一个子路由 */
const SETTING_SECTIONS: SettingSection[] = [
  'general',
  'shortcuts',
  'apps',
  'search',
  'clipboard',
  'data',
  'about'
]

const router = createHashRouter([
  {
    path: '/',
    element: <Home />,
    errorElement: <RouteError />
  },
  {
    // 剪贴板历史窗口（快捷键/双击 Option 唤起，hash /#clipboard）
    path: 'clipboard',
    element: <Clipboard />,
    errorElement: <RouteError />
  },
  {
    // 设置窗：左侧导航 + 右侧内容，代码片段也收在这里
    path: 'config',
    element: <Config />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="general" replace /> },
      ...SETTING_SECTIONS.map((section) => ({
        path: section,
        element: <Setting section={section} />,
        loader: SettingLoader,
        action: SettingAction,
        errorElement: <RouteError />
      })),
      {
        path: 'category',
        element: <Category />,
        loader: CategoryLoader,
        action: CategoryAction,
        errorElement: <RouteError />,
        children: [
          {
            path: 'contentList/:cid?',
            loader: ContentListLoader,
            action: ContentListAction,
            element: <ContentList />,
            errorElement: <RouteError />,
            children: [
              {
                index: true,
                element: <Welcome />
              },
              {
                path: 'content/:id',
                loader: ContentLoader,
                action: ContentAction,
                element: <Content />,
                errorElement: <RouteError />
              }
            ]
          }
        ]
      }
    ]
  }
])
export default router
