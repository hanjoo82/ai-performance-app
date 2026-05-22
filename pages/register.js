import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/useAuth'
import { addRecord } from '../lib/db'
import Layout from '../components/Layout'
import Head from 'next/head'

const AI_TOOLS = ['ChatGPT', 'Claude', 'Copilot', 'Gemini', 'Perplexity', 'Clova X', '기타']

export default function Register() {
  const { user, email, loading } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({
    task: '', content: '', effect: '',
    tool: '', toolEtc: '',
    helperDept: '', helperTeam: '', helperRole: '', helperName: '',
    date: new Date().toISOString().split('T')[0]
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user])

  async function handleSubmit() {
    const { task, content, effect, tool, toolEtc, helperDept, helperTeam, helperRole, helperName, date } = form
    if (!task || !content || !effect || !tool) { setError('필수 항목(*)을 모두 입력해주세요'); return }
    if (tool === '기타' && !toolEtc.trim()) { setError('기타 도구명을 입력해주세요'); return }
    setError('')
    setSubmitting(true)
    const finalTool = tool === '기타' ? toolEtc.trim() : tool
    try {
      await addRecord({
        email,
        user_name: user.name,
        user_dept: user.dept,
        user_team: user.team,
        task, content, effect,
        tool: finalTool,
        helper_dept: helperDept || null,
        helper_team: helperTeam.trim() || null,
        helper_role: helperRole.trim() || null,
        helper_name: helperName.trim() || null,
        date
      })
      setSuccess(true)
      setTimeout(() => router.push('/list'), 1200)
    } catch (err) {
      const detail = [err?.message, err?.details, err?.hint, err?.code].filter(Boolean).join(' | ')
      const msg = detail || JSON.stringify(err)
      console.error('addRecord error:', err)
      setError(`저장 실패: ${msg}`)
      alert(`저장 실패\n${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !user) return null
  const f = (k, v) => setForm(p => ({...p, [k]: v}))

  return (
    <>
      <Head><title>실적 등록 · AI 성과 관리</title></Head>
      <Layout title="AI 활용 실적 등록">
        {success && <div className="alert alert-success"><i className="ti ti-check" /> 등록 완료! 목록으로 이동합니다</div>}
        {error && <div className="alert alert-danger"><i className="ti ti-alert-circle" /> {error}</div>}

        <div className="card">
          <div className="form-group">
            <label>업무명 *</label>
            <input placeholder="예) 월간 보고서 작성" value={form.task} onChange={e => f('task', e.target.value)} />
          </div>
          <div className="form-group">
            <label>사용 AI 도구 *</label>
            <select value={form.tool} onChange={e => f('tool', e.target.value)}>
              <option value="">선택해주세요</option>
              {AI_TOOLS.map(t => <option key={t}>{t}</option>)}
            </select>
            {form.tool === '기타' && (
              <input
                style={{marginTop:8}}
                placeholder="도구명을 직접 입력해주세요"
                value={form.toolEtc}
                onChange={e => f('toolEtc', e.target.value)}
              />
            )}
          </div>
          <div className="form-group">
            <label>AI 활용 내용 *</label>
            <textarea
              placeholder="어떤 방식으로 AI를 활용했는지 구체적으로 작성해주세요"
              value={form.content}
              onChange={e => f('content', e.target.value)}
              style={{minHeight: 100}}
            />
          </div>
          <div className="form-group">
            <label>활용 효과 *</label>
            <textarea
              placeholder="예) 작업 시간 50% 단축, 오류 감소, 품질 향상 등 구체적 효과"
              value={form.effect}
              onChange={e => f('effect', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>소개 또는 도움 준 직원 <span style={{color:'var(--text3)',fontWeight:400,fontSize:12}}>(선택)</span></label>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <select value={form.helperDept} onChange={e => f('helperDept', e.target.value)}>
                <option value="">사업부</option>
                <option value="CCB">CCB</option>
                <option value="COB">COB</option>
                <option value="CRB">CRB</option>
                <option value="CMS">CMS</option>
              </select>
              <input placeholder="팀명" value={form.helperTeam} onChange={e => f('helperTeam', e.target.value)} />
              <input placeholder="직책" value={form.helperRole} onChange={e => f('helperRole', e.target.value)} />
              <input placeholder="성명" value={form.helperName} onChange={e => f('helperName', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>날짜</label>
            <input type="date" value={form.date} onChange={e => f('date', e.target.value)} />
          </div>

          <div style={{display:'flex',gap:10,marginTop:6}}>
            <button className="btn btn-primary" style={{flex:1}} onClick={handleSubmit} disabled={submitting}>
              {submitting ? '저장 중...' : <><i className="ti ti-check" /> 등록하기</>}
            </button>
            <button className="btn btn-ghost" onClick={() => router.back()}>취소</button>
          </div>
        </div>
      </Layout>
    </>
  )
}
