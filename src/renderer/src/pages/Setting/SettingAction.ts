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
  const searchAccelerator = String(data.shortCut ?? '').trim()
  const isRegister = await window.api.shortCut(searchAccelerator)
  // 系统级占用（Spotlight / 输入法等）由主进程读系统真实开关判定：
  // 用户已在系统设置里让出该键就能正常生效；仍被占用时允许保存但给出告警
  let warning = ''
  if (!isRegister) {
    const status = await window.api.getShortCutStatus()
    if (!status.reserved) {
      // 其它失败（被别的应用占用等）不能装作保存成功
      return { error: `快捷键 ${searchAccelerator || '(空)'} 注册失败，请换一个组合键` }
    }
    warning = status.error
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

  // 文件类型白名单：隐藏域里是已解析的扩展名数组（去点、小写）
  let fileSearchExtensions: string[] = []
  try {
    const parsed = JSON.parse(String(data.fileSearchExtensions ?? '[]'))
    if (Array.isArray(parsed)) {
      fileSearchExtensions = parsed.filter((item) => typeof item === 'string' && item)
    }
  } catch {
    // 同上，保持空数组 = 不限类型
  }

  // 文本扩展：总开关 + 规则列表（缩写和内容都非空才收）
  const textExpansionEnabled = String(data.textExpansionEnabled) === 'true'
  let textExpansions: TextExpansionType[] = []
  try {
    const parsed = JSON.parse(String(data.textExpansions ?? '[]'))
    if (Array.isArray(parsed)) {
      textExpansions = parsed
        .map((item) => item as Partial<TextExpansionType>)
        .filter(
          (item): item is TextExpansionType =>
            Boolean(item?.abbr?.trim()) && Boolean(item?.text)
        )
        .map((item) => ({ abbr: item.abbr.trim(), text: item.text }))
    }
  } catch {
    // 保持空列表，下次设置页再配置
  }

  const content = JSON.stringify({
    shortCut: searchAccelerator,
    databaseDirectory: data.databaseDirectory,
    clipboardShortCut: clipShortCut,
    clipboardRetentionDays: retentionDays,
    launchAtLogin,
    hideDockIcon,
    webSearchEngine: engine,
    webEngines: engines,
    searchDirectories,
    fileSearchExtensions,
    textExpansionEnabled,
    textExpansions,
    // 应用快捷键由 appShortCut:* 这组 IPC 单独维护，这里必须原样带回，
    // 否则每次保存普通设置都会把绑定清空
    appShortCuts: await readAppShortCuts(),
    // 语言设置：默认 'system'（跟随系统），用户可在设置页显式选择
    language: String(data.language ?? 'system')
  })

  const changes = await window.api.sql<number>(
    `update config set content=@content where id=1`,
    'update',
    {
      content
    }
  )

  if (!changes) {
    await window.api.sql(`insert into config (id, content) values (1, @content)`, 'insert', {
      content
    })
  }

  // 目录有变化时通知主进程重建文件扫描缓存
  window.api.invalidateFiles()

  // 文本扩展规则有变化时重启键盘钩子
  window.api.reloadExpansions()

  return { ok: true, warning }
}
