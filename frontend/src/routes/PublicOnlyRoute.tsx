import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

// Quem já está logado não vê o login de novo: vai direto para o início.
export function PublicOnlyRoute() {
  const { user } = useAuth()

  if (user) return <Navigate to="/inicio" replace />

  return <Outlet />
}
