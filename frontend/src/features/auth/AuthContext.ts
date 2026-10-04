import { createContext } from 'react'
import type { AuthUser, LoginResponse } from './types'

export type AuthContextValue = {
  user: AuthUser | null
  notice: string | undefined                // aviso para a tela de login (ex.: "Você saiu da sua conta.")
  signIn: (response: LoginResponse) => void
  signOut: (notice?: string) => void
}

// Fica num arquivo separado do Provider para o Vite conseguir recarregar o componente sozinho (Fast Refresh)
export const AuthContext = createContext<AuthContextValue | null>(null)
