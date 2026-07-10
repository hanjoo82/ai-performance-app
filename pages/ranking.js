import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/useAuth'
import { getRecords, getUsers } from '../lib/db'
import { buildUserRankings, displayRankingName, rankDisplay, showRankingProfile } from '../lib/ranking'
import { buildOrgStats } from '../lib/orgStats'
import { shouldShowFinalFeedback } from '../lib/evalStatus'
import RecordAttachments from '../components/RecordAttachments'
import OrgParticipationBoard from '../components/OrgParticipationBoard'
import Layout from '../components/Layout'
import Head from 'next/head'

function recordDate(r) {
  return r.date || (r.created_at ? r.created_at.slice(0, 10) : '')
}

function UserRecordsPanel({ records, personName, viewerEmail }) {
  const sorted = [...records].sort((a, b) => recordDate(b).localeCompare(recordDate(a)))

  if (sorted.length === 0) {
    return (
      <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
        등록된 실적이 없습니다
      </div>
    )
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>
        {personName} · 실적 {sorted.length}건
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map(r => (
          <div
            key={r.id}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{r.task}</div>
              <span className="tool-tag">{r.tool}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>{recordDate(r)}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 11 }}>활용 내용 · </span>
              {r.content}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 11 }}>효과 · </span>
              {r.effect}
            </div>
            <RecordAttachments
              recordId={r.id}
              email={viewerEmail}
              canView
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {(r.score || 0) > 0 ? (
                <>
                  <span style={{ color: '#f0c040', fontSize: 13 }}>{'★'.repeat(r.score)}</span>
                  <span className="badge badge-gold">평가완료</span>
                </>
              ) : (
                <span className="badge badge-gray">평가 대기</span>
              )}
              {shouldShowFinalFeedback(r, []) && (
                <span style={{ fontSize: 12, color: 'var(--accent-text)' }}>최종 평가: {r.feedback}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RankRow({
  entry,
  viewerEmail,
  isAdmin,
  isExpanded,
  onToggle,
  userRecords,
}) {
  const isMe = entry.email === viewerEmail
  const medal = entry.rank <= 3
  const showProfile = showRankingProfile(entry, viewerEmail)
  const adminName = entry.user.name || entry.email
  const clickable = isAdmin && onToggle

  return (
    <div
      style={{
        padding: '14px 16px',
        marginBottom: 10,
        background: isMe ? 'var(--accent-light)' : 'var(--surface)',
        border: isMe ? '1.5px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        cursor: clickable ? 'pointer' : undefined,
      }}
      onClick={clickable ? onToggle : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
            {displayRankingName(entry, viewerEmail)}
            {isMe && <span className="badge badge-green" style={{ marginLeft: 8 }}>나</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {showProfile
              ? `${entry.user.dept} · ${entry.user.team} · ${entry.cnt}건 평가`
              : `${entry.cnt}건 평가`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{entry.total}점</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>평균 {entry.avg}점</div>
          </div>
          {clickable && (
            <i
              className={`ti ${isExpanded ? 'ti-chevron-up' : 'ti-chevron-down'}`}
              style={{ color: 'var(--text3)', fontSize: 18 }}
            />
          )}
        </div>
      </div>

      {isAdmin && isExpanded && (
        <UserRecordsPanel records={userRecords} personName={adminName} viewerEmail={viewerEmail} />
      )}
    </div>
  )
}

export default function Ranking() {
  const { user, email, loading, isCeo } = useAuth()
  const router = useRouter()
  const [ranked, setRanked] = useState([])
  const [records, setRecords] = useState([])
  const [fetching, setFetching] = useState(true)
  const [expandedEmail, setExpandedEmail] = useState(null)
  const [activeTab, setActiveTab] = useState('personal')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user])

  useEffect(() => {
    if (!router.isReady) return
    const tab = router.query.tab
    if (tab === 'org' || tab === 'personal') setActiveTab(tab)
  }, [router.isReady, router.query.tab])

  useEffect(() => {
    if (!email) return
    Promise.all([getRecords(), getUsers()]).then(([recs, users]) => {
      setRecords(recs)
      setRanked(buildUserRankings(recs, users))
      setFetching(false)
    })
  }, [email])

  const orgStats = useMemo(() => buildOrgStats(records), [records])

  function selectTab(tab) {
    setActiveTab(tab)
    router.replace(
      { pathname: '/ranking', query: tab === 'org' ? { tab: 'org' } : {} },
      undefined,
      { shallow: true }
    )
  }

  function toggleExpand(entryEmail) {
    setExpandedEmail(prev => (prev === entryEmail ? null : entryEmail))
  }

  if (loading || !user) return null

  const myEntry = ranked.find(r => r.email === email)
  const recordsByEmail = records.reduce((acc, r) => {
    if (!acc[r.email]) acc[r.email] = []
    acc[r.email].push(r)
    return acc
  }, {})

  return (
    <>
      <Head><title>랭킹 보드 · AI 성과 관리</title></Head>
      <Layout title="랭킹 보드">
        <div className="report-tabs" role="tablist" aria-label="랭킹 메뉴">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'personal'}
            className={`report-tab ${activeTab === 'personal' ? 'active' : ''}`}
            onClick={() => selectTab('personal')}
          >
            개인 랭킹
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'org'}
            className={`report-tab ${activeTab === 'org' ? 'active' : ''}`}
            onClick={() => selectTab('org')}
          >
            팀별랭킹
          </button>
        </div>

        {activeTab === 'personal' && (
          <>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
              대표 평가 점수 기준 전사 순위
              {isCeo && <span style={{ display: 'block', marginTop: 4 }}>항목을 눌러 등록 실적을 확인할 수 있습니다</span>}
            </p>

            {fetching ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>불러오는 중...</div>
            ) : ranked.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>아직 평가된 실적이 없습니다</div>
            ) : (
              <>
                {ranked.map(r => (
                  <RankRow
                    key={r.email}
                    entry={r}
                    viewerEmail={email}
                    isAdmin={isCeo}
                    isExpanded={expandedEmail === r.email}
                    onToggle={() => toggleExpand(r.email)}
                    userRecords={recordsByEmail[r.email] || []}
                  />
                ))}

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
          </>
        )}

        {activeTab === 'org' && (
          <OrgParticipationBoard orgStats={orgStats} loading={fetching} />
        )}
      </Layout>
    </>
  )
}
