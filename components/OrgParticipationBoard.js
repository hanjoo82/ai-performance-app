import { useMemo, useState } from 'react'

function formatRate(rate) {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) return '—'
  return `${Number(rate)}%`
}

function progressWidth(rate) {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) return 0
  return Math.max(0, Math.min(100, Number(rate)))
}

function rankMark(rank) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return String(rank)
}

function formatStaffLine(registrantCount, headcount, recordCount) {
  const target = headcount != null ? `${headcount}명` : '—'
  return `등록 ${registrantCount}명 / 대상 ${target} · ${recordCount}건`
}

function teamKey(t) {
  return `${t.dept}::${t.team}`
}

/**
 * 팀별랭킹 보드 (전 직원용)
 */
export default function OrgParticipationBoard({ orgStats, loading = false }) {
  const [deptFilter, setDeptFilter] = useState('all')
  const [expandedTeam, setExpandedTeam] = useState(null)

  const shownTeams = useMemo(() => {
    if (!orgStats?.teams) return []
    if (deptFilter === 'all') return orgStats.teams
    return orgStats.teams.filter((t) => t.dept === deptFilter)
  }, [orgStats?.teams, deptFilter])

  function toggleTeam(t) {
    const key = teamKey(t)
    setExpandedTeam((prev) => (prev === key ? null : key))
  }

  if (loading || !orgStats) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
        불러오는 중...
      </div>
    )
  }

  const { depts, totals } = orgStats

  return (
    <div className="org-board">
      <div className="stat-grid org-stats-summary">
        <div className="stat">
          <div className="stat-val">{totals.headcount ?? '—'}</div>
          <div className="stat-label">전사 참여대상인원수</div>
        </div>
        <div className="stat">
          <div className="stat-val">{totals.registrantCount}</div>
          <div className="stat-label">등록인원수</div>
        </div>
        <div className="stat">
          <div className="stat-val">{formatRate(totals.participationRate)}</div>
          <div className="stat-label">전사 참여율</div>
        </div>
      </div>

      <div className="org-section-title">사업부 순위</div>
      <div className="org-dept-grid">
        {depts.map((d, idx) => (
          <button
            key={d.dept}
            type="button"
            className={`org-dept-card ${deptFilter === d.dept ? 'active' : ''}`}
            onClick={() => {
              setDeptFilter((prev) => (prev === d.dept ? 'all' : d.dept))
              setExpandedTeam(null)
            }}
          >
            <div className="org-dept-rank-row">
              <span className={`org-rank-badge ${idx < 3 ? 'top' : ''}`}>{rankMark(idx + 1)}</span>
              <div className="org-dept-name">{d.dept}</div>
            </div>
            <div className="org-dept-rate">{formatRate(d.participationRate)}</div>
            <div className="org-progress">
              <div
                className="org-progress-bar"
                style={{ width: `${progressWidth(d.participationRate)}%` }}
              />
            </div>
            <div className="org-dept-sub">
              {formatStaffLine(d.registrantCount, d.headcount, d.recordCount)}
            </div>
          </button>
        ))}
      </div>

      <div className="org-section-title-row">
        <div className="org-section-title" style={{ marginBottom: 0 }}>
          팀 순위
          <span className="org-section-hint">참여율 높은 순</span>
          {deptFilter !== 'all' && (
            <span className="org-section-hint">· {deptFilter}</span>
          )}
        </div>
        {deptFilter !== 'all' && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '6px 10px', fontSize: 12 }}
            onClick={() => setDeptFilter('all')}
          >
            전체 보기
          </button>
        )}
      </div>

      {shownTeams.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          표시할 팀이 없습니다
        </div>
      ) : (
        <div className="org-team-list">
          {shownTeams.map((t, idx) => {
            const key = teamKey(t)
            const open = expandedTeam === key
            const registrants = t.registrants || []
            return (
              <div key={key} className={`org-team-card ${idx < 3 ? 'top' : ''} ${open ? 'open' : ''}`}>
                <button
                  type="button"
                  className="org-team-row"
                  onClick={() => toggleTeam(t)}
                  aria-expanded={open}
                >
                  <div className={`org-rank-badge ${idx < 3 ? 'top' : ''}`}>{rankMark(idx + 1)}</div>
                  <div className="org-team-main">
                    <div className="org-team-name">{t.team}</div>
                    <div className="org-team-dept">{t.dept}</div>
                    <div className="org-progress">
                      <div
                        className="org-progress-bar"
                        style={{ width: `${progressWidth(t.participationRate)}%` }}
                      />
                    </div>
                  </div>
                  <div className="org-team-side">
                    <div className="org-team-rate">{formatRate(t.participationRate)}</div>
                    <div className="org-team-meta">
                      {formatStaffLine(t.registrantCount, t.headcount, t.recordCount)}
                    </div>
                  </div>
                  <i
                    className={`ti ${open ? 'ti-chevron-up' : 'ti-chevron-down'} org-team-chevron`}
                    aria-hidden
                  />
                </button>

                {open && (
                  <div className="org-registrants">
                    <div className="org-registrants-title">
                      참여자 명단
                      <span>{registrants.length}명</span>
                    </div>
                    {registrants.length === 0 ? (
                      <div className="org-registrants-empty">아직 등록한 참여자가 없습니다</div>
                    ) : (
                      <ul className="org-registrants-list">
                        {registrants.map((p) => (
                          <li key={p.email}>
                            <span className="org-registrant-name">{p.name || p.email}</span>
                            <span className="org-registrant-count">{p.recordCount}건</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="org-board-footnote">
        등록인원: 실적을 1건 이상 등록한 사람 수 · 참여 대상: 육아휴가 제외 정원 · 참여율 = 등록인원 ÷ 참여 대상
      </div>
    </div>
  )
}
