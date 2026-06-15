import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/useAuth'
import {
  addRecordComment,
  getCommentsByRecordIds,
  getDeletedRecords,
  getRecords,
  restoreAllDeletedRecords,
  restoreRecord,
  softDeleteRecord,
  updateRecord,
} from '../lib/db'
import Layout from '../components/Layout'
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

function formatWhen(iso) {
  if (!iso) return '-'
  return iso.slice(0, 16).replace('T', ' ')
}

export default function Eval() {
  const { user, email, loading, isCeo } = useAuth()
  const router = useRouter()
  const [records, setRecords] = useState([])
  const [deletedRecords, setDeletedRecords] = useState([])
  const [tab, setTab] = useState('submitted')
  const [scores, setScores] = useState({})
  const [feedbacks, setFeedbacks] = useState({})
  const [commentsByRecord, setCommentsByRecord] = useState({})
  const [saving, setSaving] = useState({})

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace('/login')
      else if (!isCeo) router.replace('/')
    }
  }, [loading, user, isCeo])

  async function loadEvalData() {
    const [recs, deleted] = await Promise.all([getRecords(), getDeletedRecords()])
    setRecords(recs)
    setDeletedRecords(deleted)
    try {
      const ids = [...recs, ...deleted].map(r => r.id)
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
  }

  useEffect(() => {
    if (!isCeo) return
    loadEvalData()
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

  async function moveToDeleted(rec) {
    if (!confirm(`「${rec.task}」을(를) 삭제 목록으로 이동할까요?\n삭제함 탭에서 확인·복구할 수 있습니다.`)) return
    setSaving(p => ({ ...p, [rec.id]: true }))
    try {
      await softDeleteRecord(rec.id, email)
      const deletedAt = new Date().toISOString()
      const moved = { ...rec, deleted_at: deletedAt, deleted_by: email }
      setRecords(prev => prev.filter(r => r.id !== rec.id))
      setDeletedRecords(prev => [moved, ...prev])
    } catch (err) {
      alert(`삭제 실패\n${err?.message || err}`)
    } finally {
      setSaving(p => ({ ...p, [rec.id]: false }))
    }
  }

  async function handleRestore(rec) {
    if (!confirm(`「${rec.task}」을(를) 복구할까요?`)) return
    setSaving(p => ({ ...p, [rec.id]: true }))
    try {
      await restoreRecord(rec.id)
      const restored = { ...rec, deleted_at: null, deleted_by: null }
      setDeletedRecords(prev => prev.filter(r => r.id !== rec.id))
      setRecords(prev => [restored, ...prev])
      setTab(getEvalStatus(restored, commentsByRecord[rec.id] || []) === 'finalized' ? 'finalized' : 'submitted')
    } catch (err) {
      alert(`복구 실패\n${err?.message || err}`)
    } finally {
      setSaving(p => ({ ...p, [rec.id]: false }))
    }
  }

  async function handleRestoreAll() {
    if (deletedRecords.length === 0) return
    if (!confirm(`삭제함 ${deletedRecords.length}건을 모두 복구할까요?`)) return
    setSaving(p => ({ ...p, __all: true }))
    try {
      const { restored } = await restoreAllDeletedRecords()
      await loadEvalData()
      alert(`${restored}건 복구했습니다.`)
      setTab('finalized')
    } catch (err) {
      alert(`복구 실패\n${err?.message || err}`)
    } finally {
      setSaving(p => ({ ...p, __all: false }))
    }
  }

  if (loading || !user || !isCeo) return null

  const statusGroups = records.reduce((acc, r) => {
    const status = getEvalStatus(r, commentsByRecord[r.id] || [])
    if (!acc[status]) acc[status] = []
    acc[status].push(r)
    return acc
  }, { submitted: [], revision_requested: [], resubmitted: [], finalized: [] })

  const isDeletedTab = tab === 'deleted'
  const shown = isDeletedTab ? deletedRecords : (statusGroups[tab] || [])

  function renderRecordCard(r, { finalizedView, deletedView }) {
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
          {deletedView ? (
            <span className="badge badge-gray">삭제됨 · {formatWhen(r.deleted_at)}</span>
          ) : (
            <span className={`badge ${isFinalized ? 'badge-gold' : 'badge-info'}`}>{STATUS_LABEL[status]}</span>
          )}
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

        {deletedView ? (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            {r.score > 0 && (
              <div style={{ marginBottom: 10 }}>
                <span style={{ color: '#f0c040', fontSize: 18 }}>{'★'.repeat(r.score)}</span>
              </div>
            )}
            {r.deleted_by && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                삭제 처리: {r.deleted_by}
              </div>
            )}
            <button
              className="btn btn-primary btn-block"
              onClick={() => handleRestore(r)}
              disabled={saving[r.id]}
            >
              {saving[r.id] ? '복구 중...' : '복구'}
            </button>
          </div>
        ) : !finalizedView && !isFinalized ? (
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
                      {c.author_role === 'evaluator' ? '평가자' : '등록자'} · {formatWhen(c.created_at)}
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
                    {c.author_role === 'evaluator' ? '평가자' : '등록자'} · {formatWhen(c.created_at)}
                  </div>
                  {c.message}
                </div>
              ))}
            </div>
            <button
              className="btn btn-danger btn-block"
              onClick={() => moveToDeleted(r)}
              disabled={saving[r.id]}
            >
              {saving[r.id] ? '처리 중...' : '삭제'}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Head><title>대표 평가 · AI 성과 관리</title></Head>
      <Layout title="대표 평가">
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            ['submitted', `제출 ${statusGroups.submitted.length}`],
            ['revision_requested', `보완요청 ${statusGroups.revision_requested.length}`],
            ['resubmitted', `재검토요청 ${statusGroups.resubmitted.length}`],
            ['finalized', `완료 ${statusGroups.finalized.length}`],
            ['deleted', `삭제함 ${deletedRecords.length}`],
          ].map(([k, label]) => (
            <button
              key={k}
              className="btn btn-ghost"
              style={{
                flex: '1 1 auto',
                minWidth: 88,
                fontWeight: tab === k ? 700 : 400,
                borderColor: tab === k ? 'var(--accent)' : undefined,
                color: tab === k ? 'var(--accent)' : undefined,
              }}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {isDeletedTab && deletedRecords.length > 0 && (
          <button
            className="btn btn-primary btn-block"
            style={{ marginBottom: 16 }}
            onClick={handleRestoreAll}
            disabled={saving.__all}
          >
            {saving.__all ? '복구 중...' : `전체 복구 (${deletedRecords.length}건)`}
          </button>
        )}

        {shown.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
            {isDeletedTab ? '삭제된 실적이 없습니다' : '해당 상태의 실적이 없습니다'}
          </div>
        )}

        {shown.map(r => renderRecordCard(r, {
          finalizedView: tab === 'finalized' || (r.score || 0) > 0,
          deletedView: isDeletedTab,
        }))}
      </Layout>
    </>
  )
}
