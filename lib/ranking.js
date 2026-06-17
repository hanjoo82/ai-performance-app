/** 총점 내림차순 정렬 후 동점은 같은 등수, 다음 등수는 건너뜀 (1, 2, 2, 2, 5 …) */
export function withCompetitionRank(sorted, scoreKey = 'total') {
  let prevRank = 1
  return sorted.map((item, i) => {
    const rank =
      i === 0 || item[scoreKey] !== sorted[i - 1][scoreKey] ? i + 1 : prevRank
    prevRank = rank
    return { ...item, rank }
  })
}

export function buildUserRankings(records, users) {
  const map = {}
  users.forEach(u => { map[u.email] = u })

  const scores = {}
  records.forEach(r => {
    if (!scores[r.email]) scores[r.email] = { total: 0, cnt: 0 }
    if (r.score > 0) {
      scores[r.email].total += r.score
      scores[r.email].cnt++
    }
  })

  const sorted = Object.entries(scores)
    .filter(([, s]) => s.cnt > 0)
    .map(([em, s]) => ({
      email: em,
      ...s,
      avg: (s.total / s.cnt).toFixed(1),
      user: map[em] || {},
    }))
    .sort((a, b) => b.total - a.total || parseFloat(b.avg) - parseFloat(a.avg))

  return withCompetitionRank(sorted)
}

export function rankDisplay(rank) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return rank
}

export const RANKING_REAL_NAME_UNTIL = 10

/** 11위 이후는 OOO, 본인은 항상 실명 */
export function displayRankingName(entry, viewerEmail) {
  const isMe = entry.email === viewerEmail
  if (entry.rank <= RANKING_REAL_NAME_UNTIL || isMe) {
    return entry.user.name || entry.email
  }
  return 'OOO'
}

export function showRankingProfile(entry, viewerEmail) {
  return entry.rank <= RANKING_REAL_NAME_UNTIL || entry.email === viewerEmail
}
