import { MutableRefObject } from 'react'

export default () => {
  /**
   * 绑定鼠标穿透逻辑：鼠标在窗口内容上时正常响应，移到透明区域（body）时穿透。
   * 返回清理函数，避免 StrictMode 下重复绑定 / 卸载后监听残留。
   */
  const bindIgnoreMouseEvents = <T extends HTMLElement>(el: MutableRefObject<T | null>) => {
    const handleContentOver = (): void => {
      window.api.setIgnoreMouseEvents(false)
    }

    const handleBodyOver = (e: MouseEvent): void => {
      if (e.target === document.body) {
        window.api.setIgnoreMouseEvents(true, { forward: true })
      }
    }

    el.current?.addEventListener('mouseover', handleContentOver)
    document.body?.addEventListener('mouseover', handleBodyOver)

    return () => {
      el.current?.removeEventListener('mouseover', handleContentOver)
      document.body?.removeEventListener('mouseover', handleBodyOver)
    }
  }

  return { bindIgnoreMouseEvents }
}
