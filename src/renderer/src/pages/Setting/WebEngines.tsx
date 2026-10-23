import { Close, Plus, SettingTwo } from '@icon-park/react'
import { Input, Modal, Switch } from 'antd'
import classNames from 'classnames'
import { useMemo, useState } from 'react'
import { useT } from '@renderer/i18n'
import './WebEngines.scss'

type Props = {
  engines: WebEngineType[]
  /** 列表变化（增删改、启停）后回传，由设置页统一提交保存 */
  onChange: (engines: WebEngineType[]) => void
}

type Draft = {
  /** 编辑已有引擎时带 id，新增时为空 */
  id: string
  name: string
  keyword: string
  url: string
  enabled: boolean
  builtin?: boolean
}

const EMPTY_DRAFT: Draft = { id: '', name: '', keyword: '', url: '', enabled: true }

/** 关键字只允许字母数字和短横线，避免和搜索词粘在一起无法识别 */
const KEYWORD_RE = /^[a-z0-9-]{1,16}$/
const hasPlaceholder = (url: string): boolean => /\{(query|q)\}/i.test(url)

/**
 * 网页搜索引擎管理：内置引擎（百度 / GitHub / 京东 / 淘宝…）可停用，
 * 自定义引擎可增删改；每条都带触发关键字。
 */
export const WebEngines = ({ engines, onChange }: Props) => {
  const t = useT()
  const [editing, setEditing] = useState<Draft | null>(null)
  const [error, setError] = useState('')

  const defaultKeywordTip = useMemo(() => {
    const sample = engines.find((engine) => engine.enabled)
    return sample ? t('webEngines.tipExample', { kw: sample.keyword }) : t('webEngines.tipNone')
  }, [engines, t])

  const update = (id: string, patch: Partial<WebEngineType>): void => {
    onChange(engines.map((engine) => (engine.id === id ? { ...engine, ...patch } : engine)))
  }

  const remove = (id: string): void => {
    onChange(engines.filter((engine) => engine.id !== id))
  }

  const openAdd = (): void => {
    setError('')
    setEditing({ ...EMPTY_DRAFT })
  }

  const openEdit = (engine: WebEngineType): void => {
    setError('')
    setEditing({ ...engine })
  }

  const save = (): void => {
    if (!editing) return
    const name = editing.name.trim()
    const keyword = editing.keyword.trim().toLowerCase().replace(/\s+/g, '')
    const url = editing.url.trim()

    if (!name) return setError(t('webEngines.errName'))
    if (!KEYWORD_RE.test(keyword)) return setError(t('webEngines.errKeyword'))
    if (!url) return setError(t('webEngines.errUrl'))
    if (!hasPlaceholder(url)) return setError(t('webEngines.errPlaceholder'))

    const duplicated = engines.some(
      (engine) => engine.keyword === keyword && engine.id !== editing.id
    )
    if (duplicated) return setError(t('webEngines.errDuplicate', { kw: keyword }))

    if (editing.id) {
      onChange(
        engines.map((engine) =>
          engine.id === editing.id
            ? { ...engine, name, keyword, url, enabled: editing.enabled }
            : engine
        )
      )
    } else {
      const id = `custom-${keyword}-${Date.now().toString(36)}`
      onChange([
        ...engines,
        { id, name, keyword, url, enabled: editing.enabled, builtin: false }
      ])
    }
    setEditing(null)
  }

  return (
    <>
      <div className="setting-row">
        <div className="row-label">
          <span className="label-main">{t('webEngines.title')}</span>
          <span className="label-sub">
            {t('webEngines.sub', { tip: defaultKeywordTip })}
          </span>
        </div>
        <div className="row-control">
          <button type="button" className="mini-btn accent" onClick={openAdd}>
            <Plus theme="outline" size={12} fill="#0a84ff" strokeWidth={4} />
            {t('webEngines.addEngine')}
          </button>
        </div>
      </div>

      <div className="engine-list">
        {engines.map((engine) => (
          <div
            key={engine.id}
            className={classNames('engine-row', { 'is-off': !engine.enabled })}
          >
            <div className="engine-meta">
              <div className="engine-line">
                <span className="engine-name">{engine.name}</span>
                <code className="engine-key">{engine.keyword}</code>
                {engine.builtin && <span className="engine-tag">{t('webEngines.builtin')}</span>}
              </div>
              <span className="engine-url" title={engine.url}>
                {engine.url}
              </span>
            </div>
            <div className="engine-actions">
              <Switch
                size="small"
                checked={engine.enabled}
                onChange={(checked) => update(engine.id, { enabled: checked })}
              />
              <button
                type="button"
                className="icon-btn"
                title={t('common.edit')}
                onClick={() => openEdit(engine)}
              >
                <SettingTwo theme="outline" size={13} fill="#94a3b8" strokeWidth={4} />
              </button>
              {!engine.builtin && (
                <button
                  type="button"
                  className="icon-btn"
                  title={t('common.remove')}
                  onClick={() => remove(engine.id)}
                >
                  <Close theme="outline" size={13} fill="#94a3b8" strokeWidth={4} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={Boolean(editing)}
        title={editing?.id ? t('webEngines.editTitle') : t('webEngines.addTitle')}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        width={520}
        destroyOnClose
        onCancel={() => setEditing(null)}
        onOk={save}
        className="engine-modal"
      >
        {editing && (
          <div className="engine-form">
            <label className="engine-field">
              <span>{t('webEngines.fieldName')}</span>
              <Input
                value={editing.name}
                placeholder={t('webEngines.namePlaceholder')}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>
            <label className="engine-field">
              <span>{t('webEngines.fieldKeyword')}</span>
              <Input
                value={editing.keyword}
                placeholder={t('webEngines.keywordPlaceholder')}
                onChange={(e) => setEditing({ ...editing, keyword: e.target.value })}
              />
              <i>
                {t('webEngines.keywordHint', {
                  kw: editing.keyword.trim() || t('webEngines.keywordFallback')
                })}
              </i>
            </label>
            <label className="engine-field">
              <span>{t('webEngines.fieldUrl')}</span>
              <Input
                value={editing.url}
                placeholder={t('webEngines.urlPlaceholder')}
                onChange={(e) => setEditing({ ...editing, url: e.target.value })}
              />
              <i>{t('webEngines.urlHint')}</i>
            </label>
            <label className="engine-field engine-field-inline">
              <span>{t('webEngines.fieldEnabled')}</span>
              <Switch
                size="small"
                checked={editing.enabled}
                onChange={(checked) => setEditing({ ...editing, enabled: checked })}
              />
            </label>
            {error && <p className="engine-error">{error}</p>}
          </div>
        )}
      </Modal>
    </>
  )
}

export default WebEngines
