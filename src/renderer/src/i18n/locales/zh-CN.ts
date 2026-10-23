// 源语言（中文）文案。这里是 UI 文案的唯一真实来源，新增/修改文案以本文件为准。
const zhCN = {
  setting: {
    section: {
      general: { title: '通用', desc: '启动方式、程序坞与菜单栏行为' },
      shortcuts: { title: '快捷键', desc: '唤起搜索窗与剪贴板面板的全局快捷键' },
      apps: { title: '应用快捷键', desc: '给单个应用绑定启动 / 隐藏热键，按一下启动，再按一下收起' },
      search: { title: '搜索', desc: '网页兜底搜索与文件搜索目录' },
      clipboard: { title: '剪贴板', desc: '历史记录的保存时长' },
      data: { title: '数据', desc: '片段与剪贴板数据存放位置' },
      about: { title: '说明', desc: '软件版本、更新与作者信息' }
    },
    general: {
      title: '启动与外观',
      launchAtLogin: { label: '登录时启动', sub: '开机后自动驻留菜单栏，不弹窗口' },
      hideDock: { label: '隐藏程序坞图标', sub: '开启后只在菜单栏驻留，程序坞不再显示' },
      menuBarIcon: { label: '菜单栏图标', sub: '点按唤起搜索，右键打开菜单', static: '常驻' },
      language: { label: '语言', sub: '跟随系统时与系统语言一致；未支持的语言回落英文' }
    },
    shortcuts: {
      title: '全局快捷键',
      openSearch: { label: '打开搜索', sub: '全局唤起搜索窗口', hintDefault: '未设置快捷键，点击右侧方框后按下组合键' },
      openClipboard: { label: '唤起剪贴板', sub: '全局唤起剪贴板历史' }
    },
    apps: { cardHead: '按应用绑定' },
    search: {
      webSearch: { title: '网页搜索' },
      defaultEngine: { label: '默认搜索引擎', sub: '不带关键字时，用这个引擎搜索关键词' },
      engines: { title: '搜索引擎与关键字' },
      fileSearch: { title: '文件搜索' },
      searchDirs: { label: '搜索目录', subHas: '已配置 {n} 个目录', subNone: '添加目录后即可搜索其中的文件' },
      addDir: '添加目录'
    },
    clipboard: {
      title: '历史记录',
      retention: { label: '保存时长', subDays: '超过 {n} 天自动清理', subForever: '永久保留全部记录' },
      daysUnit: '天'
    },
    data: {
      title: '存储',
      dir: { label: '存储目录', sub: '数据库文件所在位置', default: '默认位置', change: '更改' }
    },
    about: {
      version: { title: '版本', appLabel: '软件版本', sub: '灵犀 · Alfred 风格启动器' },
      latest: {
        title: '最新版本',
        checking: '正在检查更新…',
        failed: '检查失败（网络不通或 GitHub 限流）',
        hasUpdate: '发现新版本，点击右侧下载',
        upToDate: '已是最新版本',
        available: 'v{version} 可用',
        latest: '已最新'
      },
      download: '去下载',
      recheck: '重新检查',
      author: { title: '作者', sub: '灵犀的开发者' },
      blog: '博客 ay.lc',
      github: 'GitHub'
    },
    footer: '灵犀 · 配置保存在本机数据库'
  },
  common: {
    clear: '清除',
    resetDefault: '恢复默认',
    remove: '移除'
  },
  language: {
    system: '跟随系统',
    zhCN: '简体中文',
    zhTW: '繁體中文',
    en: 'English'
  },
  clipboard: {
    filterPlaceholder: '过滤剪贴板内容',
    empty: '暂无剪贴板记录',
    clearAll: '清空全部',
    hintSelect: '选择',
    hintPaste: '粘贴',
    hintClose: '关闭'
  },
  content: {
    titlePlaceholder: '标题',
    placeholder: '请输入内容...',
    uncategorized: '未分类',
    newSnippet: '新建片段',
    batchManage: '批量管理'
  },
  appShortcuts: {
    title: '应用快捷键',
    boundSub: '已绑定 {n} 个应用，按快捷键启动，再按一次隐藏',
    unboundSub: '为单个应用绑定快捷键，按一下启动、再按一下隐藏',
    addApp: '添加应用',
    activeStatus: '已生效 · {acc}',
    idleStatus: '设置一个快捷键后立即生效',
    recordPlaceholder: '按下组合键',
    removeTitle: '移除',
    empty: '还没有绑定应用。添加后按快捷键即可启动，应用已在最前时再按一次收起。',
    hint: '隐藏已在最前的应用需要系统「自动化」授权：首次使用按系统提示允许灵犀控制 System Events。',
    pickerTitle: '添加到应用快捷键',
    searchPlaceholder: '搜索应用名称，支持中英文',
    noMatch: '没有匹配的应用',
    bound: '已添加'
  },
  webEngines: {
    title: '搜索引擎',
    sub: '关键字触发：{tip}；不带关键字时用默认引擎',
    tipExample: '例如输入「{kw} 关键词」',
    tipNone: '给引擎设置关键字后即可定向搜索',
    addEngine: '添加引擎',
    builtin: '内置',
    editTitle: '编辑搜索引擎',
    addTitle: '添加搜索引擎',
    fieldName: '名称',
    fieldKeyword: '触发关键字',
    fieldUrl: '搜索地址',
    fieldEnabled: '启用',
    namePlaceholder: '例如 GitHub',
    keywordPlaceholder: '例如 github',
    keywordFallback: '关键字',
    urlPlaceholder: 'https://github.com/search?q={query}',
    keywordHint: '在搜索框输入「{kw} 关键词」即用这个引擎',
    urlHint: '用 {query} 表示关键词位置，搜索时自动替换并做 URL 编码',
    errName: '请填写引擎名称',
    errKeyword: '关键字只能是 1-16 位字母 / 数字 / 短横线',
    errUrl: '请填写搜索地址',
    errPlaceholder: '搜索地址里要用 {query} 表示关键词位置',
    errDuplicate: '关键字「{kw}」已被其它引擎使用'
  },
  search: {
    placeholder: '搜索应用 / 文件 / 片段，回车用搜索引擎搜索',
    snippetPlaceholder: '搜索片段...'
  }
}

export default zhCN
