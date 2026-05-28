import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/useAuth'
import { getMyRecords, getRecords } from '../lib/db'
import Layout from '../components/Layout'
import Head from 'next/head'

export default function Home() {
  const { user, email, loading, logout, isCeo } = useAuth()
  const router = useRouter()
  const [myRecs, setMyRecs] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user])

  useEffect(() => {
    if (!email) return
    getMyRecords(email).then(setMyRecs)
    getRecords().then(recs => {
      setTotalCount(recs.length)
      setPendingCount(recs.filter(r => !r.score).length)
    })
  }, [email])

  if (loading || !user) return null

  const scored = myRecs.filter(r => r.score > 0)
  const myAvg = scored.length ? (scored.reduce((a, r) => a + r.score, 0) / scored.length).toFixed(1) : '-'

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
        {isCeo && pendingCount > 0 && (
          <div className="alert alert-info" style={{cursor:'pointer'}} onClick={() => router.push('/eval')}>
            <i className="ti ti-bell" />
            평가 대기 실적 <strong>{pendingCount}건</strong> · 평가하러 가기 →
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
                {r.feedback && <span style={{fontSize:12,color:'var(--accent)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.feedback}</span>}
              </div>
            </div>
          ))}
        </div>
      </Layout>
    </>
  )
}
