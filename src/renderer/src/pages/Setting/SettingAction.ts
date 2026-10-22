/** macOS 默认占用这些组合键；用户已在系统设置里关掉对应功能时仍可正常使用，因此只做提示不做拦截 */
const SYSTEM_HINTS: Record<string, string> = {
  'Command+Space': 'macOS 默认用它聚焦搜索（Spotlight），需在「系统设置 → 键盘 → 键盘快捷键」里关掉 Spotlight 才能被本应用接管',
  'Control+Space': 'macOS 默认用它切换输入法，需在「系统设置 → 键盘 → 键盘快捷键」里改掉才能被本应用接管',
  'Command+Option+Space': 'macOS 默认用它打开访达搜索窗口，需在键盘快捷键里关掉才能被本应用接管',
  'Command+Tab': 'macOS 用它在应用间切换，应用无法接管'
}

/** 读取当前已保存的应用快捷键绑定（由 appShortCut:* IPC 维护，保存普通设置时要原样保留） */
const readAppShortCuts = async (): Promise<AppShortcutType[]> => {
  try {
    const row = (await window.api.sql<{ content: string }>(
      `select content from config where id=1`,
      'findOne'
    )) as { content: string } | undefined
    if (!row?.content) return []
    const parsed = JSON.parse(row.content) as Partial<ConfigDataType>
    return Array.isArray(parsed.appShortCuts) ? parsed.appShortCuts : []
  } catch {
    return []
  }
}

/** 搜索引擎列表：隐藏域里是 JSON，逐项清洗；清洗后为空时保留数据库里原有的列表 */
const parseEngines = (raw: unknown): WebEngineType[] => {
  try {
    const parsed = JSON.parse(String(raw ?? '[]'))
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const result: WebEngineType[] = []
    for (const item of parsed as Partial<WebEngineType>[]) {
      if (!item || typeof item.name !== 'string' || typeof item.keyword !== 'string') continue
      if (typeof item.url !== 'string') continue
      const name = item.name.trim()
      const keyword = item.keyword.trim().toLowerCase()
      const url = item.url.trim()
      // 关键字重复或地址缺占位符都视为非法项，直接跳过
      if (!name || !keyword || seen.has(keyword)) continue
      if (!/\{(query|q)\}/i.test(url)) continue
      seen.add(keyword)
      result.push({
        id: typeof item.id === 'string' && item.id ? item.id : `custom-${keyword}`,
        name,
        keyword,
        url,
        enabled: item.enabled !== false,
        builtin: Boolean(item.builtin)
      })
    }
    return result
  } catch {
    return []
  }
}

const readWebEngines = async (): Promise<WebEngineType[]> => {
  try {
    const row = (await window.api.sql<{ content: string }>(
      `select content from config where id=1`,
      'findOne'
    )) as { content: string } | undefined
    if (!row?.content) return []
    const parsed = JSON.parse(row.content) as Partial<ConfigDataType>
    return Array.isArray(parsed.webEngines) ? parsed.webEngines : []
  } catch {
    return []
  }
}

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

  // 搜索引擎：先清洗列表，再从「已启用」的引擎里挑默认项（默认项被停用时退回第一个启用项）
  const webEngines = parseEngines(data.webEngines)
  const engines = webEngines.length ? webEngines : await readWebEngines()
  const enabledEngines = engines.filter((item) => item.enabled)
  const requestedEngine = String(data.webSearchEngine ?? '')
  const engine = enabledEngines.some((item) => item.id === requestedEngine)
    ? requestedEngine
    : enabledEngines[0]?.id ?? engines[0]?.id ?? 'baidu'

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
    webEngines: engines,
    searchDirectories,
    // 应用快捷键由 appShortCut:* 这组 IPC 单独维护，这里必须原样带回，
    // 否则每次保存普通设置都会把绑定清空
    appShortCuts: await readAppShortCuts()
  })

  const changes = await window.api.sql<number>(`update config set content=@content where id=1`, 'update', {
    content
  })

  if (!changes) {
    await window.api.sql(`insert into config (id, content) values (1, @content)`, 'insert', { content })
  }

  // 目录有变化时通知主进程重建文件扫描缓存
  window.api.invalidateFiles()

  const isMacPlatform = (window.electron?.process?.platform ?? '') === 'darwin'
  const accelerator = String(data.shortCut).trim()
  const warning = (isMacPlatform && SYSTEM_HINTS[accelerator]) || ''

  return { ok: true, warning }
}
