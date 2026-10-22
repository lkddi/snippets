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
      <div className="border-b px-2 py-2 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 h-7 px-2 rounded-md bg-slate-100 border border-transparent focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <Search theme="outline" size="13" fill="#94a3b8" strokeWidth={3} />
          <input
            name="searchWord"
            type="text"
            placeholder="搜索片段..."
            className="outline-none text-xs w-full bg-transparent placeholder:text-slate-400"
            onChange={handleChange}
          />
        </div>

        <Add
          theme="outline"
          size="18"
          fill="#334155"
          strokeWidth={2}
          className="cursor-pointer hover:text-blue-600"
          onClick={() => {
            submit(null, { method: 'POST' })
          }}
        />
        {/* 片段批量管理入口 */}
        <Checklist
          theme="outline"
          size="18"
          fill={contentBatchMode ? '#2563eb' : '#334155'}
          strokeWidth={2}
          className="cursor-pointer hover:text-blue-600"
          onClick={() => setContentBatchMode(!contentBatchMode)}
        />
      </div>
    </Form>
  )
}
