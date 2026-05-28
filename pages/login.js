import { useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/useAuth'
import Head from 'next/head'
import Image from 'next/image'
import styles from './login.module.css'

export default function Login() {
  const router = useRouter()
  const { login, register } = useAuth()
  const [email, setEmail] = useState('')
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState({ name: '', dept: '', team: '', role: '' })
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
    const ceoEmail = (process.env.NEXT_PUBLIC_CEO_EMAIL || '').toLowerCase().trim()
    const is_ceo = !!ceoEmail && email.toLowerCase().trim() === ceoEmail
    try {
      await register(email, { name, dept, team, role, is_ceo })
      router.push('/')
    } catch (err) {
      const detail = [err?.message, err?.details, err?.hint, err?.code].filter(Boolean).join(' | ')
      const msg = detail || JSON.stringify(err)
      console.error('register error:', err)
      setError(`등록 실패: ${msg}`)
      alert(`등록 실패\n${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head><title>로그인 · AI 성과 관리</title></Head>
      <div className={styles.wrap}>

        {/* 상단 다크 헤더 — CEO 메시지 영역 */}
        <div className={styles.header}>
          <div className={styles.companyLogo}>
            <Image src="/hanjoo-logo.png" alt="HANJOO" width={80} height={110} style={{ objectFit: 'contain' }} priority />
          </div>
          <div className={styles.divider} />
          <div className={styles.quote}>
            <span className={styles.quoteMarkOpen}>&ldquo;</span>
            <p className={styles.quoteMain}>
              AI 활용은 선택이 아니라<br />우리의 경쟁력입니다.
            </p>
            <p className={styles.quoteSub}>
              여러분의 작은 개선이 회사의 큰 혁신이 됩니다.
            </p>
            <span className={styles.quoteMarkClose}>&rdquo;</span>
          </div>
          <div className={styles.ceoSign}>
            <span>— 대표이사 한휘선</span>
          </div>
        </div>

        {/* 하단 로그인 카드 영역 */}
        <div className={styles.bottom}>
          <div className={styles.appTitle}>AI 활용 성과 관리 시스템</div>

          <div className={styles.card}>
            {!isNew ? (
              <>
                <div className="form-group">
                  <label>이메일 주소</label>
                  <input
                    type="email"
                    placeholder="id@hjcustoms.co.kr"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError('') }}
                    onFocus={() => { setEmail(''); setError('') }}
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
                {error && <div className="alert alert-danger">{error}</div>}
                <button className="btn btn-primary btn-block" onClick={handleRegister} disabled={loading}>
                  {loading ? '등록 중...' : '등록하고 시작하기'}
                </button>
              </>
            )}
          </div>

          <p className={styles.footerNote}>
            이 앱은 보고를 위한 도구가 아니라 성장과 공정한 평가를 위한 약속입니다.
          </p>
        </div>

      </div>
    </>
  )
}
