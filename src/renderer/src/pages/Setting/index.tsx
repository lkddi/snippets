import { Clipboard, DatabaseConfig, FolderSearch, Power, SettingOne, WebPage } from '@icon-park/react'
import { Alert, Switch } from 'antd'
import classNames from 'classnames'
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Form, useActionData, useLoaderData } from 'react-router-dom'
import './styles.scss'

type ActionData = { error?: string; ok?: boolean } | undefined

/** 网页搜索引擎选项，key 与主进程 webSearch.ts 的 URL 模板一致 */
const ENGINES: { key: string; label: string }[] = [
  { key: 'baidu', label: '百度' },
  { key: 'google', label: 'Google' },
  { key: 'bing', label: '必应' },
  { key: 'duckduckgo', label: 'DuckDuckGo' }
]

const isMac = (): boolean => {
  const platform = window.electron?.process?.platform
  if (platform) return platform === 'darwin'
  return navigator.userAgent.includes('Mac')
}

/** e.code 与 Electron accelerator 名称的映射，直接拼 e.code 会出现 Meta 这种非法键名 */
const normalizeCode = (code: string): string =>
  code.replace(/^Left|^Right/, '').replace(/^Key/, '').replace(/^Digit/, '')

const acceleratorName = (code: string): string => {
  switch (code) {
    case 'Meta':
      return isMac() ? 'Command' : 'Super'
    case 'Control':
      return 'Control'
    case 'Alt':
      return 'Alt'
    case 'Shift':
      return 'Shift'
    default:
      return code
  }
}

const isModifier = (code: string): boolean =>
  ['Meta', 'Control', 'Alt', 'Shift'].includes(code)

const isValidKey = (code: string): boolean =>
  /^([A-Z]|Space|F\d{1,2}|Arrow(Up|Down|Left|Right)|Enter|Tab|Backspace|Delete|Escape|\d)$/.test(
    code
  )

/** accelerator 拆成键帽展示：'Alt+Space' -> ['Alt', 'Space'] */
const keyCaps = (accelerator: string): string[] =>
  accelerator ? accelerator.split('+') : []

export const Setting = () => {
  const config = useLoaderData() as ConfigDataType
  const actionData = useActionData() as ActionData

  const [shortCut, setShortCut] = useState(config.shortCut)
  // 剪贴板快捷键：'doubleOption' 为默认的双击 Option 模式
  const [clipShortCut, setClipShortCut] = useState(config.clipboardShortCut || 'doubleOption')
  // 剪贴板保存天数，0 = 永久保留
  const [retentionDays, setRetentionDays] = useState(
    String(config.clipboardRetentionDays ?? 7)
  )
  const [databaseDirectory, setDatabaseDirectory] = useState(config.databaseDirectory)
  // 网页搜索兜底使用的搜索引擎
  const [engine, setEngine] = useState(config.webSearchEngine || 'baidu')
  // 文件搜索允许扫描的目录（支持多个）
  const [dirs, setDirs] = useState<string[]>(
    Array.isArray(config.searchDirectories) ? config.searchDirectories : []
  )
  // 开机启动：真实状态以系统登录项为准，配置里的值只做初始回显
  const [launchAtLogin, setLaunchAtLogin] = useState(Boolean(config.launchAtLogin))
  // 程序坞图标：隐藏后应用只驻留菜单栏
  const [hideDockIcon, setHideDockIcon] = useState(Boolean(config.hideDockIcon))
  // 当前平台是否支持隐藏程序坞图标（仅 macOS）
  const [dockSupported, setDockSupported] = useState(isMac())
  const keysRef = useRef<string[]>([])
  const clipKeysRef = useRef<string[]>([])
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.getLoginItemSettings().then((enabled) => {
      if (!cancelled) setLaunchAtLogin(Boolean(enabled))
    })
    void window.api.getDockIconSettings().then((result) => {
      if (cancelled) return
      setDockSupported(Boolean(result?.supported))
      setHideDockIcon(Boolean(result?.hidden))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const submitForm = (): void => {
    // 直接提交，由 action 负责注册并把失败原因回显
    requestAnimationFrame(() => formRef.current?.requestSubmit())
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    e.preventDefault()
    const code = normalizeCode(e.code)
    if (!code) return

    if (isModifier(code)) {
      // 用 ref 保存已按下的修饰键，避免依赖 state 闭包丢键
      if (!keysRef.current.includes(code)) keysRef.current = [...keysRef.current, code]
      return
    }

    if (!keysRef.current.length) return
    if (!isValidKey(code)) return

    const accelerator = [...keysRef.current, code].map(acceleratorName).join('+')
    keysRef.current = []
    setShortCut(accelerator)
    submitForm()
  }

  // 剪贴板快捷键的按键采集逻辑与搜索快捷键一致，只是写入不同的 state / 隐藏域
  const handleClipKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    e.preventDefault()
    const code = normalizeCode(e.code)
    if (!code) return

    if (isModifier(code)) {
      if (!clipKeysRef.current.includes(code)) clipKeysRef.current = [...clipKeysRef.current, code]
      return
    }

    if (!clipKeysRef.current.length) return
    if (!isValidKey(code)) return

    const accelerator = [...clipKeysRef.current, code].map(acceleratorName).join('+')
    clipKeysRef.current = []
    setClipShortCut(accelerator)
    submitForm()
  }

  // 恢复默认的"连按两次 Option"模式（不占用全局快捷键）
  const resetClipShortCut = (): void => {
    clipKeysRef.current = []
    setClipShortCut('doubleOption')
    submitForm()
  }

  // 只允许输入非负整数；失焦时夹紧到 0~3650 并提交
  const handleRetentionChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setRetentionDays(e.target.value.replace(/[^\d]/g, ''))
  }

  const handleRetentionBlur = (): void => {
    const days = Math.max(0, Math.min(3650, Number(retentionDays || '0')))
    setRetentionDays(String(days))
    submitForm()
  }

  // ±7 天步进：0 表示永久，最高 3650
  const stepRetention = (delta: number) => (): void => {
    const next = Math.max(0, Math.min(3650, (Number(retentionDays) || 0) + delta))
    setRetentionDays(String(next))
    submitForm()
  }

  // 开机启动：先写系统登录项，成功后才更新 UI 并持久化（失败时 Switch 自动回弹）
  const handleLaunchChange = (checked: boolean): void => {
    setLaunchAtLogin(checked)
    void window.api.setLoginItemSettings(checked).then((ok) => {
      if (!ok) {
        setLaunchAtLogin(!checked)
        return
      }
      submitForm()
    })
  }

  // 清除搜索快捷键（注销全局热键，搜索窗仍可从托盘唤起）
  const clearShortCut = (): void => {
    keysRef.current = []
    setShortCut('')
    submitForm()
  }

  // 切换网页搜索引擎
  const chooseEngine = (key: string): void => {
    setEngine(key)
    submitForm()
  }

  // 添加文件搜索目录：弹系统目录选择框，去重后追加
  const addSearchDir = async (): Promise<void> => {
    const path = await window.api.selectSearchDirectory()
    if (!path || dirs.includes(path)) return
    const next = [...dirs, path]
    setDirs(next)
    window.api.invalidateFiles()
    submitForm()
  }

  // 移除文件搜索目录
  const removeSearchDir = (path: string): void => {
    setDirs(dirs.filter((d) => d !== path))
    window.api.invalidateFiles()
    submitForm()
  }

  // 程序坞图标：先让主进程生效，成功后再持久化（失败时开关自动回弹）
  const handleDockChange = (checked: boolean): void => {
    setHideDockIcon(checked)
    void window.api.setDockIconHidden(checked).then((ok) => {
      if (!ok) {
        setHideDockIcon(!checked)
        return
      }
      submitForm()
    })
  }

  const chooseDirectory = async (): Promise<void> => {
    const path = await window.api.selectDatabaseDirectory()
    if (!path) return
    window.api.setDatabaseDirectory(path)
    setDatabaseDirectory(path)
    submitForm()
  }

  return (
    <Form method="POST" ref={formRef}>
      <main className="setting-page">
        <header className="page-header">
          <h1>设置</h1>
          <p>修改即时保存，随时按 Cmd + , 回到这里</p>
        </header>

        {actionData?.error && (
          <Alert type="error" showIcon message={actionData.error} className="setting-alert" />
        )}

        <section className="setting-card">
          <div className="card-head">
            <SettingOne theme="outline" size={15} fill="#64748b" strokeWidth={4} />
            <span>快捷键</span>
          </div>

          <div className="setting-row">
            <div className="row-label">
              <span className="label-main">打开搜索</span>
              <span className="label-sub">全局唤起搜索窗口</span>
            </div>
            <div className="row-control">
              <div
                className="shortcut-box"
                tabIndex={0}
                onKeyDown={handleKeyDown}
                onBlur={() => (keysRef.current = [])}
                data-empty={!shortCut}
              >
                {shortCut ? (
                  keyCaps(shortCut).map((k) => <kbd key={k}>{k}</kbd>)
                ) : (
                  <span className="shortcut-placeholder">点击后按下组合键</span>
                )}
              </div>
              {shortCut && (
                <button type="button" className="mini-btn" onClick={clearShortCut}>
                  清除
                </button>
              )}
            </div>
            <input type="hidden" name="shortCut" value={shortCut} readOnly />
          </div>

          <div className="setting-row">
            <div className="row-label">
              <span className="label-main">唤起剪贴板</span>
              <span className="label-sub">全局唤起剪贴板历史</span>
            </div>
            <div className="row-control">
              <div
                className="shortcut-box"
                tabIndex={0}
                onKeyDown={handleClipKeyDown}
                onBlur={() => (clipKeysRef.current = [])}
                data-empty={clipShortCut === 'doubleOption' || !clipShortCut}
              >
                {clipShortCut && clipShortCut !== 'doubleOption' ? (
                  keyCaps(clipShortCut).map((k) => <kbd key={k}>{k}</kbd>)
                ) : (
                  <>
                    <kbd>Option</kbd>
                    <kbd>Option</kbd>
                  </>
                )}
              </div>
              <button type="button" className="mini-btn" onClick={resetClipShortCut}>
                恢复默认
              </button>
            </div>
            <input type="hidden" name="clipboardShortCut" value={clipShortCut} readOnly />
          </div>
        </section>

        <section className="setting-card">
          <div className="card-head">
            <WebPage theme="outline" size={15} fill="#64748b" strokeWidth={4} />
            <span>网页搜索</span>
          </div>

          <div className="setting-row">
            <div className="row-label">
              <span className="label-main">默认搜索引擎</span>
              <span className="label-sub">没有本地结果时，在浏览器中打开关键词搜索</span>
            </div>
            <div className="seg-group">
              {ENGINES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={classNames('seg-btn', { active: engine === item.key })}
                  onClick={() => chooseEngine(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <input type="hidden" name="webSearchEngine" value={engine} readOnly />
          </div>
        </section>

        <section className="setting-card">
          <div className="card-head">
            <FolderSearch theme="outline" size={15} fill="#64748b" strokeWidth={4} />
            <span>文件搜索</span>
          </div>

          <div className="setting-row">
            <div className="row-label">
              <span className="label-main">搜索目录</span>
              <span className="label-sub">
                {dirs.length > 0 ? `已配置 ${dirs.length} 个目录` : '添加目录后即可搜索其中的文件'}
              </span>
            </div>
            <div className="row-control">
              <button type="button" className="mini-btn" onClick={() => void addSearchDir()}>
                添加目录
              </button>
            </div>
            <input
              type="hidden"
              name="searchDirectories"
              value={JSON.stringify(dirs)}
              readOnly
            />
          </div>

          {dirs.length > 0 && (
            <div className="dir-list">
              {dirs.map((path) => (
                <div key={path} className="dir-row">
                  <span className="dir-row-path" title={path}>
                    {path}
                  </span>
                  <button type="button" className="mini-btn danger" onClick={() => removeSearchDir(path)}>
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="setting-card">
          <div className="card-head">
            <Clipboard theme="outline" size={15} fill="#64748b" strokeWidth={4} />
            <span>剪贴板</span>
          </div>

          <div className="setting-row">
            <div className="row-label">
              <span className="label-main">保存时长</span>
              <span className="label-sub">
                {Number(retentionDays) > 0 ? `超过 ${retentionDays} 天自动清理` : '永久保留全部记录'}
              </span>
            </div>
            <div className="stepper">
              <button
                type="button"
                className="step-btn"
                onClick={stepRetention(-7)}
                disabled={Number(retentionDays) <= 0}
              >
                −
              </button>
              <input
                className="step-input"
                value={retentionDays}
                onChange={handleRetentionChange}
                onBlur={handleRetentionBlur}
              />
              <span className="step-unit">天</span>
              <button type="button" className="step-btn" onClick={stepRetention(7)}>
                ＋
              </button>
            </div>
            <input type="hidden" name="clipboardRetentionDays" value={retentionDays} readOnly />
          </div>
        </section>

        <section className="setting-card">
          <div className="card-head">
            <Power theme="outline" size={15} fill="#64748b" strokeWidth={4} />
            <span>通用</span>
          </div>

          <div className="setting-row">
            <div className="row-label">
              <span className="label-main">登录时启动</span>
              <span className="label-sub">开机后自动驻留菜单栏，不弹窗口</span>
            </div>
            <Switch checked={launchAtLogin} onChange={handleLaunchChange} size="small" />
            <input
              type="hidden"
              name="launchAtLogin"
              value={String(launchAtLogin)}
              readOnly
            />
          </div>

          <div className="setting-row">
            <div className="row-label">
              <span className="label-main">隐藏程序坞图标</span>
              <span className="label-sub">开启后只在菜单栏驻留，程序坞不再显示</span>
            </div>
            <Switch
              checked={hideDockIcon}
              onChange={handleDockChange}
              size="small"
              disabled={!dockSupported}
            />
            <input type="hidden" name="hideDockIcon" value={String(hideDockIcon)} readOnly />
          </div>

          <div className="setting-row">
            <div className="row-label">
              <span className="label-main">菜单栏图标</span>
              <span className="label-sub">点按唤起搜索，右键打开菜单</span>
            </div>
            <span className="row-static">常驻</span>
          </div>
        </section>

        <section className="setting-card">
          <div className="card-head">
            <DatabaseConfig theme="outline" size={15} fill="#64748b" strokeWidth={4} />
            <span>数据</span>
          </div>

          <div className="setting-row">
            <div className="row-label">
              <span className="label-main">存储目录</span>
              <span className="label-sub">数据库文件所在位置</span>
            </div>
            <div className="row-control">
              <span className="dir-path" title={databaseDirectory}>
                {databaseDirectory || '默认位置'}
              </span>
              <button type="button" className="mini-btn" onClick={() => void chooseDirectory()}>
                更改
              </button>
            </div>
            <input type="hidden" name="databaseDirectory" value={databaseDirectory} readOnly />
          </div>
        </section>

        <footer className="page-footer">Snippets · 配置保存在本机数据库</footer>
      </main>
    </Form>
  )
}
