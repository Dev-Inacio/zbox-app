import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './AuthContext'
import { UNAUTHORIZED_EVENT } from './http'
import { SESSION_KEY, clearSession, readMockSession, saveSession, withDisplayName } from './session'
import type { AuthUser, LoginResponse } from './types'

// Guarda "quem está logado" em um lugar só e entrega para qualquer tela via useAuth().
export function AuthProvider({ children }: { children: ReactNode }) {
  // Começa com o que estiver salvo: assim o F5 não desloga
  const [user, setUser] = useState<AuthUser | null>(() => readMockSession())
  const [notice, setNotice] = useState<string | undefined>()

  const signIn = useCallback((response: LoginResponse) => {
    saveSession(response)
    setNotice(undefined)
    setUser(withDisplayName(response.user))
  }, [])

  const signOut = useCallback((message?: string) => {
    clearSession()
    setNotice(message)
    setUser(null)
  }, [])

  // HU07: logout entre abas. O evento "storage" só dispara nas OUTRAS abas
  // quando uma delas muda o localStorage.
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== SESSION_KEY && event.key !== null) return
      const current = readMockSession()
      if (!current) setNotice('Sua sessão foi encerrada em outra aba.')
      setUser(current)
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Token vencido ou inválido (o back respondeu 401 numa chamada): sai do sistema com recado
  useEffect(() => {
    function handleUnauthorized() {
      if (!readMockSession()) return
      signOut('Sua sessão expirou. Entre de novo.')
    }
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [signOut])

  const value = useMemo(() => ({ user, notice, signIn, signOut }), [user, notice, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
