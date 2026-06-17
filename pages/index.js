import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/useAuth'
import { addRecordComment, getCommentsByRecordIds, getMyRecords, getRecords } from '../lib/db'
import { canSubmitterReply, countRecordsByEvalStatus } from '../lib/evalStatus'
import RecordFeedbackThread from '../components/RecordFeedbackThread'
import Layout from '../components/Layout'
import Head from 'next/head'

export default function Home() {
  const { user, email, loading, logout, isCeo } = useAuth()
  const router = useRouter()
  const [myRecs, setMyRecs] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [evalCounts, setEvalCounts] = useState({ submitted: 0, revision_requested: 0, resubmitted: 0 })
  const [commentsByRecord, setCommentsByRecord] = useState({})
  const [replyDrafts, setReplyDrafts] = useState({})
  const [replySaving, setReplySaving] = useState({})

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user])

  useEffect(() => {
    if (!email) return
    getMyRecords(email).then(async (my) => {
      setMyRecs(my)
      try {
        const comments = await getCommentsByRecordIds(my.map(r => r.id))
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
    getRecords().then(async (recs) => {
      setTotalCount(recs.length)
      try {
        const pending = recs.filter(r => !r.score)
        const comments = await getCommentsByRecordIds(pending.map(r => r.id))
        const grouped = comments.reduce((acc, c) => {
          if (!acc[c.record_id]) acc[c.record_id] = []
          acc[c.record_id].push(c)
          return acc
        }, {})
        const counts = countRecordsByEvalStatus(pending, grouped)
        setEvalCounts({
          submitted: counts.submitted,
          revision_requested: counts.revision_requested,
          resubmitted: counts.resubmitted,
        })
      } catch (err) {
        console.warn('eval counts load failed:', err?.message || err)
        setEvalCounts({
          submitted: recs.filter(r => !r.score).length,
          revision_requested: 0,
          resubmitted: 0,
        })
      }
    })
  }, [email])

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

  if (loading || !user) return null

  const scored = myRecs.filter(r => r.score > 0)
  const myAvg = scored.length ? (scored.reduce((a, r) => a + r.score, 0) / scored.length).toFixed(1) : '-'

  const pendingReplyCount = myRecs.filter(r =>
    canSubmitterReply(r, commentsByRecord[r.id] || [])
  ).length

  return (
    <>
      <Head><title>홈 · AI 성과 관리</title></Head>
      <Layout
        title="AI 성과 관리"
        rightAction={
          <button className="btn btn-ghost" style={{padding:'6px 12px',fontSize:'13px'}} onClick={logout}>
            로그아웃
          </button>
        }
      >
        {/* 인사말 */}
        <div className="card" style={{background:'var(--accent)',border:'none',marginBottom:16}}>
          <div style={{color:'rgba(255,255,255,0.75)',fontSize:13}}>안녕하세요</div>
          <div style={{color:'#fff',fontSize:18,fontWeight:700,marginTop:2}}>{user.name}님 <span style={{fontSize:16}}>👋</span></div>
          <div style={{color:'rgba(255,255,255,0.7)',fontSize:12,marginTop:4}}>{user.dept} · {user.team} · {user.role}</div>
        </div>

        {/* 내 현황 */}
        <div className="stat-grid">
          <div className="stat">
            <div className="stat-val">{myRecs.length}</div>
            <div className="stat-label">내 실적</div>
          </div>
          <div className="stat">
            <div className="stat-val">{myAvg}</div>
            <div className="stat-label">평균 점수</div>
          </div>
          <div className="stat">
            <div className="stat-val">{totalCount}</div>
            <div className="stat-label">전사 실적</div>
          </div>
        </div>

        {/* 대표 알림 */}
        {isCeo && (evalCounts.submitted > 0 || evalCounts.revision_requested > 0 || evalCounts.resubmitted > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {evalCounts.submitted > 0 && (
              <div className="alert alert-info" style={{ cursor: 'pointer', marginBottom: 0 }} onClick={() => router.push('/eval?tab=submitted')}>
                <i className="ti ti-bell" />
                평가 대기 <strong>{evalCounts.submitted}건</strong> · 평가하러 가기 →
              </div>
            )}
            {evalCounts.revision_requested > 0 && (
              <div className="alert alert-info" style={{ cursor: 'pointer', marginBottom: 0, background: 'var(--gold-light)', color: 'var(--gold-text)' }} onClick={() => router.push('/eval?tab=revision_requested')}>
                <i className="ti ti-message-circle" />
                보완 요청 <strong>{evalCounts.revision_requested}건</strong> · 확인하기 →
              </div>
            )}
            {evalCounts.resubmitted > 0 && (
              <div className="alert alert-info" style={{ cursor: 'pointer', marginBottom: 0 }} onClick={() => router.push('/eval?tab=resubmitted')}>
                <i className="ti ti-refresh" />
                재검토요청 <strong>{evalCounts.resubmitted}건</strong> · 평가하러 가기 →
              </div>
            )}
          </div>
        )}

        {!isCeo && pendingReplyCount > 0 && (
          <div className="alert alert-info" style={{ cursor: 'pointer', marginBottom: 16, background: 'var(--gold-light)', color: 'var(--gold-text)' }} onClick={() => router.push('/list?filter=mine')}>
            <i className="ti ti-message-circle" />
            보완 요청 답변 대기 <strong>{pendingReplyCount}건</strong> · 실적 조회에서 답변하기 →
          </div>
        )}

        {/* 빠른 메뉴 */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
          <button className="card" style={{border:'1.5px solid var(--accent-light)',cursor:'pointer',textAlign:'left'}} onClick={() => router.push('/register')}>
            <i className="ti ti-plus" style={{fontSize:22,color:'var(--accent)',marginBottom:6,display:'block'}} />
            <div style={{fontWeight:600,fontSize:14}}>실적 등록</div>
            <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>AI 활용 내용 기록</div>
          </button>
          <button className="card" style={{cursor:'pointer',textAlign:'left'}} onClick={() => router.push('/ranking')}>
            <i className="ti ti-trophy" style={{fontSize:22,color:'#f0c040',marginBottom:6,display:'block'}} />
            <div style={{fontWeight:600,fontSize:14}}>랭킹 보드</div>
            <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>전사 순위 확인</div>
          </button>
        </div>

        {/* 최근 나의 실적 */}
        <div className="card">
          <div style={{fontWeight:600,fontSize:13,color:'var(--text2)',marginBottom:12}}>최근 나의 실적</div>
          {myRecs.length === 0 ? (
            <div style={{textAlign:'center',padding:'20px 0',color:'var(--text3)',fontSize:13}}>
              아직 등록된 실적이 없어요<br />
              <span style={{color:'var(--accent)',cursor:'pointer'}} onClick={() => router.push('/register')}>첫 실적을 등록해보세요 →</span>
            </div>
          ) : myRecs.slice(0, 3).map(r => (
            <div key={r.id} style={{padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                <div style={{fontWeight:600,fontSize:14,flex:1}}>{r.task}</div>
                <span className="tool-tag">{r.tool}</span>
              </div>
              <div style={{marginTop:4,display:'flex',alignItems:'center',gap:8}}>
                {r.score > 0
                  ? <span style={{color:'#f0c040',fontSize:13}}>{'★'.repeat(r.score)}</span>
                  : <span className="badge badge-gray">평가 대기</span>
                }
                {r.score > 0 && r.feedback && <span style={{fontSize:12,color:'var(--accent)',flex:1,whiteSpace:'normal',wordBreak:'break-word'}}>최종 평가: {r.feedback}</span>}
              </div>

              {(commentsByRecord[r.id] || []).length > 0 || canSubmitterReply(r, commentsByRecord[r.id] || []) ? (
                <RecordFeedbackThread
                  record={r}
                  comments={commentsByRecord[r.id] || []}
                  replyDraft={replyDrafts[r.id] || ''}
                  replySaving={!!replySaving[r.id]}
                  onReplyDraftChange={value => setReplyDrafts(prev => ({ ...prev, [r.id]: value }))}
                  onSubmitReply={() => submitReply(r)}
                  compact
                />
              ) : null}
            </div>
          ))}
        </div>
      </Layout>
    </>
  )
}
