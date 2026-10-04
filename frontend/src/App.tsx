import { useState } from 'react'
import { LoginPage } from './features/auth/LoginPage'
import type { AuthUser } from './features/auth/types'
import { AppHeader } from './components/layout/AppHeader'
import type { Page } from './components/layout/AppHeader'
import { DashboardPage } from './features/dashboard/DashboardPage'

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [page, setPage] = useState<Page>('inicio')
  const [notice, setNotice] = useState<string | undefined>()

  function handleLogin(loggedUser: AuthUser) {
    setNotice(undefined)
    setPage('inicio')
    setUser(loggedUser)
  }

  // HU06: sair volta ao login com mensagem. (A chamada POST /api/auth/logout entra na integração.)
  function handleLogout() {
    setUser(null)
    setNotice('Você saiu da sua conta.')
  }

  if (!user) {
    return <LoginPage onSuccess={handleLogin} notice={notice} />
  }

  return (
    <>
      <AppHeader userName={user.name} current={page} onNavigate={setPage} onLogout={handleLogout} />
      {page === 'inicio' && <DashboardPage user={user} />}
      {page === 'perfil' && (
        <main style={{ maxWidth: 'var(--page-max)', margin: '0 auto', padding: '32px var(--page-gutter)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Perfil</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>Página em construção.</p>
        </main>
      )}
    </>
  )
}
