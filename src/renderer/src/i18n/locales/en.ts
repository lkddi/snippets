// English copy. Mirrors the structure of zh-CN.ts exactly — add a key here
// whenever you add one there (missing keys fall back to zh-CN, then to the key itself).
const en = {
  setting: {
    section: {
      general: { title: 'General', desc: 'Launch behavior, Dock and menu bar' },
      shortcuts: { title: 'Shortcuts', desc: 'Global hotkeys to open search and the clipboard panel' },
      apps: { title: 'App Shortcuts', desc: 'Bind a launch / hide hotkey per app: press to launch, press again to hide' },
      search: { title: 'Search', desc: 'Web fallback search and file search directories' },
      clipboard: { title: 'Clipboard', desc: 'How long clipboard history is kept' },
      data: { title: 'Data', desc: 'Where snippets and clipboard data are stored' },
      about: { title: 'About', desc: 'Version, updates and author info' }
    },
    general: {
      title: 'Launch & Appearance',
      launchAtLogin: { label: 'Launch at login', sub: 'Auto-reside in the menu bar after boot, no window pops up' },
      hideDock: { label: 'Hide Dock icon', sub: 'After enabling, only stays in the menu bar; Dock no longer shows it' },
      menuBarIcon: { label: 'Menu bar icon', sub: 'Click to open search, right-click for the menu', static: 'Always on' },
      language: { label: 'Language', sub: 'Follows the system language when set to System; unsupported languages fall back to English' }
    },
    shortcuts: {
      title: 'Global Shortcuts',
      openSearch: { label: 'Open search', sub: 'Open the search window globally', hintDefault: 'No shortcut set; click the box on the right and press a key combo' },
      openClipboard: { label: 'Open clipboard', sub: 'Open clipboard history globally' }
    },
    apps: { cardHead: 'Per-app binding' },
    search: {
      webSearch: { title: 'Web search' },
      defaultEngine: { label: 'Default search engine', sub: 'Used to search the keyword when no keyword prefix is given' },
      engines: { title: 'Search engines & keywords' },
      fileSearch: { title: 'File search' },
      searchDirs: { label: 'Search directories', subHas: '{n} director(y/ies) configured', subNone: 'Add a directory to search files within it' },
      addDir: 'Add directory'
    },
    clipboard: {
      title: 'History',
      retention: { label: 'Retention', subDays: 'Auto-clean after {n} days', subForever: 'Keep all records forever' },
      daysUnit: 'days'
    },
    data: {
      title: 'Storage',
      dir: { label: 'Storage directory', sub: 'Location of the database file', default: 'Default location', change: 'Change' }
    },
    about: {
      version: { title: 'Version', appLabel: 'App version', sub: 'Lingxi · Alfred-style launcher' },
      latest: {
        title: 'Latest version',
        checking: 'Checking for updates…',
        failed: 'Check failed (no network or GitHub rate limit)',
        hasUpdate: 'A new version is available, click to download',
        upToDate: 'Up to date',
        available: 'v{version} available',
        latest: 'Latest'
      },
      download: 'Download',
      recheck: 'Re-check',
      author: { title: 'Author', sub: 'Developer of Lingxi' },
      blog: 'Blog ay.lc',
      github: 'GitHub'
    },
    footer: 'Lingxi · settings are saved in the local database'
  },
  common: {
    clear: 'Clear',
    resetDefault: 'Restore default',
    remove: 'Remove',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel'
  },
  language: {
    system: 'System',
    zhCN: '简体中文',
    zhTW: '繁體中文',
    en: 'English'
  },
  clipboard: {
    filterPlaceholder: 'Filter clipboard',
    empty: 'No clipboard history yet',
    clearAll: 'Clear all',
    hintSelect: 'Navigate',
    hintPaste: 'Paste',
    hintClose: 'Close'
  },
  content: {
    titlePlaceholder: 'Title',
    placeholder: 'Enter content...',
    uncategorized: 'Uncategorized',
    newSnippet: 'New snippet',
    batchManage: 'Batch manage'
  },
  appShortcuts: {
    title: 'App shortcuts',
    boundSub: '{n} app(s) bound: press to launch, press again to hide',
    unboundSub: 'Bind a hotkey per app: press to launch, press again to hide',
    addApp: 'Add app',
    activeStatus: 'Active · {acc}',
    idleStatus: 'Takes effect once a shortcut is set',
    recordPlaceholder: 'Press a key combo',
    removeTitle: 'Remove',
    empty: 'No apps bound yet. After adding, press the shortcut to launch; press again to hide when the app is already frontmost.',
    hint: 'Hiding a frontmost app needs macOS "Automation" permission: allow Lingxi to control System Events when prompted.',
    pickerTitle: 'Add to app shortcuts',
    searchPlaceholder: 'Search app name (Chinese or English)',
    noMatch: 'No matching apps',
    bound: 'Added'
  },
  webEngines: {
    title: 'Search engines',
    sub: 'Keyword trigger: {tip}; uses the default engine without a keyword',
    tipExample: 'e.g. type "{kw} keyword"',
    tipNone: 'Set a keyword to search with this engine',
    addEngine: 'Add engine',
    builtin: 'Built-in',
    editTitle: 'Edit search engine',
    addTitle: 'Add search engine',
    fieldName: 'Name',
    fieldKeyword: 'Trigger keyword',
    fieldUrl: 'Search URL',
    fieldEnabled: 'Enabled',
    namePlaceholder: 'e.g. GitHub',
    keywordPlaceholder: 'e.g. github',
    keywordFallback: 'keyword',
    urlPlaceholder: 'https://github.com/search?q={query}',
    keywordHint: 'Type "{kw} keyword" in the search box to use this engine',
    urlHint: 'Use {query} to mark where the keyword goes; it is auto-replaced and URL-encoded',
    errName: 'Engine name is required',
    errKeyword: 'Keyword must be 1-16 letters / digits / hyphens',
    errUrl: 'Search URL is required',
    errPlaceholder: 'The search URL must contain {query} where the keyword goes',
    errDuplicate: 'Keyword "{kw}" is already used by another engine'
  },
  search: {
    placeholder: 'Search apps / files / snippets; press Enter to web search',
    snippetPlaceholder: 'Search snippets...'
  }
}

export default en
