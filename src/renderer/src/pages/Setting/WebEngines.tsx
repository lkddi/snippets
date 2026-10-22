import { Close, Plus, SettingTwo } from '@icon-park/react'
import { Input, Modal, Switch } from 'antd'
import classNames from 'classnames'
import { useMemo, useState } from 'react'
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
  const [editing, setEditing] = useState<Draft | null>(null)
  const [error, setError] = useState('')

  const defaultKeywordTip = useMemo(() => {
    const sample = engines.find((engine) => engine.enabled)
    return sample ? `例如输入「${sample.keyword} 关键词」` : '给引擎设置关键字后即可定向搜索'
  }, [engines])

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

    if (!name) return setError('请填写引擎名称')
    if (!KEYWORD_RE.test(keyword)) return setError('关键字只能是 1-16 位字母 / 数字 / 短横线')
    if (!url) return setError('请填写搜索地址')
    if (!hasPlaceholder(url)) return setError('搜索地址里要用 {query} 表示关键词位置')

    const duplicated = engines.some(
      (engine) => engine.keyword === keyword && engine.id !== editing.id
    )
    if (duplicated) return setError(`关键字「${keyword}」已被其它引擎使用`)

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
          <span className="label-main">搜索引擎</span>
          <span className="label-sub">
            关键字触发：{defaultKeywordTip}；不带关键字时用默认引擎
          </span>
        </div>
        <div className="row-control">
          <button type="button" className="mini-btn accent" onClick={openAdd}>
            <Plus theme="outline" size={12} fill="#0a84ff" strokeWidth={4} />
            添加引擎
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
                {engine.builtin && <span className="engine-tag">内置</span>}
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
                title="编辑"
                onClick={() => openEdit(engine)}
              >
                <SettingTwo theme="outline" size={13} fill="#94a3b8" strokeWidth={4} />
              </button>
              {!engine.builtin && (
                <button
                  type="button"
                  className="icon-btn"
                  title="删除"
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
        title={editing?.id ? '编辑搜索引擎' : '添加搜索引擎'}
        okText="保存"
        cancelText="取消"
        width={520}
        destroyOnClose
        onCancel={() => setEditing(null)}
        onOk={save}
        className="engine-modal"
      >
        {editing && (
          <div className="engine-form">
            <label className="engine-field">
              <span>名称</span>
              <Input
                value={editing.name}
                placeholder="例如 GitHub"
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>
            <label className="engine-field">
              <span>触发关键字</span>
              <Input
                value={editing.keyword}
                placeholder="例如 github"
                onChange={(e) => setEditing({ ...editing, keyword: e.target.value })}
              />
              <i>在搜索框输入「{editing.keyword.trim() || '关键字'} 关键词」即用这个引擎</i>
            </label>
            <label className="engine-field">
              <span>搜索地址</span>
              <Input
                value={editing.url}
                placeholder="https://github.com/search?q={query}"
                onChange={(e) => setEditing({ ...editing, url: e.target.value })}
              />
              <i>用 {'{query}'} 表示关键词位置，搜索时自动替换并做 URL 编码</i>
            </label>
            <label className="engine-field engine-field-inline">
              <span>启用</span>
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
