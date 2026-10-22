export default async ({ request }) => {
  const formData = await request.formData()
  const data = Object.fromEntries(formData) as unknown as ConfigDataType

  // 空快捷键 = 清除（主进程会注销旧键并返回成功），非空才走注册校验
  const isRegister = await window.api.shortCut(data.shortCut)
  if (!isRegister) {
    // 之前注册失败也当作成功，用户以为配置保存了其实没生效
    return { error: `快捷键 ${data.shortCut || '(空)'} 注册失败，请换一个组合键` }
  }

  // 剪贴板快捷键：'doubleOption' 表示双击 Option 模式，主进程会注销已注册的标准快捷键，
  // 所以两种模式都要走一次 IPC，保证切换双向生效
  const clipShortCut = data.clipboardShortCut || 'doubleOption'
  const isClipRegister = await window.api.clipboardShortCut(clipShortCut)
  if (!isClipRegister) {
    return { error: `剪贴板快捷键 ${clipShortCut} 注册失败，请换一个组合键` }
  }

  // 保存天数：缺省回落 7 天，非法/超界值夹紧到 0~3650
  const rawDays = Number(data.clipboardRetentionDays)
  const retentionDays = Number.isFinite(rawDays)
    ? Math.max(0, Math.min(3650, Math.floor(rawDays)))
    : 7

  // 开机启动：formData 里实际是字符串，'true' 才算开；真实生效在切换开关时已通过 IPC 写入系统登录项
  const launchAtLogin = String(data.launchAtLogin) === 'true'
  // 程序坞图标：切换开关时已通过 IPC 生效，这里只负责持久化
  const hideDockIcon = String(data.hideDockIcon) === 'true'

  // 网页搜索引擎：非法值回落百度
  const engine = ['baidu', 'google', 'bing', 'duckduckgo'].includes(data.webSearchEngine)
    ? data.webSearchEngine
    : 'baidu'

  // 文件搜索目录：隐藏域里是 JSON 数组，逐项校验为非空字符串
  let searchDirectories: string[] = []
  try {
    const parsed = JSON.parse(String(data.searchDirectories ?? '[]'))
    if (Array.isArray(parsed)) {
      searchDirectories = parsed.filter((item) => typeof item === 'string' && item.trim())
    }
  } catch {
    // 解析失败保持空数组，下次设置页再配置
  }

  const content = JSON.stringify({
    shortCut: data.shortCut,
    databaseDirectory: data.databaseDirectory,
    clipboardShortCut: clipShortCut,
    clipboardRetentionDays: retentionDays,
    launchAtLogin,
    hideDockIcon,
    webSearchEngine: engine,
    searchDirectories
  })

  const changes = await window.api.sql<number>(`update config set content=@content where id=1`, 'update', {
    content
  })

  if (!changes) {
    await window.api.sql(`insert into config (id, content) values (1, @content)`, 'insert', { content })
  }

  // 目录有变化时通知主进程重建文件扫描缓存
  window.api.invalidateFiles()

  return { ok: true }
}
