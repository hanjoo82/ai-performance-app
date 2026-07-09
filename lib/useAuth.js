import { useState, createContext, useContext, useEffect } from 'react'
import { supabase } from './supabase'
import { normalizeEmail } from './email'
import { isAdminUser } from './admin'
import { clearAuthEmail, loadAuthEmail, persistAuthEmail } from './authSession'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function restore() {
      const saved = loadAuthEmail()
      if (!saved) {
        if (!cancelled) setLoading(false)
        return
      }
      try {
        const data = await loadUser(saved)
        if (!cancelled && !data) clearAuthEmail()
      } catch (err) {
        console.warn('auth restore failed:', err?.message || err)
        if (!cancelled) clearAuthEmail()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    restore()
    return () => { cancelled = true }
    // loadUser is stable enough for mount-only restore
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadUser(em) {
    const normalized = normalizeEmail(em)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', normalized)
      .maybeSingle()

    if (error) {
      const err = new Error(error.message || '사용자 조회에 실패했습니다.')
      err.code = error.code
      err.details = error.details
      throw err
    }
    if (data) {
      const resolved = normalizeEmail(data.email)
      setEmail(resolved)
      setUser(data)
      persistAuthEmail(resolved)
    }
    return data
  }

  async function login(em) {
    return loadUser(em)
  }

  async function register(em, profile) {
    const normalized = normalizeEmail(em)
    const { data, error } = await supabase
      .from('users')
      .insert([{ email: normalized, ...profile }])
      .select()
      .single()
    if (error) throw error
    setEmail(normalized)
    setUser(data)
    persistAuthEmail(normalized)
    return data
  }

  function logout() {
    setUser(null)
    setEmail(null)
    clearAuthEmail()
  }

  const isCeo = isAdminUser(user, email)

  return (
    <AuthContext.Provider value={{ user, email, loading, login, register, logout, isCeo }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
