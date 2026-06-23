import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/useAuth'
import { addRecordComment, deleteRecord, getCommentsByRecordIds, getRecords, updateRecord } from '../lib/db'
import Layout from '../components/Layout'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import RecordSummaryHeader from '../components/RecordSummaryHeader'
import RecordAttachments from '../components/RecordAttachments'
import WorkCategorySelect from '../components/WorkCategorySelect'
import { cleanupAttachmentsForRecord } from '../lib/attachments'
import { isWorkCategory } from '../lib/workCategories'
import { EVAL_STATUS_LABEL, filterDisplayComments, getEvalStatus, shouldShowFinalFeedback } from '../lib/evalStatus'
import Head from 'next/head'

const STATUS_LABEL = EVAL_STATUS_LABEL

const EVAL_TAB_ITEMS = [
  { key: 'submitted', lines: ['제출'] },
  { key: 'revision_requested', lines: ['보완요청', '(평가보류)'] },
  { key: 'resubmitted', lines: ['재검토요청'] },
  { key: 'finalized', lines: ['완료'] },
]

const EVAL_TABS = EVAL_TAB_ITEMS.map(t => t.key)

const STATUS_STYLE = {
  submitted: { cls: 'badge-gray', label: '제출' },
  revision_requested: { cls: 'badge-warn', label: STATUS_LABEL.revision_requested },
  resubmitted: { cls: 'badge-info', label: STATUS_LABEL.resubmitted },
  finalized: { cls: 'badge-gold', label: '평가완료' },
}

function recordDate(r) {
  return r.date || (r.created_at ? r.created_at.slice(0, 10) : '')
}

export default function Eval() {
  const { user, email, loading, isCeo } = useAuth()
  const router = useRouter()
  const [records, setRecords] = useState([])
  const [tab, setTab] = useState('submitted')
  const [scores, setScores] = useState({})
  const [feedbacks, setFeedbacks] = useState({})
  const [finalComments, setFinalComments] = useState({})
  const [commentsByRecord, setCommentsByRecord] = useState({})
  const [saving, setSaving] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [expanded, setExpanded] = useState(() => new Set())
  const [workCategories, setWorkCategories] = useState({})

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace('/login')
      else if (!isCeo) router.replace('/')
    }
  }, [loading, user, isCeo])

  useEffect(() => {
    const tabFromQuery = router.query.tab
    if (typeof tabFromQuery === 'string' && EVAL_TABS.includes(tabFromQuery)) {
      setTab(tabFromQuery)
    }
  }, [router.query.tab])

  useEffect(() => {
    setExpanded(new Set())
  }, [tab])

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    if (!isCeo) return
    getRecords().then(async (recs) => {
      setRecords(recs)
      try {
        const ids = recs.map(r => r.id)
        const comments = await getCommentsByRecordIds(ids)
        const grouped = comments.reduce((acc, c) => {
          if (!acc[c.record_id]) acc[c.record_id] = []
          acc[c.record_id].push(c)
          return acc
        }, {})
        setCommentsByRecord(grouped)
      } catch (err) {
        console.warn('record_comments load failed:', err?.message || err)
      }
    })
  }, [isCeo])

  function selectedWorkCategory(rec) {
    return workCategories[rec.id] ?? rec.work_category ?? ''
  }

  function setWorkCategory(rec, value) {
    setWorkCategories(p => ({ ...p, [rec.id]: value }))
  }

  async function saveWorkCategory(rec) {
    const category = selectedWorkCategory(rec)
    if (!category || !isWorkCategory(category)) {
      alert('업무 구분을 선택해주세요')
      return
    }
    setSaving(p => ({ ...p, [rec.id]: true }))
    try {
      await updateRecord(rec.id, { work_category: category })
      setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, work_category: category } : r))
    } catch (err) {
      alert(`업무 구분 저장 실패\n${err?.message || err}`)
    } finally {
      setSaving(p => ({ ...p, [rec.id]: false }))
    }
  }

  async function finalizeEval(rec) {
    const score = scores[rec.id]
    if (!score) { alert('점수를 선택해주세요'); return }
    const category = selectedWorkCategory(rec)
    if (!isWorkCategory(category)) { alert('업무 구분을 선택해주세요'); return }
    const message = (feedbacks[rec.id] || '').trim()
    setSaving(p => ({ ...p, [rec.id]: true }))
    try {
      await updateRecord(rec.id, { score, feedback: message, work_category: category })
      if (message) {
        const created = await addRecordComment({
          record_id: rec.id,
          author_email: email,
          author_name: user?.name || '평가자',
          author_role: 'evaluator',
          message,
        })
        setCommentsByRecord(prev => ({
          ...prev,
          [rec.id]: [...(prev[rec.id] || []), created]
        }))
        setFeedbacks(p => ({ ...p, [rec.id]: '' }))
      }
      setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, score, feedback: message, work_category: category } : r))
      setTab('finalized')
    } catch (err) {
      alert(`최종 평가 저장 실패\n${err?.message || err}`)
    } finally {
      setSaving(p => ({ ...p, [rec.id]: false }))
    }
  }

  async function requestRevision(rec) {
    const message = (feedbacks[rec.id] || '').trim()
    if (!message) { alert('보완 요청 내용을 입력해주세요'); return }
    const category = selectedWorkCategory(rec)
    setSaving(p => ({ ...p, [rec.id]: true }))
    try {
      const created = await addRecordComment({
        record_id: rec.id,
        author_email: email,
        author_name: user?.name || '평가자',
        author_role: 'evaluator',
        message,
      })
      const updates = { feedback: message, score: 0 }
      if (isWorkCategory(category)) updates.work_category = category
      await updateRecord(rec.id, updates)
      setCommentsByRecord(prev => ({
        ...prev,
        [rec.id]: [...(prev[rec.id] || []), created]
      }))
      setRecords(prev => prev.map(r => r.id === rec.id ? {
        ...r,
        feedback: message,
        score: 0,
        work_category: isWorkCategory(category) ? category : r.work_category,
      } : r))
      setFeedbacks(p => ({ ...p, [rec.id]: '' }))
    } catch (err) {
      alert(`보완 요청 저장 실패\n${err?.message || err}`)
    } finally {
      setSaving(p => ({ ...p, [rec.id]: false }))
    }
  }

  async function updateFinalizedScore(rec) {
    const score = scores[r.id] ?? rec.score
    if (!score) { alert('점수를 선택해주세요'); return }
    setSaving(p => ({ ...p, [rec.id]: true }))
    try {
      await updateRecord(rec.id, { score })
      setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, score } : r))
    } catch (err) {
      alert(`점수 변경 실패\n${err?.message || err}`)
    } finally {
      setSaving(p => ({ ...p, [rec.id]: false }))
    }
  }

  async function updateFinalFeedback(rec) {
    const message = (feedbacks[r.id] ?? rec.feedback ?? '').trim()
    setSaving(p => ({ ...p, [rec.id]: true }))
    try {
      await updateRecord(rec.id, { feedback: message })
      setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, feedback: message } : r))
      setFeedbacks(p => ({ ...p, [rec.id]: '' }))
    } catch (err) {
      alert(`최종 평가 수정 실패\n${err?.message || err}`)
    } finally {
      setSaving(p => ({ ...p, [rec.id]: false }))
    }
  }

  async function addFinalizedComment(rec) {
    const message = (finalComments[r.id] || '').trim()
    if (!message) { alert('코멘트를 입력해주세요'); return }
    setSaving(p => ({ ...p, [rec.id]: true }))
    try {
      const created = await addRecordComment({
        record_id: rec.id,
        author_email: email,
        author_name: user?.name || '평가자',
        author_role: 'evaluator',
        message,
      })
      setCommentsByRecord(prev => ({
        ...prev,
        [rec.id]: [...(prev[rec.id] || []), created],
      }))
      setFinalComments(p => ({ ...p, [rec.id]: '' }))
    } catch (err) {
      alert(`코멘트 추가 실패\n${err?.message || err}`)
    } finally {
      setSaving(p => ({ ...p, [rec.id]: false }))
    }
  }

  async function confirmRemoveRecord() {
    const rec = deleteTarget
    if (!rec) return
    setSaving(p => ({ ...p, [rec.id]: true }))
    try {
      await cleanupAttachmentsForRecord(rec.id, email)
      await deleteRecord(rec.id)
      setRecords(prev => prev.filter(r => r.id !== rec.id))
      setCommentsByRecord(prev => {
        const next = { ...prev }
        delete next[rec.id]
        return next
      })
      setDeleteTarget(null)
    } catch (err) {
      alert(`삭제 실패\n${err?.message || err}`)
    } finally {
      setSaving(p => ({ ...p, [rec.id]: false }))
    }
  }

  if (loading || !user || !isCeo) return null

  const statusGroups = records.reduce((acc, r) => {
    const status = getEvalStatus(r, commentsByRecord[r.id] || [])
    if (!acc[status]) acc[status] = []
    acc[status].push(r)
    return acc
  }, { submitted: [], revision_requested: [], resubmitted: [], finalized: [] })
  const shown = statusGroups[tab] || []

  return (
    <>
      <Head><title>대표 평가 · AI 성과 관리</title></Head>
      <Layout title="대표 평가">
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {EVAL_TAB_ITEMS.map(({ key, lines }) => {
            const count = statusGroups[key]?.length ?? 0
            const active = tab === key
            return (
              <button
                key={key}
                type="button"
                className="btn btn-ghost"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '10px 4px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderColor: active ? 'var(--accent)' : undefined,
                  color: active ? 'var(--accent)' : undefined,
                  background: active ? 'var(--accent-light)' : undefined,
                }}
                onClick={() => setTab(key)}
              >
                <span style={{ fontSize: 11, lineHeight: 1.35, textAlign: 'center', fontWeight: active ? 700 : 500 }}>
                  {lines.map((line, i) => (
                    <span key={i} style={{ display: 'block', whiteSpace: 'nowrap' }}>{line}</span>
                  ))}
                </span>
                <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1 }}>{count}</span>
              </button>
            )
          })}
        </div>

        {shown.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
            해당 상태의 실적이 없습니다
          </div>
        )}

        {shown.map(r => {
          const u = r.users || {}
          const comments = commentsByRecord[r.id] || []
          const status = getEvalStatus(r, comments)
          const statusStyle = STATUS_STYLE[status] || STATUS_STYLE.submitted
          const isFinalized = status === 'finalized'
          const isOpen = expanded.has(r.id)
          return (
            <div
              key={r.id}
              className="card"
              style={{ marginBottom: 12, cursor: 'pointer', opacity: saving[r.id] ? 0.6 : 1 }}
              onClick={() => toggleExpand(r.id)}
            >
              <RecordSummaryHeader
                userName={u.name || r.user_name}
                userTeam={u.team || r.user_team}
                task={r.task}
                statusCls={statusStyle.cls}
                statusLabel={statusStyle.label}
                tool={r.tool}
                workCategory={r.work_category}
                score={scores[r.id] ?? r.score}
                showScore={isFinalized}
                isOpen={isOpen}
              />

              {isOpen && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>{recordDate(r)}</div>

                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 11, marginBottom: 2 }}>AI 활용 내용</div>
                    {r.content}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 11, marginBottom: 2 }}>활용 효과</div>
                    {r.effect}
                  </div>

                  <RecordAttachments
                    recordId={r.id}
                    email={email}
                    canView
                  />

              {!isFinalized ? (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  {comments.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                      {comments.map(c => (
                        <div key={c.id} style={{
                          padding: '8px 10px',
                          borderRadius: 10,
                          background: c.author_role === 'evaluator' ? 'var(--accent-light)' : 'var(--surface2)',
                          color: c.author_role === 'evaluator' ? 'var(--accent-text)' : 'var(--text2)',
                          fontSize: 13
                        }}>
                          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 3 }}>
                            {c.author_role === 'evaluator' ? '평가자' : '등록자'} · {(c.created_at || '').slice(0, 16).replace('T', ' ')}
                          </div>
                          {c.message}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>업무 구분</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <WorkCategorySelect
                      value={selectedWorkCategory(r)}
                      onChange={value => setWorkCategory(r, value)}
                      required
                      disabled={saving[r.id]}
                      style={{ flex: 1 }}
                    />
                    {!isFinalized && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                        onClick={() => saveWorkCategory(r)}
                        disabled={saving[r.id] || !isWorkCategory(selectedWorkCategory(r))}
                      >
                        저장
                      </button>
                    )}
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>점수 평가</div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setScores(p => ({ ...p, [r.id]: n }))}
                        style={{
                          flex: 1, padding: '10px 0', border: '1.5px solid',
                          borderColor: (scores[r.id] || 0) >= n ? '#f0c040' : 'var(--border)',
                          borderRadius: 8, background: (scores[r.id] || 0) >= n ? '#fdf6e3' : 'var(--surface)',
                          fontSize: 18, cursor: 'pointer', transition: 'all 0.1s'
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  {scores[r.id] && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, textAlign: 'center' }}>
                      {['', '미흡', '보통', '양호', '우수', '탁월'][scores[r.id]]}
                    </div>
                  )}
                  <textarea
                    placeholder="질문, 보완 요청 또는 최종 코멘트"
                    style={{ minHeight: 64, marginBottom: 10 }}
                    value={feedbacks[r.id] || ''}
                    onChange={e => setFeedbacks(p => ({ ...p, [r.id]: e.target.value }))}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button className="btn btn-ghost" onClick={() => requestRevision(r)} disabled={saving[r.id]}>
                      {saving[r.id] ? '저장 중...' : '보완 요청'}
                    </button>
                    <button className="btn btn-primary" onClick={() => finalizeEval(r)} disabled={saving[r.id]}>
                      {saving[r.id] ? '저장 중...' : '최종 점수 확정'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ color: '#f0c040', fontSize: 18 }}>{'★'.repeat(scores[r.id] ?? r.score)}</span>
                    <span className="badge badge-info">평가 완료</span>
                  </div>

                  {shouldShowFinalFeedback(r, comments) && (
                    <div style={{ marginBottom: 10, padding: '8px 12px', background: 'var(--accent-light)', borderRadius: 10, fontSize: 13, color: 'var(--accent-text)' }}>
                      <i className="ti ti-message-circle" /> 최종 평가: {feedbacks[r.id] ?? r.feedback}
                    </div>
                  )}

                  {filterDisplayComments(r, comments).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                    {filterDisplayComments(r, comments).map(c => (
                      <div key={c.id} style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        background: c.author_role === 'evaluator' ? 'var(--accent-light)' : 'var(--surface2)',
                        color: c.author_role === 'evaluator' ? 'var(--accent-text)' : 'var(--text2)',
                        fontSize: 13
                      }}>
                        <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 3 }}>
                          {c.author_role === 'evaluator' ? '평가자' : '등록자'} · {(c.created_at || '').slice(0, 16).replace('T', ' ')}
                        </div>
                        {c.message}
                      </div>
                    ))}
                  </div>
                  )}

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>평가 수정</div>

                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>업무 구분</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      <WorkCategorySelect
                        value={selectedWorkCategory(r)}
                        onChange={value => setWorkCategory(r, value)}
                        disabled={saving[r.id]}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                        onClick={() => saveWorkCategory(r)}
                        disabled={saving[r.id] || selectedWorkCategory(r) === (r.work_category || '')}
                      >
                        저장
                      </button>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>점수 변경</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      {[1, 2, 3, 4, 5].map(n => {
                        const current = scores[r.id] ?? r.score
                        return (
                          <button
                            key={n}
                            onClick={() => setScores(p => ({ ...p, [r.id]: n }))}
                            style={{
                              flex: 1, padding: '10px 0', border: '1.5px solid',
                              borderColor: current >= n ? '#f0c040' : 'var(--border)',
                              borderRadius: 8, background: current >= n ? '#fdf6e3' : 'var(--surface)',
                              fontSize: 18, cursor: 'pointer', transition: 'all 0.1s'
                            }}
                          >
                            ★
                          </button>
                        )
                      })}
                    </div>
                    <button
                      className="btn btn-ghost btn-block"
                      style={{ marginBottom: 14 }}
                      onClick={() => updateFinalizedScore(r)}
                      disabled={saving[r.id] || (scores[r.id] ?? r.score) === r.score}
                    >
                      {saving[r.id] ? '저장 중...' : '점수 변경 저장'}
                    </button>

                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>최종 평가 수정</div>
                    <textarea
                      placeholder="최종 평가 코멘트"
                      style={{ minHeight: 64, marginBottom: 8 }}
                      value={feedbacks[r.id] ?? r.feedback ?? ''}
                      onChange={e => setFeedbacks(p => ({ ...p, [r.id]: e.target.value }))}
                    />
                    <button
                      className="btn btn-ghost btn-block"
                      style={{ marginBottom: 14 }}
                      onClick={() => updateFinalFeedback(r)}
                      disabled={saving[r.id]}
                    >
                      {saving[r.id] ? '저장 중...' : '최종 평가 저장'}
                    </button>

                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>추가 코멘트</div>
                    <textarea
                      placeholder="추가 코멘트 작성"
                      style={{ minHeight: 64, marginBottom: 8 }}
                      value={finalComments[r.id] || ''}
                      onChange={e => setFinalComments(p => ({ ...p, [r.id]: e.target.value }))}
                    />
                    <button
                      className="btn btn-primary btn-block"
                      onClick={() => addFinalizedComment(r)}
                      disabled={saving[r.id] || !(finalComments[r.id] || '').trim()}
                    >
                      {saving[r.id] ? '저장 중...' : '코멘트 추가'}
                    </button>
                  </div>

                  <button
                    className="btn btn-danger btn-block"
                    onClick={() => setDeleteTarget(r)}
                    disabled={saving[r.id]}
                  >
                    {saving[r.id] ? '삭제 중...' : '삭제'}
                  </button>
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
        confirming={deleteTarget ? !!saving[deleteTarget.id] : false}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmRemoveRecord}
      />
    </>
  )
}
