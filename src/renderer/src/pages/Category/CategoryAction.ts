import { redirect } from 'react-router-dom'

export default async ({ request }) => {
  const formData = await request.formData()
  const data = Object.fromEntries(formData) as Record<string, string>

  switch (request.method) {
    case 'POST': {
      return window.api.sql(`insert into categories (name, created_at) values ('未命名', datetime())`, 'insert')
    }
    case 'DELETE': {
      const id = Number(data.id)
      if (!Number.isFinite(id)) return { ok: false }

      // 删分类 + 把片段移到"未分类"必须在同一事务里，
      // 否则中途失败会留下 category_id 指向已删分类的孤儿片段（列表里永远查不到）
      await window.api.sql('', 'deleteCategory', { id })
      return redirect('/config/category/contentList')
    }
    case 'PUT': {
      return window.api.sql(`update categories set name=@name where id=@id`, 'update', {
        id: Number(data.id),
        name: data.name ?? ''
      })
    }
  }

  return {}
}
