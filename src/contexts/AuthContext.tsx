'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { AuthUser } from '@/types'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // localStorage から初期状態を復元
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      const storedUser = localStorage.getItem(USER_KEY)
      if (storedToken && storedUser) {
        setToken(storedToken)
        setUser(JSON.parse(storedUser) as AuthUser)
      }
    } catch {
      // パース失敗時はクリア
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth は AuthProvider 内で使用してください')
  }
  return ctx
}
