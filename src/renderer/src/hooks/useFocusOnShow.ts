import { RefObject, useEffect } from 'react'

/**
 * 窗口每次被唤起（重新获得焦点）时把光标放回指定元素。
 *
 * autoFocus 只在组件首次挂载时生效，而搜索窗 / 剪贴板面板是懒创建后
 * 反复 hide/show 复用的：第二次唤起起 DOM 不会重新挂载，光标就丢了，
 * 表现为"唤醒后输入框里没有光标，打字没反应"。
 * 只要接受 HTMLElement（原生 input）或带 focus() 的对象（antd InputRef）。
 */
const useFocusOnShow = <T extends { focus(): void }>(ref: RefObject<T | null>): void => {
  useEffect(() => {
    const focus = (): void => {
      // 稍等一帧，等原生窗口真正成为焦点窗口后再聚焦，过早调用会被吞掉
      window.setTimeout(() => ref.current?.focus(), 60)
    }
    // 首次挂载兜底（autoFocus 理论上已覆盖，双保险无害）
    if (document.hasFocus()) focus()
    window.addEventListener('focus', focus)
    return () => window.removeEventListener('focus', focus)
  }, [ref])
}

export default useFocusOnShow
