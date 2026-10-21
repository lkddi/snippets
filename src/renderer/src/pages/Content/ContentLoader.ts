import { redirect } from 'react-router-dom'

export default async ({ params }) => {
  const id = Number(params.id)
  if (!Number.isFinite(id)) return redirect('/config/category/contentList')

  // 用命名参数，不再把 URL 参数直接拼进 SQL
  const content = (await window.api.sql(`select * from contents where id = @id`, 'findOne', {
    id
  })) as ContentType | undefined

  // 片段被删除（或 id 不存在）时回列表，避免组件里读 content.id 直接崩掉
  if (!content) {
    return redirect(`/config/category/contentList/${params.cid ?? 0}`)
  }

  const categories = (await window.api.sql(
    'select * from categories order by id desc',
    'findAll'
  )) as CategoryType[]

  return { content, categories }
}
