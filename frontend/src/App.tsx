import { useState } from 'react'
import { LoginPage } from './features/auth/LoginPage'
import type { AuthUser } from './features/auth/types'

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null)

  if (!user) {
    return <LoginPage onSuccess={setUser} />
  }

  // Provisório: o Dashboard entra aqui na próxima etapa
  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ fontFamily: 'var(--font-display)' }}>Olá, {user.name}!</h1>
      <p>Login feito com sucesso ({user.role}). O Dashboard vem na próxima etapa.</p>
      <button type="button" onClick={() => setUser(null)}>Sair</button>
    </main>
  )
}
