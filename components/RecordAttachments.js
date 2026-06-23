import { useEffect, useState } from 'react'
import {
  attachmentDownloadUrl,
  deleteAttachment,
  formatFileSize,
  isAttachmentApiUnavailable,
  listAttachments,
} from '../lib/attachments'

export default function RecordAttachments({
  recordId,
  email,
  canView,
  canManage = false,
  onCountChange,
}) {
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    if (!canView || !recordId || !email) {
      setAttachments([])
      onCountChange?.(0)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    setUnavailable(false)

    listAttachments(recordId, email)
      .then((items) => {
        if (cancelled) return
        setAttachments(items)
        onCountChange?.(items.length)
      })
      .catch((err) => {
        if (cancelled) return
        if (isAttachmentApiUnavailable(err.message)) {
          setUnavailable(true)
          onCountChange?.(0)
          return
        }
        setError(err.message || '첨부파일을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [recordId, email, canView])

  async function handleDelete(attachmentId) {
    if (!canManage) return
    if (!confirm('첨부파일을 삭제할까요?')) return
    setDeletingId(attachmentId)
    try {
      await deleteAttachment(attachmentId, email)
      setAttachments(prev => {
        const next = prev.filter(a => a.id !== attachmentId)
        onCountChange?.(next.length)
        return next
      })
    } catch (err) {
      alert(err.message || '삭제 실패')
    } finally {
      setDeletingId(null)
    }
  }

  if (!canView || unavailable) return null

  return (
    <div style={{ marginTop: 10, marginBottom: 10 }}>
      <div style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 11, marginBottom: 6 }}>
        첨부파일 <span style={{ fontWeight: 400 }}>(본인·평가자만 열람)</span>
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>첨부파일 불러오는 중...</div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>
      )}
      {!loading && !error && attachments.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>첨부파일 없음</div>
      )}

      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {attachments.map(a => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
              }}
            >
              <i className="ti ti-paperclip" style={{ color: 'var(--text3)' }} />
              <a
                href={attachmentDownloadUrl(a.id, email)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13,
                  color: 'var(--accent-text)',
                  textDecoration: 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {a.file_name}
              </a>
              <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                {formatFileSize(a.size_bytes)}
              </span>
              {canManage && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(a.id) }}
                  disabled={deletingId === a.id}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    padding: 4,
                    fontSize: 12,
                  }}
                >
                  {deletingId === a.id ? '...' : '삭제'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
