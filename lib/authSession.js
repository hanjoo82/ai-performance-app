const SESSION_KEY = 'ai_perf_auth_email'

export function loadAuthEmail() {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(SESSION_KEY) || null
  } catch {
    return null
  }
}

export function persistAuthEmail(email) {
  if (typeof window === 'undefined') return
  try {
    if (email) sessionStorage.setItem(SESSION_KEY, email)
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore quota / private mode
  }
}

export function clearAuthEmail() {
  persistAuthEmail(null)
}
