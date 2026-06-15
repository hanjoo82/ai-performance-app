import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/useAuth'
import { addRecordComment, deleteRecord, getCommentsByRecordIds, getRecords, updateRecord } from '../lib/db'
import Layout from '../components/Layout'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import Head from 'next/head'

function getEvalStatus(record, comments) {
  if ((record.score || 0) > 0) return 'finalized'
  if (!comments || comments.length === 0) return 'submitted'
  const last = comments[comments.length - 1]
  return last.author_role === 'evaluator' ? 'revision_requested' : 'resubmitted'
}

const STATUS_LABEL = {
  submitted: '제출',
  revision_requested: '보완요청',
  resubmitted: '재검토요청',
  finalized: '평가완료',
}

export default function Eval() {
  const { user, email, loading, isCeo } = useAuth()
  const router = useRouter()
  const [records, setRecords] = useState([])
  const [tab, setTab] = useState('submitted')
  const [scores, setScores] = useState({})
  const [feedbacks, setFeedbacks] = useState({})
  const [commentsByRecord, setCommentsByRecord] = useState({})
  const [saving, setSaving] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace('/login')
      else if (!isCeo) router.replace('/')
    }
  }, [loading, user, isCeo])

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

  async function finalizeEval(rec) {
    const score = scores[rec.id]
    if (!score) { alert('점수를 선택해주세요'); return }
    const message = (feedbacks[rec.id] || '').trim()
    setSaving(p => ({ ...p, [rec.id]: true }))
    try {
      await updateRecord(rec.id, { score, feedback: message })
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
      setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, score, feedback: message } : r))
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
    setSaving(p => ({ ...p, [rec.id]: true }))
    try {
      const created = await addRecordComment({
        record_id: rec.id,
        author_email: email,
        author_name: user?.name || '평가자',
        author_role: 'evaluator',
        message,
      })
      await updateRecord(rec.id, { feedback: message, score: 0 })
      setCommentsByRecord(prev => ({
        ...prev,
        [rec.id]: [...(prev[rec.id] || []), created]
      }))
      setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, feedback: message, score: 0 } : r))
      setFeedbacks(p => ({ ...p, [rec.id]: '' }))
    } catch (err) {
      alert(`보완 요청 저장 실패\n${err?.message || err}`)
    } finally {
      setSaving(p => ({ ...p, [rec.id]: false }))
    }
  }

  async function confirmRemoveRecord() {
    const rec = deleteTarget
    if (!rec) return
    setSaving(p => ({ ...p, [rec.id]: true }))
    try {
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
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            ['submitted', `제출 ${statusGroups.submitted.length}`],
            ['revision_requested', `보완요청 ${statusGroups.revision_requested.length}`],
            ['resubmitted', `재검토요청 ${statusGroups.resubmitted.length}`],
            ['finalized', `완료 ${statusGroups.finalized.length}`],
          ].map(([k, label]) => (
            <button
              key={k}
              className="btn btn-ghost"
              style={{ flex: 1, fontWeight: tab === k ? 700 : 400, borderColor: tab === k ? 'var(--accent)' : undefined, color: tab === k ? 'var(--accent)' : undefined }}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
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
          const isFinalized = status === 'finalized'
          return (
            <div key={r.id} className="card" style={{ marginBottom: 14, opacity: saving[r.id] ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{r.task}</div>
                <span className="tool-tag">{r.tool}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
                {u.name || r.user_name} · {u.team || r.user_team} · {r.date}
              </div>
              <div style={{ marginBottom: 12 }}>
                <span className={`badge ${isFinalized ? 'badge-gold' : 'badge-info'}`}>{STATUS_LABEL[status]}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>AI 활용 내용</div>
                  <div style={{ fontSize: 13 }}>{r.content}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>활용 효과</div>
                  <div style={{ fontSize: 13 }}>{r.effect}</div>
                </div>
              </div>

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
                    <span style={{ color: '#f0c040', fontSize: 18 }}>{'★'.repeat(r.score)}</span>
                    <span className="badge badge-info">평가 완료</span>
                  </div>

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
