import { useStore } from '@renderer/store/useStore'
import { Alert } from 'antd'
import { useEffect } from 'react'

function Error() {
  const error = useStore((state) => state.error)
  const setError = useStore((state) => state.setError)

  useEffect(() => {
    if (!error) return
    const id = setTimeout(() => setError(''), 2000)
    return () => clearTimeout(id)
  }, [error, setError])

  if (!error) return null

  return (
    <main className="absolute top-0 z-10 w-full">
      <Alert message={error} type="info" showIcon />
    </main>
  )
}

export default Error
