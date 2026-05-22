import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/useAuth'
import { getRecords, updateRecord } from '../lib/db'
import Layout from '../components/Layout'
import Head from 'next/head'

const PERIODS = [
  { key: 'all', label: '전체' },
  { key: 'month', label: '이번달' },
  { key: '3m', label: '3개월' },
  { key: '6m', label: '6개월' },
  { key: '1y', label: '1년' },
]

function recordDate(r) {
  return r.date || (r.created_at ? r.created_at.slice(0, 10) : '')
}

function periodStart(key) {
  const d = new Date()
  if (key === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
  if (key === '3m') { const x = new Date(d); x.setMonth(x.getMonth() - 3); return x.toISOString().slice(0, 10) }
  if (key === '6m') { const x = new Date(d); x.setMonth(x.getMonth() - 6); return x.toISOString().slice(0, 10) }
  if (key === '1y') { const x = new Date(d); x.setFullYear(x.getFullYear() - 1); return x.toISOString().slice(0, 10) }
  return null
}

export default function List() {
  const { user, email, loading } = useAuth()
  const router = useRouter()
  const [records, setRecords] = useState([])
  const [filter, setFilter] = useState('all')
  const [period, setPeriod] = useState('all')
  const [expanded, setExpanded] = useState(() => new Set())
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user])

  useEffect(() => {
    if (!email) return
    getRecords().then(r => { setRecords(r); setFetching(false) })
  }, [email])

  async function toggleLike(rec) {
    const liked = (rec.liked_by || []).includes(email)
    const newLikedBy = liked ? rec.liked_by.filter(e => e !== email) : [...(rec.liked_by || []), email]
    const newLikes = liked ? Math.max(0, (rec.likes || 0) - 1) : (rec.likes || 0) + 1
    await updateRecord(rec.id, { likes: newLikes, liked_by: newLikedBy })
    setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, likes: newLikes, liked_by: newLikedBy } : r))
  }

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  if (loading || !user) return null

  const start = periodStart(period)
  const scoped = filter === 'mine' ? records.filter(r => r.email === email) : records
  const shown = start ? scoped.filter(r => recordDate(r) >= start) : scoped

  return (
    <>
      <Head><title>실적 조회 · AI 성과 관리</title></Head>
      <Layout title="실적 조회">
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {['all', 'mine'].map(f => (
            <button
              key={f}
              className="btn btn-ghost"
              style={{ flex: 1, fontWeight: filter === f ? 700 : 400, borderColor: filter === f ? 'var(--accent)' : undefined, color: filter === f ? 'var(--accent)' : undefined }}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? '전체 실적' : '내 실적'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              className="btn btn-ghost"
              style={{
                flex: '1 1 auto',
                minWidth: 64,
                padding: '6px 10px',
                fontSize: 13,
                fontWeight: period === p.key ? 700 : 400,
                borderColor: period === p.key ? 'var(--accent)' : undefined,
                color: period === p.key ? 'var(--accent)' : undefined,
                background: period === p.key ? 'var(--accent-light)' : undefined,
              }}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {fetching ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>불러오는 중...</div>
        ) : shown.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
            해당 기간의 실적이 없습니다
          </div>
        ) : shown.map(r => {
          const u = r.users || {}
          const liked = (r.liked_by || []).includes(email)
          const isOpen = expanded.has(r.id)
          return (
            <div
              key={r.id}
              className="card"
              style={{ marginBottom: 12, cursor: 'pointer' }}
              onClick={() => toggleExpand(r.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>
                    {u.name || r.user_name} · {u.team || r.user_team}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.4 }}>{r.task}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span className="tool-tag">{r.tool}</span>
                  <i className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ color: 'var(--text3)' }} />
                </div>
              </div>

              {isOpen && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>{recordDate(r)}</div>

                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 11, marginBottom: 2 }}>활용 내용</div>
                    {r.content}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 11, marginBottom: 2 }}>효과</div>
                    {r.effect}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div>
                      {r.score > 0
                        ? <span style={{ color: '#f0c040', fontSize: 15 }}>{'★'.repeat(r.score)}<span style={{ color: 'var(--text2)', fontSize: 12, marginLeft: 4 }}>{r.score}점</span></span>
                        : <span className="badge badge-gray">평가 대기</span>
                      }
                    </div>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: liked ? '#e74c3c' : 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
                      onClick={e => { e.stopPropagation(); toggleLike(r) }}
                    >
                      <i className="ti ti-heart" style={{ fontSize: 18 }} />
                      {r.likes || 0}
                    </button>
                  </div>

                  {r.feedback && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--accent-light)', borderRadius: 8, fontSize: 13, color: 'var(--accent-text)' }}>
                      <i className="ti ti-message-circle" /> {r.feedback}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </Layout>
    </>
  )
}
