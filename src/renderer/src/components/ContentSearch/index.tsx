import { Add } from '@icon-park/react'
import { useEffect, useRef } from 'react'
import { Form, useSubmit } from 'react-router-dom'

const SEARCH_DELAY = 250

export const ContentSearch = () => {
  const submit = useSubmit()
  const formRef = useRef<HTMLFormElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()

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
      <div className="border-b px-3  flex justify-between items-center">
        <input
          name="searchWord"
          type="text"
          placeholder="搜索..."
          className="outline-none text-sm font-bold py-2  w-full"
          onChange={handleChange}
        />

        <Add
          theme="outline"
          size="18"
          fill="#000000"
          strokeWidth={2}
          className="cursor-pointer"
          onClick={() => {
            submit(null, { method: 'POST' })
          }}
        />
      </div>
    </Form>
  )
}
