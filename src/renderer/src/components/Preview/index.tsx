import { FileText, FolderClose, Link, Pic } from '@icon-park/react'
import dayjs from 'dayjs'
import { Fragment } from 'react'
import { useT } from '@renderer/i18n'
import { useStore } from '@renderer/store/useStore'
import './styles.scss'

/** 字节数 → "84 KB" / "4.6 MB"；0 表示无意义（文件夹） */const formatBytes = (bytes: number): string => {
  if (!bytes) return ''
  const mb = bytes / 1024 / 1024
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  const kb = bytes / 1024
  if (kb >= 1) return `${kb.toFixed(0)} KB`
  return `${bytes} B`
}

/** 系统 Quick Look 面板只有 macOS 提供，其它平台不展示入口 */
const isMac = ((): boolean => {
  const platform = window.electron?.process?.platform
  if (platform) return platform === 'darwin'
  return navigator.userAgent.includes('Mac')
})()

/** 预览浮层：盖在结果列表上，空格唤出、空格/Esc/点击收起 */
export default function Preview(): JSX.Element | null {
  const t = useT()
  const preview = useStore((state) => state.preview)
  const setPreview = useStore((state) => state.setPreview)

  if (!preview) return null
  const close = (): void => setPreview(null)

  const size =
    preview.kind === 'image' ||
    preview.kind === 'text' ||
    preview.kind === 'info' ||
    preview.kind === 'pdf' ||
    preview.kind === 'media' ||
    preview.kind === 'thumb'
      ? preview.bytes
      : 0
  const title = preview.kind === 'snippet' ? preview.title : preview.name

  // 头部右侧的类型 / 体积摘要
  const meta = ((): string => {
    if (preview.kind === 'image') return `${preview.width}×${preview.height} · ${formatBytes(size)}`
    if (preview.kind === 'text') return formatBytes(size)
    if (preview.kind === 'pdf') return `PDF · ${formatBytes(size)}`
    if (preview.kind === 'media') return `${preview.media.toUpperCase()} · ${formatBytes(size)}`
    if (preview.kind === 'thumb') return [preview.ext.toUpperCase(), formatBytes(size)].filter(Boolean).join(' · ')
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
        {/* PDF / 视频会把键盘焦点吃进 iframe，这时快捷键失效，留一个可点的关闭按钮 */}
        <button className="preview-close" onClick={(e) => {
          e.stopPropagation()
          close()
        }} aria-label={t('search.preview.close')}>
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <section className="preview-body">
        {preview.kind === 'loading' ? (
          <div className="preview-loading">
            <span className="preview-spinner" />
            <span>{t('search.preview.loading')}</span>
          </div>
        ) : preview.kind === 'image' || preview.kind === 'thumb' ? (
          <img className="preview-shot" src={preview.dataUrl} alt="" />
        ) : preview.kind === 'pdf' ? (
          <iframe
            className="preview-pdf"
            // 关掉工具栏，把 460 多像素的宽度尽量留给页面本身，滚动即可翻页
            src={`${preview.url}#view=FitH&toolbar=0&navpanes=0`}
            title={preview.name}
          />
        ) : preview.kind === 'media' ? (
          preview.media === 'video' ? (
            <video className="preview-media" src={preview.url} controls preload="metadata" />
          ) : (
            <div className="preview-audio">
              <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
                <path
                  fill="#0a84ff"
                  d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z"
                />
              </svg>
              <audio className="preview-media" src={preview.url} controls preload="metadata" />
            </div>
          )
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
        {'path' in preview && isMac && (
          <button
            className="preview-quicklook"
            onClick={(e) => {
              e.stopPropagation()
              void window.api.openQuickLook(preview.path)
            }}
          >
            {t('search.preview.quicklook')}
          </button>
        )}
      </footer>
    </aside>
  )
}
