import { useContext } from 'react'
import { AuthContext } from './AuthContext'

// Uso: const { user, signIn, signOut } = useAuth()
export function useAuth() {
  const context = useContext(AuthContext)
  // Erro claro se alguém esquecer o <AuthProvider> em volta do app
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>.')
  return context
}
