import '@renderer/assets/global.scss'
import '@renderer/assets/tailwind.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import router from './router'
import { useI18nStore } from '@renderer/i18n'

// 启动时用主进程返回的系统语言填充 i18n 缓存，保证「跟随系统」在首屏即正确解析
void window.api.getSystemLocale().then((locale) => {
  useI18nStore.getState().setSystemLocale(locale)
})

// import './layout.css'
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
