import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/useAuth'
import { loadSavedEmailPrefs, persistSavedEmail } from '../lib/savedEmail'
import { getSupabaseConfigError, withTimeout } from '../lib/supabaseConfig'
import { normalizeEmail } from '../lib/email'
import { ORG_DEPTS, TEAM_ROSTER } from '../lib/orgStats'
import { supabase } from '../lib/supabase'
import Head from 'next/head'
import Image from 'next/image'
import styles from './login.module.css'

export default function Login() {
  const router = useRouter()
  const { login, register } = useAuth()
  const [email, setEmail] = useState(() => loadSavedEmailPrefs().email)
  const [rememberEmail, setRememberEmail] = useState(() => loadSavedEmailPrefs().remember)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState({ name: '', dept: '', team: '', role: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dbWarning, setDbWarning] = useState('')
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstallable, setIsInstallable] = useState(false)

  const teamOptions = useMemo(
    () => (form.dept ? (TEAM_ROSTER[form.dept] || []).map((row) => row.name) : []),
    [form.dept]
  )

  function handleDeptChange(dept) {
    setForm((prev) => ({ ...prev, dept, team: '' }))
  }

  useEffect(() => {
    if (getSupabaseConfigError()) return
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .then(({ count, error: dbError }) => {
        if (dbError) return
        if (count === 0) {
          setDbWarning(
            '연결된 DB에 사용자가 없습니다. Vercel 환경 변수와 동일한 Supabase를 .env.local에 설정했는지 확인해 주세요. (docs/운영DB연결.md)'
          )
        }
      })
  }, [])

  useEffect(() => {
    function onBeforeInstallPrompt(e) {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    function onAppInstalled() {
      setDeferredPrompt(null)
      setIsInstallable(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  function handleRememberChange(checked) {
    setRememberEmail(checked)
    persistSavedEmail(email, checked)
  }

  function handleEmailChange(value) {
    setEmail(value)
    setError('')
  }

  function formatLoginError(err) {
    const msg = err?.message || ''
    if (msg.includes('시간이 초과') || msg.includes('timeout') || msg.includes('Timeout')) {
      return '서버 응답이 없습니다. Supabase URL·키 설정과 인터넷 연결을 확인해 주세요.'
    }
    if (msg.includes('Failed to fetch') || msg.includes('fetch') || msg.includes('NetworkError')) {
      return '서버에 연결할 수 없습니다. Supabase 설정(.env.local)을 확인해 주세요.'
    }
    return msg || '로그인 확인 중 오류가 발생했습니다.'
  }

  async function handleEmailNext() {
    if (!email.includes('@')) { setError('올바른 이메일을 입력해주세요'); return }

    const configError = getSupabaseConfigError()
    if (configError) {
      setError(configError)
      return
    }

    persistSavedEmail(email, rememberEmail)
    setLoading(true)
    setError('')
    try {
      const user = await withTimeout(login(email.trim()))
      if (user) {
        await router.push('/')
      } else {
        setIsNew(true)
      }
    } catch (err) {
      console.error('login error:', err)
      setError(formatLoginError(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    const { name, dept, team, role } = form
    if (!name || !dept || !team || !role) { setError('모든 항목을 입력해주세요'); return }
    setLoading(true)
    try {
      await register(email, { name, dept, team, role })
      persistSavedEmail(email, rememberEmail)
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

  async function handleInstallApp() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice?.outcome === 'accepted') {
        setDeferredPrompt(null)
        setIsInstallable(false)
      }
      return
    }

    alert('이 브라우저에서는 자동 설치 팝업이 제한됩니다.\nChrome 또는 Safari에서 열고 브라우저 메뉴의 "홈 화면에 추가"를 사용해 주세요.')
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
          <p className={styles.appSubTitle}>성장과 공정한 평가를 위한 AI 성과 관리 플랫폼</p>

          <div className={styles.card}>
            {!isNew ? (
              <>
                <div className={styles.cardTitle}>본인 인증</div>
                <div className="form-group">
                  <label>회사 이메일</label>
                  <input
                    type="email"
                    placeholder="id@hjcustoms.co.kr"
                    value={email}
                    onChange={e => handleEmailChange(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEmailNext()}
                    autoFocus
                  />
                </div>
                <div className={styles.rememberRow}>
                  <input
                    id="remember-email"
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={e => handleRememberChange(e.target.checked)}
                  />
                  <label htmlFor="remember-email">이메일 저장</label>
                </div>

                {dbWarning && <div className="alert alert-danger">{dbWarning}</div>}
                {error && <div className="alert alert-danger">{error}</div>}
                <button className={`btn btn-primary btn-block ${styles.ctaBtn}`} onClick={handleEmailNext} disabled={loading}>
                  {loading ? '확인 중...' : '계속하기'}
                </button>
              </>
            ) : (
              <>
                <div className="alert alert-info">
                  <strong>{normalizeEmail(email)}</strong> 계정이 이 데이터베이스에 없습니다.
                  예전에 가입하셨다면, 연결된 Supabase 프로젝트가 다른지 확인해 주세요.
                </div>
                <div className={styles.newBadge}>
                  <i className="ti ti-info-circle" /> 소속 정보를 등록하면 바로 이용할 수 있습니다
                </div>
                <button
                  type="button"
                  className={`btn btn-ghost btn-block ${styles.backBtn}`}
                  onClick={() => { setIsNew(false); setError('') }}
                >
                  다른 이메일로 로그인
                </button>
                <div className="form-group">
                  <label>성명 *</label>
                  <input placeholder="홍길동" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>소속 사업부 *</label>
                  <select value={form.dept} onChange={e => handleDeptChange(e.target.value)}>
                    <option value="">선택해주세요</option>
                    {ORG_DEPTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>팀명 *</label>
                  <select
                    value={form.team}
                    onChange={e => setForm({ ...form, team: e.target.value })}
                    disabled={!form.dept || teamOptions.length === 0}
                  >
                    <option value="">
                      {!form.dept ? '사업부를 먼저 선택해주세요' : '선택해주세요'}
                    </option>
                    {teamOptions.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>직책 *</label>
                  <input placeholder="과장" value={form.role} onChange={e => setForm({...form, role: e.target.value})} />
                </div>
                {error && <div className="alert alert-danger">{error}</div>}
                <button className={`btn btn-primary btn-block ${styles.ctaBtn}`} onClick={handleRegister} disabled={loading}>
                  {loading ? '등록 중...' : '등록하고 시작하기'}
                </button>
              </>
            )}
          </div>

          <button className={`btn ${isInstallable ? 'btn-primary' : 'btn-ghost'} ${styles.installBtn}`} onClick={handleInstallApp}>
            <i className="ti ti-device-mobile-down" /> 홈 화면에 앱 설치
          </button>
          <p className={styles.installGuide}>
            설치 팝업이 뜨지 않으면 Chrome 또는 Safari에서 열어 설치해 주세요.
          </p>

        </div>

      </div>
    </>
  )
}
