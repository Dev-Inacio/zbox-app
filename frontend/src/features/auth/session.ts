import type { AuthUser, LoginResponse } from './types'

// ⚠️ SIMULAÇÃO (mock) da sessão, enquanto o back não define como o token é guardado.
// Fica no localStorage para:
//   1. sobreviver ao F5 (o usuário não precisa entrar de novo ao recarregar)
//   2. ser compartilhada entre abas: sair em uma aba tira das outras (HU07)

export const SESSION_KEY = 'zbox.session'

type StoredSession = {
  accessToken: string
  user: AuthUser
}

export function saveSession(response: LoginResponse) {
  const session: StoredSession = { accessToken: response.accessToken, user: response.user }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

// Devolve o usuário logado, ou null. Nunca quebra: um valor estragado conta como "sem sessão".
export function readMockSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return (JSON.parse(raw) as StoredSession).user ?? null
  } catch {
    return null
  }
}
