import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from './api'
import type { UserMe } from './types'

interface AuthState {
  user: UserMe | null
  loading: boolean
  login: (email?: string) => Promise<void>
  loginWithPassword: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const me = await api.me()
      setUser(me)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    // Resume an existing session on load.
    void (async () => {
      await refresh()
      setLoading(false)
    })()
  }, [refresh])

  const login = useCallback(
    async (email?: string) => {
      await api.login(email)
      await refresh()
    },
    [refresh],
  )

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      await api.passwordLogin(email, password)
      await refresh()
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    await api.logout()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, loginWithPassword, logout, refresh }),
    [user, loading, login, loginWithPassword, logout, refresh],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
