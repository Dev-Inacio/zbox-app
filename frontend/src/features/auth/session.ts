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

// Nome para a saudação ("Olá, Thayná"). Usuário antigo no banco pode estar com o nome em branco:
// aí usa o login ("thayna@zbox.com.br" → "thayna") para nunca ficar só "Olá, ".
export function withDisplayName(user: AuthUser): AuthUser {
  const name = user.name?.trim() || user.email?.split('@')[0]?.trim() || 'Usuário'
  return { ...user, name }
}

export function saveSession(response: LoginResponse) {
  const session: StoredSession = { accessToken: response.accessToken, user: withDisplayName(response.user) }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

// Token para o cabeçalho "Authorization: Bearer ..." das chamadas à API
export function readAccessToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as StoredSession).accessToken ?? null : null
  } catch {
    return null
  }
}

// Devolve o usuário logado, ou null. Nunca quebra: um valor estragado conta como "sem sessão".
export function readMockSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const user = (JSON.parse(raw) as StoredSession).user
    return user ? withDisplayName(user) : null
  } catch {
    return null
  }
}
