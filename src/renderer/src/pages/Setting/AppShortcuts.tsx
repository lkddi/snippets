import ShortCutRecorder from '@renderer/components/ShortCutRecorder'
import { Close, Plus, Search as SearchIcon } from '@icon-park/react'
import { Input, Modal } from 'antd'
import classNames from 'classnames'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@renderer/i18n'
import './AppShortcuts.scss'

type Row = AppShortcutStateType & {
  /** 还没落库的临时行（刚添加、尚未录制快捷键） */
  persisted: boolean
}

/**
 * 应用快捷键：给单个应用绑定「按下启动 / 再按隐藏」的全局热键。
 * 所有占用检测都在主进程做（应用内其它绑定、搜索、剪贴板、系统与其它应用），
 * 这里只负责把失败原因展示清楚。
 */
export const AppShortcuts = () => {
  const t = useT()
  const [items, setItems] = useState<AppShortcutStateType[]>([])
  const [pending, setPending] = useState<AppInfoType[]>([])
  const [icons, setIcons] = useState<Record<string, string>>({})
  const [rowError, setRowError] = useState<Record<string, string>>({})
  const [pickerOpen, setPickerOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [apps, setApps] = useState<AppInfoType[]>([])
  const requestedIcons = useRef<Set<string>>(new Set())

  const refresh = async (): Promise<void> => {
    setItems(await window.api.listAppShortCuts())
  }

  useEffect(() => {
    void refresh()
  }, [])

  const rows: Row[] = useMemo(() => {
    const saved = items.map((item) => ({ ...item, persisted: true }))
    const savedPaths = new Set(items.map((item) => item.path))
    const drafts = pending
      .filter((item) => !savedPaths.has(item.path))
      .map((item) => ({
        path: item.path,
        name: item.name,
        alias: item.alias,
        bundleId: item.bundleId,
        accelerator: '',
        registered: false,
        error: '',
        persisted: false
      }))
    return [...saved, ...drafts]
  }, [items, pending])

  // 图标按需加载：只有已经出现在列表里的应用才取，避免一次性拉几百个 base64
  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      for (const row of rows) {
        if (requestedIcons.current.has(row.path)) continue
        requestedIcons.current.add(row.path)
        const icon = await window.api.getAppIcon(row.path)
        if (cancelled) return
        if (icon) setIcons((prev) => ({ ...prev, [row.path]: icon }))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [rows])

  const openPicker = async (): Promise<void> => {
    setPickerOpen(true)
    if (apps.length === 0) setApps(await window.api.listApps())
  }

  const filteredApps = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    const list = kw
      ? apps.filter(
          (app) =>
            app.name.toLowerCase().includes(kw) ||
            (app.alias ?? '').toLowerCase().includes(kw)
        )
      : apps
    return list.slice(0, 60)
  }, [apps, keyword])

  // 弹窗里的可见行也懒加载图标
  useEffect(() => {
    if (!pickerOpen) return
    let cancelled = false
    const load = async (): Promise<void> => {
      for (const app of filteredApps) {
        if (requestedIcons.current.has(app.path)) continue
        requestedIcons.current.add(app.path)
        const icon = await window.api.getAppIcon(app.path)
        if (cancelled) return
        if (icon) setIcons((prev) => ({ ...prev, [app.path]: icon }))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [pickerOpen, filteredApps])

  const boundPaths = useMemo(() => new Set(rows.map((row) => row.path)), [rows])

  const addApp = (app: AppInfoType): void => {
    setPending((prev) => [...prev, app])
    setPickerOpen(false)
    setKeyword('')
  }

  const removeRow = async (row: Row): Promise<void> => {
    if (!row.persisted) {
      setPending((prev) => prev.filter((item) => item.path !== row.path))
      return
    }
    await window.api.removeAppShortCut(row.path)
    setRowError((prev) => {
      const next = { ...prev }
      delete next[row.path]
      return next
    })
    await refresh()
    // 移除后允许重新添加同一个应用时重新取图标
    requestedIcons.current.delete(row.path)
  }

  const record = async (row: Row, accelerator: string): Promise<void> => {
    const result = await window.api.setAppShortCut({
      path: row.path,
      name: row.name,
      alias: row.alias,
      bundleId: row.bundleId,
      accelerator
    })
    if (!result.ok) {
      setRowError((prev) => ({ ...prev, [row.path]: result.error }))
      return
    }
    setRowError((prev) => {
      const next = { ...prev }
      delete next[row.path]
      return next
    })
    setPending((prev) => prev.filter((item) => item.path !== row.path))
    await refresh()
  }

  return (
    <>
      <div className="setting-row">
        <div className="row-label">
          <span className="label-main">{t('appShortcuts.title')}</span>
          <span className="label-sub">
            {rows.length > 0
              ? t('appShortcuts.boundSub', { n: rows.length })
              : t('appShortcuts.unboundSub')}
          </span>
        </div>
        <div className="row-control">
          <button type="button" className="mini-btn accent" onClick={() => void openPicker()}>
            <Plus theme="outline" size={12} fill="#0a84ff" strokeWidth={4} />
            {t('appShortcuts.addApp')}
          </button>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="app-cut-list">
          {rows.map((row) => {
            const error = rowError[row.path] || (!row.persisted ? '' : row.error)
            return (
              <div key={row.path} className="app-cut-row">
                {icons[row.path] ? (
                  <img className="app-cut-icon" src={icons[row.path]} alt="" />
                ) : (
                  <span className="app-cut-icon app-cut-fallback">
                    {row.alias?.slice(0, 1) || row.name.slice(0, 1)}
                  </span>
                )}
                <div className="app-cut-meta">
                  <span className="app-cut-name">{row.alias || row.name}</span>
                  <span
                    className={classNames('app-cut-status', {
                      'is-ok': row.persisted && row.registered && !error,
                      'is-bad': Boolean(error),
                      'is-idle': !row.persisted || !row.accelerator
                    })}
                  >
                    {error
                      ? error
                      : row.persisted && row.registered
                        ? t('appShortcuts.activeStatus', { acc: row.accelerator })
                        : t('appShortcuts.idleStatus')}
                  </span>
                </div>
                <ShortCutRecorder
                  value={row.accelerator}
                  placeholder={t('appShortcuts.recordPlaceholder')}
                  className="app-cut-recorder"
                  onRecordStart={() =>
                    setRowError((prev) => {
                      const next = { ...prev }
                      delete next[row.path]
                      return next
                    })
                  }
                  onChange={(accelerator) => void record(row, accelerator)}
                />
                <button
                  type="button"
                  className="icon-btn"
                  title={t('appShortcuts.removeTitle')}
                  onClick={() => void removeRow(row)}
                >
                  <Close theme="outline" size={13} fill="#94a3b8" strokeWidth={4} />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="app-cut-empty">
          {t('appShortcuts.empty')}
        </div>
      )}

      <p className="app-cut-hint">
        {t('appShortcuts.hint')}
      </p>

      <Modal
        open={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        footer={null}
        width={520}
        title={t('appShortcuts.pickerTitle')}
        destroyOnClose
        className="app-picker-modal"
      >
        <Input
          autoFocus
          allowClear
          value={keyword}
          placeholder={t('appShortcuts.searchPlaceholder')}
          prefix={<SearchIcon theme="outline" size={14} fill="#94a3b8" strokeWidth={4} />}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <div className="app-picker-list">
          {filteredApps.map((app) => {
            const bound = boundPaths.has(app.path)
            return (
              <button
                key={app.path}
                type="button"
                className={classNames('app-picker-row', { bound })}
                disabled={bound}
                onClick={() => addApp(app)}
              >
                {icons[app.path] ? (
                  <img className="app-picker-icon" src={icons[app.path]} alt="" />
                ) : (
                  <span className="app-picker-icon app-cut-fallback">
                    {app.alias?.slice(0, 1) || app.name.slice(0, 1)}
                  </span>
                )}
                <span className="app-picker-name">{app.alias || app.name}</span>
                {app.alias && app.alias !== app.name && (
                  <span className="app-picker-sub">{app.name}</span>
                )}
                {bound && <span className="app-picker-bound">{t('appShortcuts.bound')}</span>}
              </button>
            )
          })}
          {filteredApps.length === 0 && (
            <div className="app-picker-empty">{t('appShortcuts.noMatch')}</div>
          )}
        </div>
      </Modal>
    </>
  )
}

export default AppShortcuts
