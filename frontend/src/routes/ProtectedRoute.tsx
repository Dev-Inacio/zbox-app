import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

// RN01: sem sessão, qualquer tela interna manda para o login.
// Guarda o endereço pedido em `from` para voltar a ele depois de entrar.
export function ProtectedRoute() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return <Outlet />
}
