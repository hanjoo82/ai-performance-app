import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/useAuth'
import { getRecords, getUsers } from '../lib/db'
import { buildUserRankings, rankDisplay } from '../lib/ranking'
import Layout from '../components/Layout'
import Head from 'next/head'

function RankRow({ entry, isMe }) {
  const medal = entry.rank <= 3
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        marginBottom: 10,
        background: isMe ? 'var(--accent-light)' : 'var(--surface)',
        border: isMe ? '1.5px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div
        style={{
          fontSize: medal ? 24 : 16,
          width: 32,
          textAlign: 'center',
          fontWeight: 700,
          color: medal ? undefined : 'var(--text3)',
        }}
      >
        {rankDisplay(entry.rank)}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>
          {entry.user.name || entry.email}
          {isMe && <span className="badge badge-green" style={{ marginLeft: 8 }}>나</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
          {entry.user.dept} · {entry.user.team} · {entry.cnt}건 평가
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{entry.total}점</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>평균 {entry.avg}점</div>
      </div>
    </div>
  )
}

export default function Ranking() {
  const { user, email, loading } = useAuth()
  const router = useRouter()
  const [ranked, setRanked] = useState([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user])

  useEffect(() => {
    if (!email) return
    Promise.all([getRecords(), getUsers()]).then(([records, users]) => {
      setRanked(buildUserRankings(records, users))
      setFetching(false)
    })
  }, [email])

  if (loading || !user) return null

  const top5 = ranked.slice(0, 5)
  const top5Emails = new Set(top5.map(r => r.email))
  const myEntry = ranked.find(r => r.email === email)
  const showMyEntrySeparately = myEntry && !top5Emails.has(email)

  return (
    <>
      <Head><title>랭킹 보드 · AI 성과 관리</title></Head>
      <Layout title="랭킹 보드">
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
          대표 평가 점수 기준 전사 순위 · TOP 5
        </p>

        {fetching ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>불러오는 중...</div>
        ) : ranked.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>아직 평가된 실적이 없습니다</div>
        ) : (
          <>
            {top5.map(r => (
              <RankRow key={r.email} entry={r} isMe={r.email === email} />
            ))}

            {showMyEntrySeparately && (
              <>
                <div
                  style={{
                    margin: '18px 0 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text3)',
                    textAlign: 'center',
                  }}
                >
                  ··· 내 순위 ···
                </div>
                <RankRow entry={myEntry} isMe />
              </>
            )}

            {!myEntry && (
              <div
                style={{
                  marginTop: 16,
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--surface2)',
                  fontSize: 13,
                  color: 'var(--text3)',
                  textAlign: 'center',
                }}
              >
                아직 평가 완료된 실적이 없어 순위에 포함되지 않았습니다.
              </div>
            )}
          </>
        )}
      </Layout>
    </>
  )
}
