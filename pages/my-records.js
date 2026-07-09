import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/useAuth'
import { addRecordComment, deleteRecord, getCommentsByRecordIds, getMyRecords } from '../lib/db'
import { canSubmitterReply, filterDisplayComments, getEvalStatus, shouldShowFinalFeedback } from '../lib/evalStatus'
import Layout from '../components/Layout'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import RecordSummaryHeader from '../components/RecordSummaryHeader'
import RecordFeedbackThread from '../components/RecordFeedbackThread'
import RecordAttachmentManager from '../components/RecordAttachmentManager'
import { cleanupAttachmentsForRecord } from '../lib/attachments'
import Head from 'next/head'

const STATUS_STYLE = {
  submitted: { cls: 'badge-gray', label: '평가 대기' },
  revision_requested: { cls: 'badge-warn', label: '보완 요청(평가 보류)' },
  resubmitted: { cls: 'badge-info', label: '재검토 요청' },
  finalized: { cls: 'badge-gold', label: '평가완료' },
}

function recordDate(r) {
  return r.date || (r.created_at ? r.created_at.slice(0, 10) : '')
}

export default function MyRecords() {
  const { user, email, loading } = useAuth()
  const router = useRouter()
  const [records, setRecords] = useState([])
  const [expanded, setExpanded] = useState(() => new Set())
  const [fetching, setFetching] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [commentsByRecord, setCommentsByRecord] = useState({})
  const [replyDrafts, setReplyDrafts] = useState({})
  const [replySaving, setReplySaving] = useState({})

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user])

  useEffect(() => {
    if (!email) return
    getMyRecords(email).then(async (r) => {
      setRecords(r)
      try {
        const comments = await getCommentsByRecordIds(r.map(rec => rec.id))
        const grouped = comments.reduce((acc, c) => {
          if (!acc[c.record_id]) acc[c.record_id] = []
          acc[c.record_id].push(c)
          return acc
        }, {})
        setCommentsByRecord(grouped)
      } catch (err) {
        console.warn('record_comments load failed:', err?.message || err)
      }
      setFetching(false)
    }).catch((err) => {
      console.error('my records load failed:', err)
      alert(`내 기록을 불러오지 못했습니다.\n${err?.message || err}`)
      setFetching(false)
    })
  }, [email])

  useEffect(() => {
    if (!router.isReady || fetching) return
    const highlight = typeof router.query.highlight === 'string' ? router.query.highlight : ''
    if (!highlight) return
    setExpanded(prev => new Set([...prev, highlight]))
  }, [router.isReady, router.query.highlight, fetching])

  async function submitReply(rec) {
    const message = (replyDrafts[rec.id] || '').trim()
    if (!message) return
    setReplySaving(prev => ({ ...prev, [rec.id]: true }))
    try {
      const created = await addRecordComment({
        record_id: rec.id,
        author_email: email,
        author_name: user?.name || '등록자',
        author_role: 'submitter',
        message,
      })
      setCommentsByRecord(prev => ({
        ...prev,
        [rec.id]: [...(prev[rec.id] || []), created],
      }))
      setReplyDrafts(prev => ({ ...prev, [rec.id]: '' }))
    } catch (err) {
      alert(`답변 저장 실패\n${err?.message || err}`)
    } finally {
      setReplySaving(prev => ({ ...prev, [rec.id]: false }))
    }
  }

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function openDelete(rec) {
    if ((rec.score || 0) > 0) {
      alert('평가 완료된 실적은 삭제할 수 없습니다.')
      return
    }
    setDeleteTarget(rec)
  }

  async function confirmRemoveRecord() {
    const rec = deleteTarget
    if (!rec) return
    setDeleting(true)
    try {
      await cleanupAttachmentsForRecord(rec.id, email)
      await deleteRecord(rec.id)
      setRecords(prev => prev.filter(r => r.id !== rec.id))
      setDeleteTarget(null)
    } catch (err) {
      alert(`삭제 실패\n${err?.message || err}`)
    } finally {
      setDeleting(false)
    }
  }

  if (loading || !user) return null

  const modifiableCount = records.filter(r => (r.score || 0) === 0).length

  return (
    <>
      <Head><title>내 기록 · AI 성과 관리</title></Head>
      <Layout title="내 기록">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          <div className="stat" style={{ flex: 1, marginBottom: 0 }}>
            <div className="stat-val">{records.length}</div>
            <div className="stat-label">전체 실적</div>
          </div>
          <div className="stat" style={{ flex: 1, marginBottom: 0 }}>
            <div className="stat-val">{modifiableCount}</div>
            <div className="stat-label">수정 가능</div>
          </div>
        </div>

        {fetching ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>불러오는 중...</div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
            아직 등록된 실적이 없어요<br />
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => router.push('/register')}>
              <i className="ti ti-plus" /> 첫 실적 등록하기
            </button>
          </div>
        ) : records.map(r => {
          const isOpen = expanded.has(r.id)
          const comments = commentsByRecord[r.id] || []
          const displayComments = filterDisplayComments(r, comments)
          const evalStatus = getEvalStatus(r, comments)
          const statusStyle = STATUS_STYLE[evalStatus] || STATUS_STYLE.submitted
          const canModify = (r.score || 0) === 0
          const canManageAttachments = true
          const needsReply = canSubmitterReply(r, comments)
          const isHighlighted = router.query.highlight === r.id

          return (
            <div
              key={r.id}
              className="card"
              style={{
                marginBottom: 12,
                cursor: 'pointer',
                borderColor: isHighlighted ? 'var(--accent)' : needsReply ? 'var(--gold)' : undefined,
                boxShadow: isHighlighted ? '0 0 0 2px var(--accent-light)' : needsReply ? '0 0 0 1px var(--gold-light)' : undefined,
              }}
              onClick={() => toggleExpand(r.id)}
            >
              <RecordSummaryHeader
                userName={r.user_name}
                userDept={r.user_dept}
                userTeam={r.user_team}
                task={r.task}
                statusCls={statusStyle.cls}
                statusLabel={statusStyle.label}
                tool={r.tool}
                workCategory={r.tool}
                isOpen={isOpen}
              />

              {needsReply && !isOpen && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gold-text)' }}>
                  <i className="ti ti-message-circle" /> 평가자 의견에 답변이 필요합니다 · 펼쳐서 답변
                </div>
              )}

              {isOpen && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                    {recordDate(r)}
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 11, marginBottom: 2 }}>활용 내용</div>
                    {r.content}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 11, marginBottom: 2 }}>효과</div>
                    {r.effect}
                  </div>

                  <RecordAttachmentManager
                    recordId={r.id}
                    email={email}
                    canView
                    canManage={canManageAttachments}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    {r.score > 0
                      ? <span style={{ color: '#f0c040', fontSize: 15 }}>{'★'.repeat(r.score)}<span style={{ color: 'var(--text2)', fontSize: 12, marginLeft: 4 }}>{r.score}점</span></span>
                      : <span className="badge badge-gray">평가 대기</span>
                    }
                  </div>

                  {shouldShowFinalFeedback(r, comments) && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--accent-light)', borderRadius: 8, fontSize: 13, color: 'var(--accent-text)' }}>
                      <i className="ti ti-message-circle" /> 최종 평가: {r.feedback}
                    </div>
                  )}

                  {(displayComments.length > 0 || needsReply) && (
                    <RecordFeedbackThread
                      record={r}
                      comments={displayComments}
                      replyDraft={replyDrafts[r.id] || ''}
                      replySaving={!!replySaving[r.id]}
                      allowReply={needsReply}
                      onReplyDraftChange={value => setReplyDrafts(prev => ({ ...prev, [r.id]: value }))}
                      onSubmitReply={() => submitReply(r)}
                    />
                  )}

                  {canModify && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '8px 10px' }}
                          onClick={e => { e.stopPropagation(); router.push(`/register?edit=${r.id}`) }}
                        >
                          <i className="ti ti-edit" /> 수정
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '8px 10px' }}
                          onClick={e => { e.stopPropagation(); router.push(`/register?clone=${r.id}`) }}
                        >
                          재등록
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '8px 10px' }}
                          onClick={e => { e.stopPropagation(); openDelete(r) }}
                        >
                          삭제
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, textAlign: 'center' }}>
                        평가 전까지 내용 수정이 가능합니다
                      </div>
                    </div>
                  )}

                  {!canModify && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, textAlign: 'center' }}>
                      평가 완료 후에도 첨부파일 추가·삭제가 가능합니다
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </Layout>
      <ConfirmDeleteModal
        open={!!deleteTarget}
        title={deleteTarget?.task}
        confirming={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmRemoveRecord}
      />
    </>
  )
}
