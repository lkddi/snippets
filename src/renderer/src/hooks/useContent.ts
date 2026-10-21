import { useNavigate } from 'react-router-dom'

export default () => {
  const navigate = useNavigate()

  const updateContentCategory = async (id: number, categoryId: number): Promise<void> => {
    if (!Number.isFinite(id) || !Number.isFinite(categoryId)) return

    await window.api.sql(`update contents set category_id = @category_id where id = @id`, 'update', {
      id,
      category_id: categoryId
    })
    navigate(`/config/category/contentList/${categoryId}/content/${id}`)
  }

  return { updateContentCategory }
}
