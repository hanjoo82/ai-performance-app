import { useEffect } from 'react'

function isImageAttachment(fileName, mimeType) {
  const mime = (mimeType || '').toLowerCase()
  if (mime.startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp)$/i.test(fileName || '')
}

function isPdfAttachment(fileName, mimeType) {
  const mime = (mimeType || '').toLowerCase()
  if (mime === 'application/pdf') return true
  return /\.pdf$/i.test(fileName || '')
}

export function canPreviewAttachment(fileName, mimeType) {
  return isImageAttachment(fileName, mimeType) || isPdfAttachment(fileName, mimeType)
}

export default function AttachmentPreviewModal({
  open,
  fileName,
  mimeType,
  url,
  loading,
  error,
  onClose,
}) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  const isImage = isImageAttachment(fileName, mimeType)
  const isPdf = isPdfAttachment(fileName, mimeType)

  return (
    <div
      className="attachment-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={fileName || '첨부파일 미리보기'}
      onClick={onClose}
    >
      <div
        className="attachment-preview-panel"
        onClick={e => e.stopPropagation()}
      >
        <div className="attachment-preview-header">
          <div className="attachment-preview-title" title={fileName}>
            {fileName || '첨부파일'}
          </div>
          <button
            type="button"
            className="btn btn-ghost attachment-preview-close"
            onClick={onClose}
          >
            닫기
          </button>
        </div>

        <div className="attachment-preview-body">
          {loading && (
            <div className="attachment-preview-status">불러오는 중...</div>
          )}
          {!loading && error && (
            <div className="attachment-preview-status" style={{ color: 'var(--danger)' }}>
              {error}
            </div>
          )}
          {!loading && !error && url && isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={fileName || '첨부 이미지'} className="attachment-preview-image" />
          )}
          {!loading && !error && url && isPdf && (
            <iframe
              title={fileName || 'PDF 미리보기'}
              src={url}
              className="attachment-preview-frame"
            />
          )}
          {!loading && !error && url && !isImage && !isPdf && (
            <div className="attachment-preview-status">
              이 형식은 미리보기를 지원하지 않습니다.
              <div style={{ marginTop: 12 }}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                  새 탭에서 열기
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
