import { redirect } from 'react-router-dom'

const toCategoryId = (cid?: string): number => {
  const value = Number(cid)
  return Number.isFinite(value) ? value : 0
}

export default async ({ request, params }) => {
  const formData = await request.formData()
  const data = Object.fromEntries(formData) as Record<string, string>
  const cid = toCategoryId(params.cid)

  switch (request.method) {
    case 'POST': {
      const id = await window.api.sql<number>(
        `insert into contents (title, content, category_id, created_at) values ('未命名片段', '', @category_id, datetime())`,
        'insert',
        { category_id: cid }
      )
      // 之前用相对路径 redirect(`content/${id}`)，在"所有片段"（URL 没有 cid 段）时
      // 会拼出 /contentList/content/5，匹配不到 content/:id 路由直接白屏
      return redirect(`/config/category/contentList/${cid}/content/${id}`)
    }
    case 'DELETE': {
      await window.api.sql(`delete from contents where id = @id`, 'del', {
        id: Number(data.id)
      })
      // 删除后回到列表：如果继续停留在已删除片段的详情路由，loader 会拿到 undefined
      return redirect(
        params.cid === undefined ? '/config/category/contentList' : `/config/category/contentList/${cid}`
      )
    }
  }

  return {}
}
