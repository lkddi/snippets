import { FileText, FolderClose, Link, Pic } from '@icon-park/react'
import dayjs from 'dayjs'
import { Fragment } from 'react'
import { useT } from '@renderer/i18n'
import { useStore } from '@renderer/store/useStore'
import './styles.scss'

/** 字节数 → "84 KB" / "4.6 MB"；0 表示无意义（文件夹） */
const formatBytes = (bytes: number): string => {
  if (!bytes) return ''
  const mb = bytes / 1024 / 1024
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  const kb = bytes / 1024
  if (kb >= 1) return `${kb.toFixed(0)} KB`
  return `${bytes} B`
}

/** 预览浮层：盖在结果列表上，空格唤出、空格/Esc/点击收起 */
export default function Preview(): JSX.Element | null {
  const t = useT()
  const preview = useStore((state) => state.preview)
  const setPreview = useStore((state) => state.setPreview)

  if (!preview) return null
  const close = (): void => setPreview(null)

  const size = preview.kind === 'image' || preview.kind === 'text' || preview.kind === 'info' ? preview.bytes : 0
  const title = preview.kind === 'snippet' ? preview.title : preview.name

  // 头部右侧的类型 / 体积摘要
  const meta = ((): string => {
    if (preview.kind === 'image') return `${preview.width}×${preview.height} · ${formatBytes(size)}`
    if (preview.kind === 'text') return formatBytes(size)
    if (preview.kind === 'info') {
      if (preview.isDir) return `${t('search.preview.folder')} · ${t('search.preview.items', { n: preview.entries })}`
      return [preview.ext ? preview.ext.toUpperCase() : '', formatBytes(size)].filter(Boolean).join(' · ')
    }
    if (preview.kind === 'snippet') return t('search.preview.snippet')
    return t('search.preview.app')
  })()

  return (
    <aside className="search-preview" onClick={close}>
      <header>
        <span className="preview-title" title={title}>
          {title}
        </span>
        <span className="preview-meta">{meta}</span>
      </header>

      <section className="preview-body">
        {preview.kind === 'image' ? (
          <img className="preview-shot" src={preview.dataUrl} alt="" />
        ) : preview.kind === 'text' || preview.kind === 'snippet' ? (
          <Fragment>
            {/* 片段是中文正文，用正文字体；文件预览按代码用等宽字体 */}
            <pre className={`preview-code${preview.kind === 'snippet' ? ' is-snippet' : ''}`}>{preview.text}</pre>
            {preview.truncated && <div className="preview-note">{t('search.preview.truncated')}</div>}
          </Fragment>
        ) : (
          <div className="preview-info">
            <span className="preview-icon">
              {preview.kind === 'app' ? (
                <Link theme="outline" size="22" fill="#0a84ff" strokeWidth={3} />
              ) : preview.isDir ? (
                <FolderClose theme="outline" size="22" fill="#f59e0b" strokeWidth={3} />
              ) : (
                <FileText theme="outline" size="22" fill="#0a84ff" strokeWidth={3} />
              )}
            </span>
            <div className="preview-path" title={preview.path}>
              {preview.path}
            </div>
            {preview.kind === 'info' && (
              <div className="preview-facts">
                {!!size && <span>{formatBytes(size)}</span>}
                <span>{dayjs(preview.modified).format('YYYY-MM-DD HH:mm')}</span>
              </div>
            )}
          </div>
        )}
      </section>

      <footer>
        <Pic theme="outline" size="12" fill="#94a3b8" strokeWidth={4} />
        <span>{t('search.preview.hint')}</span>
      </footer>
    </aside>
  )
}
