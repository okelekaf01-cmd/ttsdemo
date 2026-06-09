'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface User { id: string; email: string; displayName: string; createdAt: string }

interface AuthCtx {
  user: User | null
  balance: number
  loading: boolean
  refreshBalance: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({
  user: null, balance: 0, loading: true,
  refreshBalance: async () => {},
  logout: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          setUser(data.user)
          setBalance(data.balance ?? 0)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const refreshBalance = useCallback(async () => {
    const res = await fetch('/api/points')
    if (res.ok) {
      const data = await res.json()
      setBalance(data.balance ?? 0)
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setBalance(0)
    router.push('/login')
  }, [router])

  return (
    <AuthContext.Provider value={{ user, balance, loading, refreshBalance, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
