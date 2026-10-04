import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { PublicOnlyRoute } from './PublicOnlyRoute'
import { AppLayout } from '../components/layout/AppLayout'
import { LoginPage } from '../features/auth/LoginPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { ProfilePage } from '../features/profile/ProfilePage'
import { CustomersListPage } from '../features/clientes/CustomersListPage'
import { CustomerFormPage } from '../features/clientes/CustomerFormPage'
import { CustomerDetailPage } from '../features/clientes/CustomerDetailPage'

// Mapa de rotas do ZBOX.
// RN01: tudo exige sessão, menos /login.
export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/inicio" element={<DashboardPage />} />
          <Route path="/clientes" element={<CustomersListPage />} />
          <Route path="/clientes/novo" element={<CustomerFormPage />} />
          <Route path="/clientes/:id" element={<CustomerDetailPage />} />
          <Route path="/clientes/:id/editar" element={<CustomerFormPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
        </Route>
      </Route>

      {/* Qualquer outro endereço vai para o início (que pede login se precisar) */}
      <Route path="*" element={<Navigate to="/inicio" replace />} />
    </Routes>
  )
}
