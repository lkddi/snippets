import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

/** 路由级错误兜底：之前删掉正在查看的片段会因为没有 errorElement 直接白屏 */
export const RouteError = () => {
  const error = useRouteError()

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : '未知错误'

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-2 text-sm text-slate-600">
      <div className="text-base font-bold">页面出错了</div>
      <div className="opacity-80 max-w-[80%] break-all text-center">{message}</div>
      <button
        className="mt-2 px-3 py-1 rounded bg-slate-700 text-white text-xs"
        onClick={() => window.location.reload()}
      >
        重新加载
      </button>
    </div>
  )
}
