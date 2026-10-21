import { redirect } from 'react-router-dom'

export default async ({ request, params }) => {
  const formData = await request.formData()
  const data = Object.fromEntries(formData) as Record<string, string>

  if (!data.id) return { ok: false }

  await window.api.sql(
    `update contents set title=@title, content=@content, category_id=@category_id where id=@id`,
    'update',
    {
      id: Number(data.id),
      title: data.title ?? '',
      content: data.content ?? '',
      category_id: Number(data.category_id ?? 0)
    }
  )

  // 只有"切换了分类"才需要跳转；普通编辑直接返回，由 React Router 自动重新校验 loader。
  // 之前每次输入都 redirect，导致每次按键都产生一次导航、列表 loader 反复执行。
  if (params.cid !== undefined && String(data.category_id) !== String(params.cid)) {
    return redirect(`/config/category/contentList/${data.category_id}/content/${data.id}`)
  }

  return { ok: true }
}
