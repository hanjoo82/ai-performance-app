import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/useAuth'
import { addRecordComment, deleteRecord, getCommentsByRecordIds, getRecords, updateRecord } from '../lib/db'
import { filterDisplayComments, getEvalStatus, shouldShowFinalFeedback } from '../lib/evalStatus'
import Layout from '../components/Layout'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import RecordSummaryHeader from '../components/RecordSummaryHeader'
import RecordFeedbackThread from '../components/RecordFeedbackThread'
import RecordAttachmentManager from '../components/RecordAttachmentManager'
import { cleanupAttachmentsForRecord } from '../lib/attachments'
import Head from 'next/head'

function recordDate(r) {
  return r.date || (r.created_at ? r.created_at.slice(0, 10) : '')
}

const DEPTS = ['CCB', 'COB', 'CRB', 'CMS']
const WORK_AREAS = ['수입', '수출', '요건', '환급', 'FTA', '경영지원', '자문', '프로젝트']
const AUTOMATION_AREAS = ['기타', '엑셀자동화', '문서(PPT,Word)자동화', 'PDF 파싱', '메일작성자동화', 'API연동', '앱개발', '영문문서작성', '파일명변경자동화']

function resolveWorkArea(record) {
  return record.work_area || ''
}

function resolveAutomationArea(record) {
  return AUTOMATION_AREAS.includes(record.automation_area) ? record.automation_area : '기타'
}

function classificationLabel(record) {
  const workArea = resolveWorkArea(record)
  const automationArea = resolveAutomationArea(record)
  return workArea ? `${workArea} · ${automationArea}` : automationArea
}

/** 등록 시점 스냅샷 우선, 없으면 현재 사용자 프로필 */
function resolveRecordDept(record) {
  return (record.user_dept || record.users?.dept || '').trim()
}

function resolveRecordTeam(record) {
  return (record.user_team || record.users?.team || '').trim()
}

function resolveRecordName(record) {
  return (record.user_name || record.users?.name || '').trim()
}

const STATUS_STYLE = {
  submitted: { cls: 'badge-gray', label: '평가 대기' },
  revision_requested: { cls: 'badge-warn', label: '보완 요청(평가 보류)' },
  resubmitted: { cls: 'badge-info', label: '재검토 요청' },
  finalized: { cls: 'badge-gold', label: '평가완료' },
}

export default function List() {
  const { user, email, loading, isCeo } = useAuth()
  const router = useRouter()
  const [records, setRecords] = useState([])
  const [filter, setFilter] = useState('all')
  const [dept, setDept] = useState('all')
  const [team, setTeam] = useState('all')
  const [selectedName, setSelectedName] = useState('')
  const [nameQuery, setNameQuery] = useState('')
  const [nameOpen, setNameOpen] = useState(false)
  const [workArea, setWorkArea] = useState('all')
  const [automationArea, setAutomationArea] = useState('all')
  const [expanded, setExpanded] = useState(() => new Set())
  const [fetching, setFetching] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [commentsByRecord, setCommentsByRecord] = useState({})
  const [replyDrafts, setReplyDrafts] = useState({})
  const [replySaving, setReplySaving] = useState({})
  const nameSearchRef = useRef(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user])

  useEffect(() => {
    if (router.query.filter === 'mine') setFilter('mine')
  }, [router.query.filter])

  useEffect(() => {
    if (router.query.filter !== 'mine' || fetching || !email) return
    const needReplyIds = records
      .filter(r => r.email === email && getEvalStatus(r, commentsByRecord[r.id] || []) === 'revision_requested')
      .map(r => r.id)
    if (needReplyIds.length === 0) return
    setExpanded(prev => new Set([...prev, ...needReplyIds]))
  }, [router.query.filter, fetching, records, commentsByRecord, email])

  useEffect(() => {
    if (!email) return
    getRecords().then(async (r) => {
      setRecords(r)
      try {
        const comments = await getCommentsByRecordIds(r.map(rec => rec.id))
        const grouped = comments.reduce((acc, c) => {
          if (!acc[c.record_id]) acc[c.record_id] = []
          acc[c.record_id].push(c)
          return acc
        }, {})
        setCommentsByRecord(grouped)
      } catch (err) {
        console.warn('record_comments load failed:', err?.message || err)
      }
      setFetching(false)
    }).catch((err) => {
      console.error('records load failed:', err)
      alert(`실적을 불러오지 못했습니다.\n${err?.message || err}`)
      setFetching(false)
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

  function openDelete(rec) {
    if (rec.email === email && (rec.score || 0) > 0) {
      alert('평가 완료된 실적은 삭제할 수 없습니다.')
      return
    }
    setDeleteTarget(rec)
  }

  async function confirmRemoveRecord() {
    const rec = deleteTarget
    if (!rec) return
    setDeleting(true)
    try {
      await cleanupAttachmentsForRecord(rec.id, email)
      await deleteRecord(rec.id)
      setRecords(prev => prev.filter(r => r.id !== rec.id))
      setDeleteTarget(null)
    } catch (err) {
      alert(`삭제 실패\n${err?.message || err}`)
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (nameSearchRef.current && !nameSearchRef.current.contains(e.target)) {
        setNameOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const scoped = useMemo(
    () => (filter === 'mine' ? records.filter(r => r.email === email) : records),
    [records, filter, email]
  )

  const teamOptions = useMemo(() => {
    const set = new Set()
    scoped.forEach(r => {
      if (dept !== 'all' && resolveRecordDept(r) !== dept) return
      const t = resolveRecordTeam(r)
      if (t) set.add(t)
    })
    return [...set].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [scoped, dept])

  const nameOptions = useMemo(() => {
    const set = new Set()
    scoped.forEach(r => {
      if (dept !== 'all' && resolveRecordDept(r) !== dept) return
      if (team !== 'all' && resolveRecordTeam(r) !== team) return
      const n = resolveRecordName(r)
      if (n) set.add(n)
    })
    return [...set].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [scoped, dept, team])

  const filteredNameOptions = useMemo(() => {
    const q = nameQuery.trim().toLowerCase()
    if (!q) return nameOptions
    return nameOptions.filter(n => n.toLowerCase().includes(q))
  }, [nameOptions, nameQuery])

  // 사업부 변경 시 팀이 목록에 없으면 초기화
  useEffect(() => {
    if (team !== 'all' && !teamOptions.includes(team)) setTeam('all')
  }, [team, teamOptions])

  // 필터 변경 시 선택 이름이 목록에 없으면 초기화
  useEffect(() => {
    if (selectedName && !nameOptions.includes(selectedName)) {
      setSelectedName('')
      setNameQuery('')
    }
  }, [selectedName, nameOptions])

  if (loading || !user) return null

  const shown = scoped.filter(r => {
    const matchesDept = dept === 'all' || resolveRecordDept(r) === dept
    const matchesTeam = team === 'all' || resolveRecordTeam(r) === team
    const matchesName = !selectedName || resolveRecordName(r) === selectedName
    const matchesWorkArea = workArea === 'all' || resolveWorkArea(r) === workArea
    const matchesAutomationArea = automationArea === 'all' || resolveAutomationArea(r) === automationArea
    return matchesDept && matchesTeam && matchesName && matchesWorkArea && matchesAutomationArea
  })

  function handleDeptChange(value) {
    setDept(value)
    setTeam('all')
    setSelectedName('')
    setNameQuery('')
    setNameOpen(false)
  }

  function handleTeamChange(value) {
    setTeam(value)
    setSelectedName('')
    setNameQuery('')
    setNameOpen(false)
  }

  function selectName(name) {
    setSelectedName(name)
    setNameQuery(name)
    setNameOpen(false)
  }

  function clearName() {
    setSelectedName('')
    setNameQuery('')
    setNameOpen(false)
  }

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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>업무분야</label>
            <select value={workArea} onChange={e => setWorkArea(e.target.value)}>
              <option value="all">전체</option>
              {WORK_AREAS.map(area => <option key={area} value={area}>{area}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>자동화분야</label>
            <select value={automationArea} onChange={e => setAutomationArea(e.target.value)}>
              <option value="all">전체</option>
              {AUTOMATION_AREAS.map(area => <option key={area} value={area}>{area}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>사업부</label>
            <select value={dept} onChange={e => handleDeptChange(e.target.value)}>
              <option value="all">전체</option>
              {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>팀명</label>
            <select value={team} onChange={e => handleTeamChange(e.target.value)} disabled={teamOptions.length === 0 && dept !== 'all'}>
              <option value="all">전체</option>
              {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 16 }} ref={nameSearchRef}>
          <label>이름</label>
          <div className="name-search">
            <input
              type="text"
              placeholder="이름 검색 후 선택"
              value={nameQuery}
              onChange={e => {
                setNameQuery(e.target.value)
                setSelectedName('')
                setNameOpen(true)
              }}
              onFocus={() => setNameOpen(true)}
              autoComplete="off"
            />
            {(nameQuery || selectedName) && (
              <button
                type="button"
                className="name-search-clear"
                aria-label="이름 필터 지우기"
                onClick={clearName}
              >
                <i className="ti ti-x" />
              </button>
            )}
            {nameOpen && (
              <ul className="name-search-dropdown" role="listbox">
                {filteredNameOptions.length === 0 ? (
                  <li className="name-search-empty">일치하는 이름이 없습니다</li>
                ) : (
                  filteredNameOptions.map(n => (
                    <li key={n}>
                      <button
                        type="button"
                        className={selectedName === n ? 'active' : undefined}
                        role="option"
                        aria-selected={selectedName === n}
                        onClick={() => selectName(n)}
                      >
                        {n}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>

        {fetching ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>불러오는 중...</div>
        ) : shown.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
            조건에 맞는 실적이 없습니다
          </div>
        ) : shown.map(r => {
          const u = r.users || {}
          const liked = (r.liked_by || []).includes(email)
          const isOpen = expanded.has(r.id)
          const comments = commentsByRecord[r.id] || []
          const displayComments = filterDisplayComments(r, comments)
          const evalStatus = getEvalStatus(r, comments)
          const statusStyle = STATUS_STYLE[evalStatus] || STATUS_STYLE.submitted
          const canModify = r.email === email && (r.score || 0) === 0
          const canManageAttachments = r.email === email
          const canReply = r.email === email
          const canAdminDelete = isCeo && (r.score || 0) > 0
          const needsReply = canReply && evalStatus === 'revision_requested'
          const canViewAttachments = r.email === email || isCeo
          return (
            <div
              key={r.id}
              className="card"
              style={{
                marginBottom: 12,
                cursor: 'pointer',
                borderColor: needsReply ? 'var(--gold)' : undefined,
                boxShadow: needsReply ? '0 0 0 1px var(--gold-light)' : undefined,
              }}
              onClick={() => toggleExpand(r.id)}
            >
              <RecordSummaryHeader
                userName={u.name || r.user_name}
                userDept={r.user_dept || u.dept}
                userTeam={u.team || r.user_team}
                task={r.task}
                statusCls={statusStyle.cls}
                statusLabel={statusStyle.label}
                tool={r.tool}
                workCategory={classificationLabel(r)}
                isOpen={isOpen}
              />

              {needsReply && !isOpen && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gold-text)' }}>
                  <i className="ti ti-message-circle" /> 평가자 의견에 답변이 필요합니다 · 펼쳐서 답변
                </div>
              )}

              {isOpen && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                    {recordDate(r)}
                    <span className="category-tag" style={{ marginLeft: 8 }}>{classificationLabel(r)}</span>
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 11, marginBottom: 2 }}>활용 내용</div>
                    {r.content}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 11, marginBottom: 2 }}>효과</div>
                    {r.effect}
                  </div>

                  <RecordAttachmentManager
                    recordId={r.id}
                    email={email}
                    canView={canViewAttachments}
                    canManage={canManageAttachments}
                  />

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

                  {shouldShowFinalFeedback(r, comments) && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--accent-light)', borderRadius: 8, fontSize: 13, color: 'var(--accent-text)' }}>
                      <i className="ti ti-message-circle" /> 최종 평가: {r.feedback}
                    </div>
                  )}

                  {(displayComments.length > 0 || canReply) && (
                    <RecordFeedbackThread
                      record={r}
                      comments={displayComments}
                      replyDraft={replyDrafts[r.id] || ''}
                      replySaving={!!replySaving[r.id]}
                      allowReply={canReply}
                      onReplyDraftChange={value => setReplyDrafts(prev => ({ ...prev, [r.id]: value }))}
                      onSubmitReply={() => submitReply(r)}
                    />
                  )}

                  {canModify && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '8px 10px' }}
                          onClick={e => { e.stopPropagation(); router.push(`/register?edit=${r.id}`) }}
                        >
                          수정
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '8px 10px' }}
                          onClick={e => { e.stopPropagation(); router.push(`/register?clone=${r.id}`) }}
                        >
                          재등록
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '8px 10px' }}
                          onClick={e => { e.stopPropagation(); openDelete(r) }}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  )}

                  {canAdminDelete && (
                    <div style={{ marginTop: 10 }}>
                      <button
                        className="btn btn-danger btn-block"
                        style={{ padding: '8px 10px' }}
                        onClick={e => { e.stopPropagation(); openDelete(r) }}
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </Layout>
      <ConfirmDeleteModal
        open={!!deleteTarget}
        title={deleteTarget?.task}
        confirming={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmRemoveRecord}
      />
    </>
  )
}
