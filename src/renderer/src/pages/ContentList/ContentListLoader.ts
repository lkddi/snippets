export default async ({ params, request }) => {
  const url = new URL(request.url)
  const searchWord = url.searchParams.get('searchWord')?.trim()
  const cid = params.cid
  const categoryId = cid === undefined ? null : Number(cid)

  if (searchWord) {
    // 在某个分类里搜索时只搜当前分类；"所有片段"下搜全部
    if (categoryId !== null && Number.isFinite(categoryId)) {
      return window.api.sql(
        `select * from contents where category_id = @category_id and (title like @keyword or content like @keyword) order by id desc`,
        'findAll',
        { category_id: categoryId, keyword: `%${searchWord}%` }
      )
    }
    return window.api.sql(
      `select * from contents where title like @keyword or content like @keyword order by id desc`,
      'findAll',
      { keyword: `%${searchWord}%` }
    )
  }

  if (categoryId !== null && Number.isFinite(categoryId)) {
    return window.api.sql(`select * from contents where category_id = @category_id order by id desc`, 'findAll', {
      category_id: categoryId
    })
  }

  return window.api.sql('select * from contents order by id desc', 'findAll')
}
