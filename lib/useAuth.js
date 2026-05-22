import { useState, createContext, useContext } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState(null)
  const [loading, setLoading] = useState(false)

  async function loadUser(em) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('email', em)
      .single()
    if (data) {
      setEmail(em)
      setUser(data)
    }
    return data
  }

  async function login(em) {
    return loadUser(em)
  }

  async function register(em, profile) {
    const { data, error } = await supabase
      .from('users')
      .insert([{ email: em, ...profile }])
      .select()
      .single()
    if (error) throw error
    setEmail(em)
    setUser(data)
    return data
  }

  function logout() {
    setUser(null)
    setEmail(null)
  }

  return (
    <AuthContext.Provider value={{ user, email, loading, login, register, logout, isCeo: user?.is_ceo === true }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
