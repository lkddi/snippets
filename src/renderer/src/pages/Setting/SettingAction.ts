export default async ({ request }) => {
  const formData = await request.formData()
  const data = Object.fromEntries(formData) as unknown as ConfigDataType

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

  const content = JSON.stringify({
    shortCut: data.shortCut,
    databaseDirectory: data.databaseDirectory,
    clipboardShortCut: clipShortCut,
    clipboardRetentionDays: retentionDays,
    launchAtLogin
  })

  const changes = await window.api.sql<number>(`update config set content=@content where id=1`, 'update', {
    content
  })

  if (!changes) {
    await window.api.sql(`insert into config (id, content) values (1, @content)`, 'insert', { content })
  }

  return { ok: true }
}
