import { Add, Checklist, Search } from '@icon-park/react'
import { useEffect, useRef } from 'react'
import { Form, useSubmit } from 'react-router-dom'
import { useStore } from '@renderer/store/useStore'

const SEARCH_DELAY = 250

export const ContentSearch = () => {
  const submit = useSubmit()
  const formRef = useRef<HTMLFormElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const contentBatchMode = useStore((state) => state.contentBatchMode)
  const setContentBatchMode = useStore((state) => state.setContentBatchMode)

  useEffect(() => {
    return () => clearTimeout(timer.current)
  }, [])

  // 防抖：之前每敲一个字就导航一次，中文输入会被打断
  const handleChange = (): void => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (formRef.current) submit(formRef.current, { replace: true })
    }, SEARCH_DELAY)
  }

  return (
    <Form ref={formRef}>
      <div className="px-2.5 py-2 flex items-center gap-1.5 bg-white border-b border-[#e3e8f0]">
        <div className="flex-1 flex items-center gap-1.5 h-7 px-2 rounded-lg bg-[#f5f6f8] border border-[#e3e8f0] focus-within:bg-white focus-within:border-[#0a84ff] focus-within:ring-[3px] focus-within:ring-[#0a84ff]/15 transition-all">
          <Search theme="outline" size="13" fill="#9aa5b5" strokeWidth={3} />
          <input
            name="searchWord"
            type="text"
            placeholder="搜索片段..."
            className="outline-none text-xs w-full bg-transparent text-slate-700 placeholder:text-slate-400"
            onChange={handleChange}
          />
        </div>

        {/* 图标按钮：与设置页侧栏 hover 语言一致（浅灰圆角块） */}
        <button
          type="button"
          title="新建片段"
          className="p-1 rounded-md text-slate-500 hover:bg-[#e6ebf4] hover:text-[#0a84ff] transition-colors"
          onClick={() => {
            submit(null, { method: 'POST' })
          }}
        >
          <Add theme="outline" size="16" strokeWidth={3} fill="currentColor" />
        </button>
        {/* 片段批量管理入口 */}
        <button
          type="button"
          title="批量管理"
          className={[
            'p-1 rounded-md transition-colors',
            contentBatchMode
              ? 'text-[#0a84ff] bg-[#0a84ff]/10'
              : 'text-slate-500 hover:bg-[#e6ebf4] hover:text-[#0a84ff]'
          ].join(' ')}
          onClick={() => setContentBatchMode(!contentBatchMode)}
        >
          <Checklist theme="outline" size="16" strokeWidth={3} fill="currentColor" />
        </button>
      </div>
    </Form>
  )
}
