// 繁體中文（台灣用語）文案。結構與 zh-CN.ts 完全一致，缺漏的 key 會回落簡體中文。
const zhTW = {
  setting: {
    section: {
      general: { title: '一般', desc: '啟動方式、Dock 與選單列行為' },
      shortcuts: { title: '快速鍵', desc: '喚起搜尋窗與剪貼簿面板的全域快速鍵' },
      apps: { title: 'App 快速鍵', desc: '為單一 App 綁定啟動 / 隱藏熱鍵，按一下啟動，再按一下收起' },
      search: { title: '搜尋', desc: '網頁兜底搜尋與檔案搜尋目錄' },
      clipboard: { title: '剪貼簿', desc: '歷史記錄的保留時間' },
      data: { title: '資料', desc: '片段與剪貼簿資料存放位置' },
      about: { title: '關於', desc: '軟體版本、更新與作者資訊' }
    },
    general: {
      title: '啟動與外觀',
      launchAtLogin: { label: '登入時啟動', sub: '開機後自動駐留選單列，不彈出視窗' },
      hideDock: { label: '隱藏 Dock 圖示', sub: '開啟後只在選單列駐留，Dock 不再顯示' },
      menuBarIcon: { label: '選單列圖示', sub: '點按喚起搜尋，右鍵打開選單', static: '常駐' },
      language: { label: '語言', sub: '跟隨系統時與系統語言一致；未支援的語言回落英文' }
    },
    shortcuts: {
      title: '全域快速鍵',
      openSearch: { label: '打開搜尋', sub: '全域喚起搜尋視窗', hintDefault: '未設定快速鍵，點按右側方框後按下組合鍵' },
      openClipboard: { label: '喚起剪貼簿', sub: '全域喚起剪貼簿歷史' }
    },
    apps: { cardHead: '按 App 綁定' },
    search: {
      webSearch: { title: '網頁搜尋' },
      defaultEngine: { label: '預設搜尋引擎', sub: '不帶關鍵字時，用這個引擎搜尋關鍵字' },
      engines: { title: '搜尋引擎與關鍵字' },
      fileSearch: { title: '檔案搜尋' },
      searchDirs: { label: '搜尋目錄', subHas: '已設定 {n} 個目錄', subNone: '加入目錄後即可搜尋其中的檔案' },
      addDir: '加入目錄'
    },
    clipboard: {
      title: '歷史記錄',
      retention: { label: '保留時間', subDays: '超過 {n} 天自動清理', subForever: '永久保留全部記錄' },
      daysUnit: '天'
    },
    data: {
      title: '儲存',
      dir: { label: '儲存目錄', sub: '資料庫檔案所在位置', default: '預設位置', change: '更改' }
    },
    about: {
      version: { title: '版本', appLabel: '軟體版本', sub: '靈犀 · Alfred 風格啟動器' },
      latest: {
        title: '最新版本',
        checking: '正在檢查更新…',
        failed: '檢查失敗（網路不通或 GitHub 速率限制）',
        hasUpdate: '發現新版本，點按右側下載',
        upToDate: '已是最新版本',
        available: 'v{version} 可用',
        latest: '已最新'
      },
      download: '前往下載',
      recheck: '重新檢查',
      author: { title: '作者', sub: '靈犀的開發者' },
      blog: '部落格 ay.lc',
      github: 'GitHub'
    },
    footer: '靈犀 · 設定儲存在本機資料庫'
  },
  common: {
    clear: '清除',
    resetDefault: '還原預設',
    remove: '移除',
    edit: '編輯',
    save: '儲存',
    cancel: '取消'
  },
  language: {
    system: '跟隨系統',
    zhCN: '简体中文',
    zhTW: '繁體中文',
    en: 'English'
  },
  clipboard: {
    filterPlaceholder: '篩選剪貼簿內容',
    empty: '尚無剪貼簿記錄',
    clearAll: '全部清空',
    hintSelect: '選擇',
    hintPaste: '貼上',
    hintClose: '關閉'
  },
  content: {
    titlePlaceholder: '標題',
    placeholder: '請輸入內容...',
    uncategorized: '未分類',
    newSnippet: '新增片段',
    batchManage: '批次管理'
  },
  appShortcuts: {
    title: 'App 快速鍵',
    boundSub: '已綁定 {n} 個 App，按快速鍵啟動，再按一次隱藏',
    unboundSub: '為單一 App 綁定快速鍵，按一下啟動、再按一下隱藏',
    addApp: '加入 App',
    activeStatus: '已生效 · {acc}',
    idleStatus: '設定一個快速鍵後立即生效',
    recordPlaceholder: '按下組合鍵',
    removeTitle: '移除',
    empty: '尚未綁定任何 App。加入後按快速鍵即可啟動，App 已在最前面時再按一次收起。',
    hint: '隱藏已在最前的 App 需要系統「自動化」授權：首次使用請依系統提示允許靈犀控制 System Events。',
    pickerTitle: '加入 App 快速鍵',
    searchPlaceholder: '搜尋 App 名稱，支援中英文',
    noMatch: '沒有符合的 App',
    bound: '已加入'
  },
  webEngines: {
    title: '搜尋引擎',
    sub: '關鍵字觸發：{tip}；不帶關鍵字時用預設引擎',
    tipExample: '例如輸入「{kw} 關鍵字」',
    tipNone: '為引擎設定關鍵字後即可定向搜尋',
    addEngine: '加入引擎',
    builtin: '內建',
    editTitle: '編輯搜尋引擎',
    addTitle: '加入搜尋引擎',
    fieldName: '名稱',
    fieldKeyword: '觸發關鍵字',
    fieldUrl: '搜尋網址',
    fieldEnabled: '啟用',
    namePlaceholder: '例如 GitHub',
    keywordPlaceholder: '例如 github',
    keywordFallback: '關鍵字',
    urlPlaceholder: 'https://github.com/search?q={query}',
    keywordHint: '在搜尋框輸入「{kw} 關鍵字」即用這個引擎',
    urlHint: '用 {query} 表示關鍵字位置，搜尋時自動替換並做 URL 編碼',
    errName: '請填寫引擎名稱',
    errKeyword: '關鍵字只能是 1-16 位英文字母 / 數字 / 連字號',
    errUrl: '請填寫搜尋網址',
    errPlaceholder: '搜尋網址裡要用 {query} 表示關鍵字位置',
    errDuplicate: '關鍵字「{kw}」已被其他引擎使用'
  },
  search: {
    placeholder: '搜尋 App / 檔案 / 片段，按 Enter 以搜尋引擎搜尋',
    snippetPlaceholder: '搜尋片段...'
  }
}

export default zhTW
