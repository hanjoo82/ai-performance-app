import { useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/useAuth'
import Head from 'next/head'
import styles from './login.module.css'

export default function Login() {
  const router = useRouter()
  const { login, register } = useAuth()
  const [email, setEmail] = useState('')
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState({ name: '', dept: '', team: '', role: '', isCeo: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleEmailNext() {
    if (!email.includes('@')) { setError('올바른 이메일을 입력해주세요'); return }
    setLoading(true)
    const user = await login(email)
    setLoading(false)
    if (user) { router.push('/') }
    else { setIsNew(true) }
  }

  async function handleRegister() {
    const { name, dept, team, role } = form
    if (!name || !dept || !team || !role) { setError('모든 항목을 입력해주세요'); return }
    setLoading(true)
    await register(email, form)
    setLoading(false)
    router.push('/')
  }

  return (
    <>
      <Head><title>로그인 · AI 성과 관리</title></Head>
      <div className={styles.wrap}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}><i className="ti ti-brain" /></div>
          <div className={styles.logoText}>AI 활용 성과 관리</div>
          <div className={styles.logoSub}>직원 AI 실적 등록 · 평가 시스템</div>
        </div>

        <div className={styles.card}>
          {!isNew ? (
            <>
              <div className="form-group">
                <label>이메일 주소</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleEmailNext()}
                  autoFocus
                />
              </div>
              {error && <div className="alert alert-danger">{error}</div>}
              <button className="btn btn-primary btn-block" onClick={handleEmailNext} disabled={loading}>
                {loading ? '확인 중...' : '계속하기'}
              </button>
            </>
          ) : (
            <>
              <div className={styles.newBadge}>
                <i className="ti ti-info-circle" /> 처음 오셨군요! 소속 정보를 등록해주세요
              </div>
              <div className="form-group">
                <label>성명 *</label>
                <input placeholder="홍길동" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>소속 사업부 *</label>
                <select value={form.dept} onChange={e => setForm({...form, dept: e.target.value})}>
                  <option value="">선택해주세요</option>
                  <option value="CCB">CCB</option>
                  <option value="COB">COB</option>
                  <option value="CRB">CRB</option>
                  <option value="CMS">CMS</option>
                </select>
              </div>
              <div className="form-group">
                <label>팀명 *</label>
                <input placeholder="영업1팀" value={form.team} onChange={e => setForm({...form, team: e.target.value})} />
              </div>
              <div className="form-group">
                <label>직책 *</label>
                <input placeholder="과장" value={form.role} onChange={e => setForm({...form, role: e.target.value})} />
              </div>
              <div className="form-group">
                <label>권한</label>
                <select value={form.isCeo ? '1' : '0'} onChange={e => setForm({...form, isCeo: e.target.value === '1'})}>
                  <option value="0">일반 직원</option>
                  <option value="1">대표 (평가 권한 부여)</option>
                </select>
              </div>
              {error && <div className="alert alert-danger">{error}</div>}
              <button className="btn btn-primary btn-block" onClick={handleRegister} disabled={loading}>
                {loading ? '등록 중...' : '등록하고 시작하기'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
