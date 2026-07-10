export const ORG_DEPTS = ['CCB', 'COB', 'CRB', 'CMS', '인천공항지사', '부산지사']

/**
 * 팀 정원 (수동 관리) = 참여 대상자
 * 육아휴가 등은 제외. name: 공식명 / aliases: 가입·등록 시 자유입력 매칭
 */
export const TEAM_ROSTER = {
  CCB: [
    { name: '관세조사', count: 3, aliases: ['관세조사팀'] },
    { name: '이전가격', count: 3, aliases: ['이전가격팀'] },
    { name: '관세심사', count: 3, aliases: ['관세심사팀'] },
  ],
  COB: [
    { name: '고객지원1팀', count: 3, aliases: ['고객지원 1팀', '고객지원1'] },
    { name: '고객지원2팀', count: 3, aliases: ['고객지원 2팀', '고객지원2'] },
    { name: '케미칼팀', count: 5, aliases: ['케미칼티', '케미칼', '케미컬팀', '케미컬'] },
    { name: 'ICT', count: 10, aliases: ['ICT팀', '아이씨티'] },
    { name: '기계장치1', count: 6, aliases: ['기계장치 1', '기계장치1팀', '기계장치 1팀'] },
    { name: '기계장치2', count: 4, aliases: ['기계장치 2', '기계장치2팀', '기계장치 2팀'] },
    { name: '반도체', count: 6, aliases: ['반도체팀'] },
    { name: '수출', count: 6, aliases: ['수출팀'] },
    { name: '3M&FTA', count: 8, aliases: ['3M & FTA', '3MFTA', '3M/FTA', '3m&fta'] },
    { name: '관세환급', count: 4, aliases: ['관세환급팀', '환급', '환급팀'] },
  ],
  CRB: [
    { name: '고객지원', count: 6, aliases: ['고객지원팀'] },
    { name: '의약품1', count: 10, aliases: ['의약품 1', '의약품1팀', '의약품 1팀', '의약1팀', '의약1'] },
    { name: '의약품2', count: 9, aliases: ['의약품 2', '의약품2팀', '의약품 2팀', '의약2팀', '의약2'] },
    { name: '의료기기1', count: 6, aliases: ['의료기기 1', '의료기기1팀', '의료기기 1팀'] },
    { name: '의료기기2', count: 5, aliases: ['의료기기 2', '의료기기2팀', '의료기기 2팀'] },
    { name: '요건지원', count: 7, aliases: ['요건지원팀'] },
  ],
  CMS: [
    { name: '경영지원팀', count: 6, aliases: ['CMS', '경영지원'] },
  ],
  인천공항지사: [
    { name: '인천공항지사', count: 3, aliases: ['인천공항', '인천공항팀'] },
  ],
  부산지사: [
    { name: '부산지사', count: 5, aliases: ['부산', '부산팀'] },
  ],
}

/** 사업부 정원 = 팀 정원 합계 (육아휴가 제외 참여 대상) */
export const DEPT_HEADCOUNT = Object.fromEntries(
  ORG_DEPTS.map((dept) => [
    dept,
    (TEAM_ROSTER[dept] || []).reduce((sum, row) => sum + row.count, 0),
  ])
)

export const TOTAL_HEADCOUNT = ORG_DEPTS.reduce(
  (sum, dept) => sum + (DEPT_HEADCOUNT[dept] || 0),
  0
)

function normalizeTeamKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[＆&／/·._-]/g, '')
}

/** dept + 자유입력 팀명 → 공식 팀명 (없으면 원문 trim) */
export function resolveCanonicalTeam(dept, teamName) {
  const raw = (teamName || '').trim()
  if (!raw) return '미지정'
  const roster = TEAM_ROSTER[dept] || []
  const key = normalizeTeamKey(raw)
  for (const row of roster) {
    const candidates = [row.name, ...(row.aliases || [])]
    if (candidates.some((c) => normalizeTeamKey(c) === key)) {
      return row.name
    }
  }
  return raw
}

export function getTeamHeadcount(dept, teamName) {
  const roster = TEAM_ROSTER[dept] || []
  const canonical = resolveCanonicalTeam(dept, teamName)
  const found = roster.find((r) => r.name === canonical)
  return found ? found.count : null
}

/** 등록 시점 스냅샷 우선, 없으면 현재 사용자 프로필 */
export function resolveRecordDept(record) {
  return (record.user_dept || record.users?.dept || '').trim()
}

export function resolveRecordTeam(record) {
  return (record.user_team || record.users?.team || '').trim()
}

export function recordDate(record) {
  return record.date || (record.created_at ? record.created_at.slice(0, 10) : '')
}

export function resolvePeriod({ mode, year, half, startDate, endDate }) {
  if (mode === 'custom') {
    return {
      start: startDate || '0000-01-01',
      end: endDate || '9999-12-31',
      label: `${startDate || ''}_${endDate || ''}`,
    }
  }
  if (mode === 'half') {
    if (half === 'H1') {
      return { start: `${year}-01-01`, end: `${year}-06-30`, label: `${year}년_상반기` }
    }
    return { start: `${year}-07-01`, end: `${year}-12-31`, label: `${year}년_하반기` }
  }
  return { start: `${year}-01-01`, end: `${year}-12-31`, label: `${year}년` }
}

export function filterRecordsInPeriod(records, period) {
  return (records || []).filter((r) => {
    const d = recordDate(r)
    return d >= period.start && d <= period.end
  })
}

function emptyBucket() {
  return { recordCount: 0, people: new Map() }
}

function participationRate(registrantCount, headcount) {
  if (!headcount || headcount <= 0) return null
  return Math.round((registrantCount / headcount) * 1000) / 10
}

function addPerson(bucket, email, name) {
  if (!email) return
  const existing = bucket.people.get(email)
  if (existing) {
    existing.recordCount += 1
    if (name && !existing.name) existing.name = name
    return
  }
  bucket.people.set(email, {
    email,
    name: name || email,
    recordCount: 1,
  })
}

function peopleList(bucket) {
  return [...bucket.people.values()].sort((a, b) => {
    if (b.recordCount !== a.recordCount) return b.recordCount - a.recordCount
    return (a.name || '').localeCompare(b.name || '', 'ko')
  })
}

function finalizeDeptBucket(dept, bucket) {
  const registrants = peopleList(bucket)
  const registrantCount = registrants.length
  const headcount = DEPT_HEADCOUNT[dept] ?? null
  return {
    recordCount: bucket.recordCount,
    registrantCount,
    headcount,
    participationRate: participationRate(registrantCount, headcount),
    registrants,
  }
}

function finalizeTeamBucket(dept, team, bucket) {
  const registrants = peopleList(bucket)
  const registrantCount = registrants.length
  const headcount = getTeamHeadcount(dept, team)
  return {
    recordCount: bucket.recordCount,
    registrantCount,
    headcount,
    participationRate: participationRate(registrantCount, headcount),
    registrants,
  }
}

function compareByParticipation(a, b) {
  const ra = a.participationRate
  const rb = b.participationRate
  const aHas = ra !== null && ra !== undefined
  const bHas = rb !== null && rb !== undefined
  if (aHas && bHas && ra !== rb) return rb - ra
  if (aHas !== bHas) return aHas ? -1 : 1
  if (a.registrantCount !== b.registrantCount) return b.registrantCount - a.registrantCount
  if (a.recordCount !== b.recordCount) return b.recordCount - a.recordCount
  if (a.dept !== b.dept) return a.dept.localeCompare(b.dept, 'ko')
  if (a.team && b.team) return a.team.localeCompare(b.team, 'ko')
  return 0
}

/**
 * 실적 기준 사업부/팀 집계.
 * - period 생략 시 전체 누적
 * - 건수·등록인원: 레코드 스냅샷(dept/team)
 * - 정원·참여율: DEPT_HEADCOUNT / TEAM_ROSTER
 */
export function buildOrgStats(records, period = null) {
  const scoped = period ? filterRecordsInPeriod(records, period) : (records || [])

  const deptMap = new Map()
  const teamMap = new Map()

  function ensureDept(dept) {
    const key = dept || '미지정'
    if (!deptMap.has(key)) deptMap.set(key, emptyBucket())
    return deptMap.get(key)
  }

  function ensureTeam(dept, team) {
    const d = dept || '미지정'
    const t = team || '미지정'
    const key = `${d}::${t}`
    if (!teamMap.has(key)) {
      teamMap.set(key, { dept: d, team: t, ...emptyBucket() })
    }
    return teamMap.get(key)
  }

  // 공식 팀·사업부는 실적 0이어도 표시
  for (const dept of ORG_DEPTS) {
    ensureDept(dept)
    for (const row of TEAM_ROSTER[dept] || []) {
      ensureTeam(dept, row.name)
    }
  }

  for (const r of scoped) {
    const dept = resolveRecordDept(r) || '미지정'
    const rawTeam = resolveRecordTeam(r)
    const team = resolveCanonicalTeam(dept, rawTeam)
    const email = (r.email || '').trim().toLowerCase()
    const name = (r.user_name || r.users?.name || '').trim()

    const dBucket = ensureDept(dept)
    dBucket.recordCount += 1
    addPerson(dBucket, email, name)

    const tBucket = ensureTeam(dept, team)
    tBucket.recordCount += 1
    addPerson(tBucket, email, name)
  }

  const totalPeople = new Map()
  for (const r of scoped) {
    const email = (r.email || '').trim().toLowerCase()
    if (!email) continue
    const name = (r.user_name || r.users?.name || '').trim()
    const existing = totalPeople.get(email)
    if (existing) {
      existing.recordCount += 1
      if (name && !existing.name) existing.name = name
    } else {
      totalPeople.set(email, { email, name: name || email, recordCount: 1 })
    }
  }

  const deptKeys = [
    ...ORG_DEPTS,
    ...[...deptMap.keys()]
      .filter((d) => !ORG_DEPTS.includes(d))
      .sort((a, b) => a.localeCompare(b, 'ko')),
  ]

  const depts = deptKeys
    .map((dept) => ({
      dept,
      ...finalizeDeptBucket(dept, deptMap.get(dept)),
    }))
    .sort(compareByParticipation)

  const teams = [...teamMap.values()]
    .map((b) => ({
      dept: b.dept,
      team: b.team,
      ...finalizeTeamBucket(b.dept, b.team, b),
    }))
    .sort(compareByParticipation)

  const totals = {
    recordCount: scoped.length,
    registrantCount: totalPeople.size,
    headcount: TOTAL_HEADCOUNT,
    participationRate: participationRate(totalPeople.size, TOTAL_HEADCOUNT),
  }

  return { depts, teams, totals, periodRecordCount: scoped.length }
}
