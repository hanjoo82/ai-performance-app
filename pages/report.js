import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/useAuth'
import { getRecords, getUsers } from '../lib/db'
import Layout from '../components/Layout'
import Head from 'next/head'

const GRADE = s => s >= 20 ? 'S' : s >= 15 ? 'A' : s >= 10 ? 'B' : s >= 5 ? 'C' : 'D'
const GRADE_COLOR = { S: '#0f6e56', A: '#1a6091', B: '#854f0b', C: '#6b6760', D: '#a32d2d' }

const SHEET_INVALID = /[\\\/\?\*\[\]:]/g
function sanitizeSheetName(name, used) {
  let base = (name || '직원').replace(SHEET_INVALID, '_').slice(0, 28)
  let n = base
  let i = 2
  while (used.has(n)) { n = `${base}_${i++}`.slice(0, 31) }
  used.add(n)
  return n
}

function recordDate(r) {
  return r.date || (r.created_at ? r.created_at.slice(0, 10) : '')
}

function resolvePeriod({ mode, year, half, startDate, endDate }) {
  if (mode === 'custom') {
    return { start: startDate || '0000-01-01', end: endDate || '9999-12-31', label: `${startDate || ''}_${endDate || ''}` }
  }
  if (mode === 'half') {
    if (half === 'H1') return { start: `${year}-01-01`, end: `${year}-06-30`, label: `${year}년_상반기` }
    return { start: `${year}-07-01`, end: `${year}-12-31`, label: `${year}년_하반기` }
  }
  return { start: `${year}-01-01`, end: `${year}-12-31`, label: `${year}년` }
}

export default function Report() {
  const { user, loading, isCeo } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [records, setRecords] = useState([])
  const [selUser, setSelUser] = useState('all')
  const [mode, setMode] = useState('year')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [half, setHalf] = useState('H1')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [preview, setPreview] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace('/login')
      else if (!isCeo) router.replace('/')
    }
  }, [loading, user, isCeo])

  useEffect(() => {
    if (!isCeo) return
    Promise.all([getUsers(), getRecords()]).then(([u, r]) => {
      setUsers(u.filter(x => !x.is_ceo))
      setRecords(r)
      setFetching(false)
    })
  }, [isCeo])

  const period = resolvePeriod({ mode, year, half, startDate, endDate })

  function inRange(r) {
    const d = recordDate(r)
    return d >= period.start && d <= period.end
  }

  function buildReport() {
    const targets = selUser === 'all' ? users : users.filter(u => u.email === selUser)
    return targets.map(u => {
      const recs = records.filter(r => r.email === u.email && inRange(r))
      const scored = recs.filter(r => r.score > 0)
      const total = scored.reduce((a, r) => a + r.score, 0)
      const avg = scored.length ? (total / scored.length).toFixed(1) : '-'
      const grade = GRADE(total)
      return { u, recs, scored, total, avg, grade }
    })
  }

  async function downloadExcel() {
    setDownloading(true)
    try {
      const XLSX = await import('xlsx')
      const data = buildReport()
      const wb = XLSX.utils.book_new()
      const used = new Set()

      const headers = ['직원명', '사업부', '팀', '직책', '업무명', 'AI도구', '활용내용', '활용효과', '대표점수', '피드백', '등록일']

      data.forEach(({ u, recs }) => {
        const rows = recs.length === 0
          ? [[u.name, u.dept, u.team, u.role, '(실적 없음)', '', '', '', '', '', '']]
          : recs.map(r => [
              u.name, u.dept, u.team, u.role,
              r.task || '',
              r.tool || '',
              r.content || '',
              r.effect || '',
              r.score ?? 0,
              r.feedback || '',
              recordDate(r),
            ])
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
        ws['!cols'] = [
          { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 },
          { wch: 24 }, { wch: 12 }, { wch: 40 }, { wch: 40 },
          { wch: 10 }, { wch: 30 }, { wch: 12 },
        ]
        XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(u.name, used))
      })

      const summaryHeaders = ['직원명', '사업부', '팀', '직책', '실적건수', '평균점수', '누적점수', '등급']
      const summaryRows = data.map(({ u, recs, scored, total, avg, grade }) => [
        u.name, u.dept, u.team, u.role,
        recs.length,
        scored.length ? Number(avg) : '-',
        total,
        grade,
      ])
      const summary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows])
      summary['!cols'] = [
        { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
      ]
      XLSX.utils.book_append_sheet(wb, summary, sanitizeSheetName('전체 요약', used))

      const who = selUser === 'all'
        ? '전직원'
        : (users.find(u => u.email === selUser)?.name || '직원').replace(SHEET_INVALID, '_')
      const fileName = `AI활용실적_${period.label}_${who}.xlsx`
      XLSX.writeFile(wb, fileName)
    } catch (err) {
      console.error('excel export error:', err)
      alert(`엑셀 다운로드 실패\n${err?.message || err}`)
    } finally {
      setDownloading(false)
    }
  }

  if (loading || !user || !isCeo) return null

  const reportData = buildReport()

  return (
    <>
      <Head><title>인사고과 보고서 · AI 성과 관리</title></Head>
      <Layout title="인사고과 보고서">
        <div className="card">
          <div className="form-group">
            <label>직원 선택</label>
            <select value={selUser} onChange={e => setSelUser(e.target.value)}>
              <option value="all">전 직원</option>
              {users.map(u => <option key={u.email} value={u.email}>{u.name} ({u.team})</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>기간 선택 방식</label>
            <select value={mode} onChange={e => setMode(e.target.value)}>
              <option value="year">연도 전체</option>
              <option value="half">연도 + 반기</option>
              <option value="custom">날짜 직접 입력</option>
            </select>
          </div>

          {mode !== 'custom' && (
            <div className="form-group">
              <label>기준 연도</label>
              <select value={year} onChange={e => setYear(e.target.value)}>
                {['2024','2025','2026','2027'].map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
            </div>
          )}

          {mode === 'half' && (
            <div className="form-group">
              <label>반기</label>
              <select value={half} onChange={e => setHalf(e.target.value)}>
                <option value="H1">상반기 (1~6월)</option>
                <option value="H2">하반기 (7~12월)</option>
              </select>
            </div>
          )}

          {mode === 'custom' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label>시작일</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>종료일</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
          )}

          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
            대상 기간: {period.start} ~ {period.end}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ flex: 1, minWidth: 120 }} onClick={() => setPreview(true)}>
              <i className="ti ti-eye" /> 미리보기
            </button>
            <button className="btn btn-primary" style={{ flex: 1, minWidth: 120 }} onClick={downloadExcel} disabled={downloading || fetching}>
              <i className="ti ti-file-spreadsheet" /> {downloading ? '생성 중...' : '엑셀 다운로드'}
            </button>
            <button className="btn btn-ghost" onClick={() => { setPreview(true); setTimeout(() => window.print(), 400) }}>
              <i className="ti ti-printer" /> 인쇄
            </button>
          </div>
        </div>

        {preview && (
          <div id="printable">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottom: '2px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>AI 활용 성과 인사고과 보고서</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{period.start} ~ {period.end} · 출력일 {new Date().toLocaleDateString('ko-KR')}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'right' }}>
                대표 확인<br /><br />___________
              </div>
            </div>

            {reportData.map(({ u, scored, total, avg, grade }) => (
              <div key={u.email} className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: 'var(--accent-text)', flexShrink: 0 }}>
                      {u.name?.[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{u.dept} · {u.team} · {u.role}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: GRADE_COLOR[grade] }}>{grade}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>종합 등급</div>
                  </div>
                </div>

                <div className="stat-grid" style={{ marginBottom: 14 }}>
                  <div className="stat"><div className="stat-val">{scored.length}</div><div className="stat-label">평가 건수</div></div>
                  <div className="stat"><div className="stat-val">{avg}</div><div className="stat-label">평균 점수</div></div>
                  <div className="stat"><div className="stat-val">{total}</div><div className="stat-label">누적 점수</div></div>
                </div>

                {scored.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)' }}>
                        {['업무명', '도구', '점수', '피드백'].map(h => (
                          <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text3)', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scored.map(r => (
                        <tr key={r.id}>
                          <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{r.task}</td>
                          <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}><span className="tool-tag">{r.tool}</span></td>
                          <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', color: '#f0c040' }}>{'★'.repeat(r.score)} {r.score}점</td>
                          <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>{r.feedback || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </Layout>
    </>
  )
}
