import ShortCutRecorder from '@renderer/components/ShortCutRecorder'
import {
  Clipboard,
  DatabaseConfig,
  Download,
  Earth,
  FolderSearch,
  Github,
  Keyboard,
  Link,
  Power,
  User,
  WebPage
} from '@icon-park/react'
import { Alert, Switch } from 'antd'
import classNames from 'classnames'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Form, useActionData, useLoaderData } from 'react-router-dom'
import { useI18nStore, useT, type LanguageKey } from '@renderer/i18n'
import AppShortcuts from './AppShortcuts'
import WebEngines from './WebEngines'
import './styles.scss'

type ActionData = { error?: string; ok?: boolean; warning?: string } | undefined

/** 设置分区：与左侧导航一一对应（代码片段是独立路由，不在这里渲染） */
export type SettingSection = 'general' | 'shortcuts' | 'apps' | 'search' | 'clipboard' | 'data' | 'about'

const isMac = (): boolean => {
  const platform = window.electron?.process?.platform
  if (platform) return platform === 'darwin'
  return navigator.userAgent.includes('Mac')
}

export const Setting = ({ section }: { section: SettingSection }) => {
  const config = useLoaderData() as ConfigDataType
  const actionData = useActionData() as ActionData

  const t = useT()
  // 语言设置：本地选中态 + 同步进 i18n store（立即生效）+ 提交表单（持久化到 config 表）
  const [language, setLanguage] = useState<LanguageKey>(config.language || 'system')

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
  // 说明页：版本 / 最新版检查结果
  const [about, setAbout] = useState<AboutInfoType | null>(null)
  const [aboutLoading, setAboutLoading] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // 进入设置页时把 config 表里的语言设置同步进 i18n store（保证任意页面即时一致）
  useEffect(() => {
    useI18nStore.getState().setLocale((config.language as LanguageKey) || 'system')
  }, [config.language])

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

  // 进入说明页时拉一次版本信息
  useEffect(() => {
    if (section !== 'about') return
    let cancelled = false
    setAboutLoading(true)
    void window.api.getAboutInfo().then((info) => {
      if (!cancelled) {
        setAbout(info)
        setAboutLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [section])

  const refreshAbout = (): void => {
    setAboutLoading(true)
    void window.api.getAboutInfo().then((info) => {
      setAbout(info)
      setAboutLoading(false)
    })
  }

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

  // 切换语言：本地选中态 + 立即写 store 生效 + 提交表单持久化
  const changeLanguage = (l: LanguageKey): void => {
    setLanguage(l)
    useI18nStore.getState().setLocale(l)
    submitForm()
  }

  const meta = {
    title: t(`setting.section.${section}.title`),
    desc: t(`setting.section.${section}.desc`)
  }

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
              <span>{t('setting.general.title')}</span>
            </div>

            <div className="setting-row">
              <div className="row-label">
                <span className="label-main">{t('setting.general.launchAtLogin.label')}</span>
                <span className="label-sub">{t('setting.general.launchAtLogin.sub')}</span>
              </div>
              <Switch checked={launchAtLogin} onChange={handleLaunchChange} size="small" />
            </div>

            <div className="setting-row">
              <div className="row-label">
                <span className="label-main">{t('setting.general.hideDock.label')}</span>
                <span className="label-sub">{t('setting.general.hideDock.sub')}</span>
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
                <span className="label-main">{t('setting.general.menuBarIcon.label')}</span>
                <span className="label-sub">{t('setting.general.menuBarIcon.sub')}</span>
              </div>
              <span className="row-static">{t('setting.general.menuBarIcon.static')}</span>
            </div>

            <div className="setting-row">
              <div className="row-label">
                <span className="label-main">{t('setting.general.language.label')}</span>
                <span className="label-sub">{t('setting.general.language.sub')}</span>
              </div>
              <div className="seg-group">
                <button
                  type="button"
                  className={classNames('seg-btn', { active: language === 'system' })}
                  onClick={() => changeLanguage('system')}
                >
                  {t('language.system')}
                </button>
                <button
                  type="button"
                  className={classNames('seg-btn', { active: language === 'zh-CN' })}
                  onClick={() => changeLanguage('zh-CN')}
                >
                  {t('language.zhCN')}
                </button>
                <button
                  type="button"
                  className={classNames('seg-btn', { active: language === 'zh-TW' })}
                  onClick={() => changeLanguage('zh-TW')}
                >
                  {t('language.zhTW')}
                </button>
                <button
                  type="button"
                  className={classNames('seg-btn', { active: language === 'en' })}
                  onClick={() => changeLanguage('en')}
                >
                  {t('language.en')}
                </button>
              </div>
            </div>
          </section>
        )}

        {section === 'shortcuts' && (
          <section className="setting-card">
            <div className="card-head">
              <Keyboard theme="outline" size={15} fill="#64748b" strokeWidth={4} />
              <span>{t('setting.shortcuts.title')}</span>
            </div>

            <div className="setting-row">
              <div className="row-label">
                <span className="label-main">{t('setting.shortcuts.openSearch.label')}</span>
                <span className="label-sub">{t('setting.shortcuts.openSearch.sub')}</span>
                <span
                  className={classNames('cut-status', {
                    'is-ok': cutStatus.registered,
                    'is-bad': Boolean(cutStatus.accelerator) && !cutStatus.registered
                  })}
                >
                  {cutStatus.registered
                    ? t('setting.shortcuts.openSearch.registered', { acc: cutStatus.accelerator })
                    : cutStatus.error || t('setting.shortcuts.openSearch.hintDefault')}
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
                    {t('common.clear')}
                  </button>
                )}
              </div>
            </div>

            <div className="setting-row">
              <div className="row-label">
                <span className="label-main">{t('setting.shortcuts.openClipboard.label')}</span>
                <span className="label-sub">{t('setting.shortcuts.openClipboard.sub')}</span>
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
                  {t('common.resetDefault')}
                </button>
              </div>
            </div>
          </section>
        )}

        {section === 'apps' && (
          <section className="setting-card">
            <div className="card-head">
              <span className="card-head-dot" />
              <span>{t('setting.apps.cardHead')}</span>
            </div>
            <AppShortcuts />
          </section>
        )}

        {section === 'search' && (
          <>
            <section className="setting-card">
              <div className="card-head">
                <WebPage theme="outline" size={15} fill="#64748b" strokeWidth={4} />
                <span>{t('setting.search.webSearch.title')}</span>
              </div>

              <div className="setting-row">
                <div className="row-label">
                  <span className="label-main">{t('setting.search.defaultEngine.label')}</span>
                  <span className="label-sub">{t('setting.search.defaultEngine.sub')}</span>
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
                <span>{t('setting.search.engines.title')}</span>
              </div>
              <WebEngines engines={engines} onChange={handleEnginesChange} />
            </section>

            <section className="setting-card">
              <div className="card-head">
                <FolderSearch theme="outline" size={15} fill="#64748b" strokeWidth={4} />
                <span>{t('setting.search.fileSearch.title')}</span>
              </div>

              <div className="setting-row">
                <div className="row-label">
                  <span className="label-main">{t('setting.search.searchDirs.label')}</span>
                  <span className="label-sub">
                    {dirs.length > 0
                      ? t('setting.search.searchDirs.subHas', { n: dirs.length })
                      : t('setting.search.searchDirs.subNone')}
                  </span>
                </div>
                <div className="row-control">
                  <button type="button" className="mini-btn" onClick={() => void addSearchDir()}>
                    {t('setting.search.addDir')}
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
                        {t('common.remove')}
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
              <span>{t('setting.clipboard.title')}</span>
            </div>

            <div className="setting-row">
              <div className="row-label">
                <span className="label-main">{t('setting.clipboard.retention.label')}</span>
                <span className="label-sub">
                  {Number(retentionDays) > 0
                    ? t('setting.clipboard.retention.subDays', { n: retentionDays })
                    : t('setting.clipboard.retention.subForever')}
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
                <span className="step-unit">{t('setting.clipboard.daysUnit')}</span>
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
              <span>{t('setting.data.title')}</span>
            </div>

            <div className="setting-row">
              <div className="row-label">
                <span className="label-main">{t('setting.data.dir.label')}</span>
                <span className="label-sub">{t('setting.data.dir.sub')}</span>
              </div>
              <div className="row-control">
                <span className="dir-path" title={databaseDirectory}>
                  {databaseDirectory || t('setting.data.dir.default')}
                </span>
                <button type="button" className="mini-btn" onClick={() => void chooseDirectory()}>
                  {t('setting.data.dir.change')}
                </button>
              </div>
            </div>
          </section>
        )}

        {section === 'about' && (
          <>
            <section className="setting-card">
              <div className="card-head">
                <Download theme="outline" size={15} fill="#64748b" strokeWidth={4} />
                <span>{t('setting.about.version.title')}</span>
              </div>

              <div className="setting-row">
                <div className="row-label">
                  <span className="label-main">{t('setting.about.version.appLabel')}</span>
                  <span className="label-sub">{t('setting.about.version.sub')}</span>
                </div>
                <span className="row-static">v{about?.currentVersion ?? '…'}</span>
              </div>

              <div className="setting-row">
                <div className="row-label">
                  <span className="label-main">{t('setting.about.latest.title')}</span>
                  <span className="label-sub">
                    {aboutLoading
                      ? t('setting.about.latest.checking')
                      : about?.fetchFailed
                        ? t('setting.about.latest.failed')
                        : about?.hasUpdate
                          ? t('setting.about.latest.hasUpdate')
                          : t('setting.about.latest.upToDate')}
                  </span>
                </div>
                <div className="row-control">
                  {about && !aboutLoading && !about.fetchFailed && (
                    <span
                      className={classNames('cut-status', {
                        'is-ok': !about.hasUpdate,
                        'is-bad': about.hasUpdate
                      })}
                    >
                      {about.hasUpdate
                        ? t('setting.about.latest.available', { version: about.latestVersion })
                        : t('setting.about.latest.latest')}
                    </span>
                  )}
                  {about?.hasUpdate && (
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() => void window.api.openExternal(about.releaseUrl)}
                    >
                      {t('setting.about.download')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={refreshAbout}
                    disabled={aboutLoading}
                  >
                    {t('setting.about.recheck')}
                  </button>
                </div>
              </div>
            </section>

            <section className="setting-card">
              <div className="card-head">
                <User theme="outline" size={15} fill="#64748b" strokeWidth={4} />
                <span>{t('setting.about.author.title')}</span>
              </div>

              <div className="setting-row">
                <div className="row-label">
                  <span className="label-main">{about?.author.name ?? 'lkddi'}</span>
                  <span className="label-sub">{t('setting.about.author.sub')}</span>
                </div>
                <div className="row-control">
                  <button
                    type="button"
                    className="mini-btn has-icon"
                    onClick={() =>
                      void window.api.openExternal(about?.author.blog ?? 'https://ay.lc')
                    }
                  >
                    <Link theme="outline" size={12} fill="#64748b" strokeWidth={4} />
                    {t('setting.about.blog')}
                  </button>
                  <button
                    type="button"
                    className="mini-btn has-icon"
                    onClick={() =>
                      void window.api.openExternal(
                        about?.author.repo ?? 'https://github.com/lkddi/snippets'
                      )
                    }
                  >
                    <Github theme="outline" size={12} fill="#64748b" strokeWidth={4} />
                    {t('setting.about.github')}
                  </button>
                </div>
              </div>
            </section>
          </>
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
        <input type="hidden" name="language" value={language} readOnly />

        <footer className="page-footer">{t('setting.footer')}</footer>
      </main>
    </Form>
  )
}

export default Setting
