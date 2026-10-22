import { redirect } from 'react-router-dom'

export default async ({ request }) => {
  const formData = await request.formData()
  const data = Object.fromEntries(formData) as Record<string, string>

  switch (request.method) {
    case 'POST': {
      return window.api.sql(`insert into categories (name, created_at) values ('未命名', datetime())`, 'insert')
    }
    case 'DELETE': {
      // 兼容单个删除（id）与批量管理（ids，逗号分隔）
      const ids = (data.ids ?? data.id ?? '')
        .toString()
        .split(',')
        .map(Number)
        .filter((id) => Number.isFinite(id) && id > 0)
      if (!ids.length) return { ok: false }

      // deleteCategory 自带事务（删分类 + 片段移入未分类），逐个执行即可
      for (const id of ids) {
        await window.api.sql('', 'deleteCategory', { id })
      }
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
