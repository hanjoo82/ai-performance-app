import { canSubmitterReply } from '../lib/evalStatus'

export default function RecordFeedbackThread({
  record,
  comments = [],
  replyDraft = '',
  replySaving = false,
  onReplyDraftChange,
  onSubmitReply,
  allowReply = true,
  compact = false,
}) {
  const showReply = allowReply && canSubmitterReply(record, comments)

  if (comments.length === 0 && !showReply) return null

  return (
    <div
      style={{ marginTop: compact ? 8 : 10 }}
      onClick={e => e.stopPropagation()}
    >
      {comments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: showReply ? 10 : 0 }}>
          {comments.map(c => (
            <div
              key={c.id}
              style={{
                padding: compact ? '7px 10px' : '8px 10px',
                borderRadius: 8,
                background: c.author_role === 'evaluator' ? 'var(--accent-light)' : 'var(--surface2)',
                color: c.author_role === 'evaluator' ? 'var(--accent-text)' : 'var(--text2)',
                fontSize: compact ? 12 : 13,
              }}
            >
              <div style={{ fontSize: compact ? 10 : 11, opacity: 0.8, marginBottom: 2 }}>
                {c.author_role === 'evaluator' ? '평가자' : '등록자'} · {(c.created_at || '').slice(0, 16).replace('T', ' ')}
              </div>
              {c.message}
            </div>
          ))}
        </div>
      )}

      {showReply && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold-text)', marginBottom: 6 }}>
            평가자 의견에 답변해 주세요
          </div>
          <textarea
            placeholder="보완 요청에 대한 답변 작성"
            style={{ minHeight: compact ? 54 : 64, marginBottom: 6 }}
            value={replyDraft}
            onChange={e => onReplyDraftChange(e.target.value)}
          />
          <button
            className="btn btn-primary btn-block"
            style={{ padding: '10px 12px' }}
            disabled={replySaving || !replyDraft.trim()}
            onClick={onSubmitReply}
          >
            {replySaving ? '저장 중...' : '답변 저장'}
          </button>
        </>
      )}
    </div>
  )
}
