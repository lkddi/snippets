import ShortCutRecorder from '@renderer/components/ShortCutRecorder'
import {
  Clipboard,
  DatabaseConfig,
  Earth,
  FolderSearch,
  Keyboard,
  Power,
  WebPage
} from '@icon-park/react'
import { Alert, Switch } from 'antd'
import classNames from 'classnames'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Form, useActionData, useLoaderData } from 'react-router-dom'
import AppShortcuts from './AppShortcuts'
import WebEngines from './WebEngines'
import './styles.scss'

type ActionData = { error?: string; ok?: boolean; warning?: string } | undefined

/** 设置分区：与左侧导航一一对应（代码片段是独立路由，不在这里渲染） */
export type SettingSection = 'general' | 'shortcuts' | 'apps' | 'search' | 'clipboard' | 'data'

const SECTION_META: Record<SettingSection, { title: string; desc: string }> = {
  general: { title: '通用', desc: '启动方式、程序坞与菜单栏行为' },
  shortcuts: { title: '快捷键', desc: '唤起搜索窗与剪贴板面板的全局快捷键' },
  apps: { title: '应用快捷键', desc: '给单个应用绑定启动 / 隐藏热键，按一下启动，再按一下收起' },
  search: { title: '搜索', desc: '网页兜底搜索与文件搜索目录' },
  clipboard: { title: '剪贴板', desc: '历史记录的保存时长' },
  data: { title: '数据', desc: '片段与剪贴板数据存放位置' }
}

const isMac = (): boolean => {
  const platform = window.electron?.process?.platform
  if (platform) return platform === 'darwin'
  return navigator.userAgent.includes('Mac')
}

export const Setting = ({ section }: { section: SettingSection }) => {
  const config = useLoaderData() as ConfigDataType
  const actionData = useActionData() as ActionData

  const [shortCut, setShortCut] = useState(config.shortCut)
  // 主进程回报的真实注册状态：注册失败时红字提示，避免"看着设置好了其实没生效"
  const [cutStatus, setCutStatus] = useState<ShortCutStatusType>({
    accelerator: '',
    registered: false,
    error: ''
  })
  // 剪贴板快捷键：'doubleOption' 为默认的双击 Option 模式
  const [clipShortCut, setClipShortCut] = useState(config.clipboardShortCut || 'doubleOption')
  // 剪贴板保存天数，0 = 永久保留
  const [retentionDays, setRetentionDays] = useState(
    String(config.clipboardRetentionDays ?? 7)
  )
  const [databaseDirectory, setDatabaseDirectory] = useState(config.databaseDirectory)
  // 网页搜索兜底使用的搜索引擎
  const [engine, setEngine] = useState(config.webSearchEngine || 'baidu')
  // 全部搜索引擎（内置 + 自定义），可启停 / 增删改
  const [engines, setEngines] = useState<WebEngineType[]>(
    Array.isArray(config.webEngines) && config.webEngines.length ? config.webEngines : []
  )
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

  // 每次保存后回读一次注册状态（actionData 变化即代表刚提交过）
  useEffect(() => {
    let cancelled = false
    void window.api.getShortCutStatus().then((status) => {
      if (!cancelled && status) setCutStatus(status)
    })
    return () => {
      cancelled = true
    }
  }, [actionData])

  const submitForm = (): void => {
    // 直接提交，由 action 负责注册并把失败原因回显
    requestAnimationFrame(() => formRef.current?.requestSubmit())
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
    setShortCut('')
    submitForm()
  }

  // 恢复默认的"连按两次 Option"模式（不占用全局快捷键）
  const resetClipShortCut = (): void => {
    setClipShortCut('doubleOption')
    submitForm()
  }

  // 切换网页搜索引擎
  const chooseEngine = (key: string): void => {
    setEngine(key)
    submitForm()
  }

  // 引擎列表变化：默认引擎被停用 / 删除时自动退回第一个启用的引擎
  const handleEnginesChange = (next: WebEngineType[]): void => {
    setEngines(next)
    const enabled = next.filter((item) => item.enabled)
    if (enabled.length > 0 && !enabled.some((item) => item.id === engine)) {
      setEngine(enabled[0].id)
    }
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

  const meta = SECTION_META[section]

  return (
    <Form method="POST" ref={formRef}>
      <main className="setting-page">
        <header className="section-header">
          <h1>{meta.title}</h1>
          <p>{meta.desc}</p>
        </header>

        {actionData?.error && (
          <Alert type="error" showIcon message={actionData.error} className="setting-alert" />
        )}
        {actionData?.warning && (
          <Alert type="warning" showIcon message={actionData.warning} className="setting-alert" />
        )}

        {section === 'general' && (
          <section className="setting-card">
            <div className="card-head">
              <Power theme="outline" size={15} fill="#64748b" strokeWidth={4} />
              <span>启动与外观</span>
            </div>

            <div className="setting-row">
              <div className="row-label">
                <span className="label-main">登录时启动</span>
                <span className="label-sub">开机后自动驻留菜单栏，不弹窗口</span>
              </div>
              <Switch checked={launchAtLogin} onChange={handleLaunchChange} size="small" />
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
            </div>

            <div className="setting-row">
              <div className="row-label">
                <span className="label-main">菜单栏图标</span>
                <span className="label-sub">点按唤起搜索，右键打开菜单</span>
              </div>
              <span className="row-static">常驻</span>
            </div>
          </section>
        )}

        {section === 'shortcuts' && (
          <section className="setting-card">
            <div className="card-head">
              <Keyboard theme="outline" size={15} fill="#64748b" strokeWidth={4} />
              <span>全局快捷键</span>
            </div>

            <div className="setting-row">
              <div className="row-label">
                <span className="label-main">打开搜索</span>
                <span className="label-sub">全局唤起搜索窗口</span>
                <span
                  className={classNames('cut-status', {
                    'is-ok': cutStatus.registered,
                    'is-bad': Boolean(cutStatus.accelerator) && !cutStatus.registered
                  })}
                >
                  {cutStatus.registered
                    ? `已生效：${cutStatus.accelerator}`
                    : cutStatus.error || '未设置快捷键，点击右侧方框后按下组合键'}
                </span>
              </div>
              <div className="row-control">
                <ShortCutRecorder
                  value={shortCut}
                  onChange={(accelerator) => {
                    setShortCut(accelerator)
                    submitForm()
                  }}
                />
                {shortCut && (
                  <button type="button" className="mini-btn" onClick={clearShortCut}>
                    清除
                  </button>
                )}
              </div>
            </div>

            <div className="setting-row">
              <div className="row-label">
                <span className="label-main">唤起剪贴板</span>
                <span className="label-sub">全局唤起剪贴板历史</span>
              </div>
              <div className="row-control">
                <ShortCutRecorder
                  value={clipShortCut === 'doubleOption' ? '' : clipShortCut}
                  placeholder="连按两次 Option"
                  onChange={(accelerator) => {
                    setClipShortCut(accelerator)
                    submitForm()
                  }}
                />
                <button type="button" className="mini-btn" onClick={resetClipShortCut}>
                  恢复默认
                </button>
              </div>
            </div>
          </section>
        )}

        {section === 'apps' && (
          <section className="setting-card">
            <div className="card-head">
              <span className="card-head-dot" />
              <span>按应用绑定</span>
            </div>
            <AppShortcuts />
          </section>
        )}

        {section === 'search' && (
          <>
            <section className="setting-card">
              <div className="card-head">
                <WebPage theme="outline" size={15} fill="#64748b" strokeWidth={4} />
                <span>网页搜索</span>
              </div>

              <div className="setting-row">
                <div className="row-label">
                  <span className="label-main">默认搜索引擎</span>
                  <span className="label-sub">不带关键字时，用这个引擎搜索关键词</span>
                </div>
                <div className="seg-group">
                  {engines
                    .filter((item) => item.enabled)
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={classNames('seg-btn', { active: engine === item.id })}
                        onClick={() => chooseEngine(item.id)}
                      >
                        {item.name}
                      </button>
                    ))}
                </div>
              </div>
            </section>

            <section className="setting-card">
              <div className="card-head">
                <Earth theme="outline" size={15} fill="#64748b" strokeWidth={4} />
                <span>搜索引擎与关键字</span>
              </div>
              <WebEngines engines={engines} onChange={handleEnginesChange} />
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
              </div>

              {dirs.length > 0 && (
                <div className="dir-list">
                  {dirs.map((path) => (
                    <div key={path} className="dir-row">
                      <span className="dir-row-path" title={path}>
                        {path}
                      </span>
                      <button
                        type="button"
                        className="mini-btn danger"
                        onClick={() => removeSearchDir(path)}
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {section === 'clipboard' && (
          <section className="setting-card">
            <div className="card-head">
              <Clipboard theme="outline" size={15} fill="#64748b" strokeWidth={4} />
              <span>历史记录</span>
            </div>

            <div className="setting-row">
              <div className="row-label">
                <span className="label-main">保存时长</span>
                <span className="label-sub">
                  {Number(retentionDays) > 0
                    ? `超过 ${retentionDays} 天自动清理`
                    : '永久保留全部记录'}
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
            </div>
          </section>
        )}

        {section === 'data' && (
          <section className="setting-card">
            <div className="card-head">
              <DatabaseConfig theme="outline" size={15} fill="#64748b" strokeWidth={4} />
              <span>存储</span>
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
            </div>
          </section>
        )}

        {/* 所有分区的取值都在这一处提交，避免切换分区时把未显示字段写丢 */}
        <input type="hidden" name="shortCut" value={shortCut} readOnly />
        <input type="hidden" name="clipboardShortCut" value={clipShortCut} readOnly />
        <input type="hidden" name="clipboardRetentionDays" value={retentionDays} readOnly />
        <input type="hidden" name="databaseDirectory" value={databaseDirectory} readOnly />
        <input type="hidden" name="launchAtLogin" value={String(launchAtLogin)} readOnly />
        <input type="hidden" name="hideDockIcon" value={String(hideDockIcon)} readOnly />
        <input type="hidden" name="webSearchEngine" value={engine} readOnly />
        <input type="hidden" name="webEngines" value={JSON.stringify(engines)} readOnly />
        <input type="hidden" name="searchDirectories" value={JSON.stringify(dirs)} readOnly />

        <footer className="page-footer">灵犀 · 配置保存在本机数据库</footer>
      </main>
    </Form>
  )
}

export default Setting
