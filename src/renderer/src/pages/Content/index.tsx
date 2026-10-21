import { useEffect, useRef } from 'react'
import { Form, useLoaderData, useSubmit } from 'react-router-dom'
import './content.scss'

const SAVE_DELAY = 400

export const Content = () => {
  const submit = useSubmit()
  const { content, categories } = useLoaderData() as {
    content: ContentType
    categories: CategoryType[]
  }
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => clearTimeout(timer.current)
  }, [])

  /**
   * 之前 onChange 直接 submit，每敲一个字就写库 + 重跑 loader + 导航，
   * 中文输入法的组合过程会被打断。这里改成防抖保存，失焦时立即保存。
   */
  const save = (form: HTMLFormElement | null, delay = SAVE_DELAY): void => {
    if (!form) return
    clearTimeout(timer.current)
    if (!delay) {
      submit(form, { replace: true })
      return
    }
    timer.current = setTimeout(() => submit(form, { replace: true }), delay)
  }

  return (
    <Form method="PUT">
      <main className="content-page" key={content.id}>
        <input type="text" name="id" defaultValue={content.id} hidden />
        <input
          name="title"
          autoFocus
          defaultValue={content.title}
          onChange={(e) => save(e.currentTarget.form)}
          onBlur={(e) => save(e.currentTarget.form, 0)}
        />
        <select
          name="category_id"
          defaultValue={String(content.category_id ?? 0)}
          onChange={(e) => save(e.currentTarget.form, 0)}
        >
          <option value="0">未分类</option>
          {categories.map((category) => (
            <option value={category.id} key={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <textarea
          name="content"
          placeholder="请输入内容..."
          defaultValue={content.content}
          onChange={(e) => save(e.currentTarget.form)}
          onBlur={(e) => save(e.currentTarget.form, 0)}
        />
      </main>
    </Form>
  )
}
