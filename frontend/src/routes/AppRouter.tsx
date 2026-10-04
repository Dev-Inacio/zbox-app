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
import { QuotesListPage } from '../features/orcamentos/QuotesListPage'
import { NewQuotePage } from '../features/orcamentos/NewQuotePage'
import { QuoteEditorPage } from '../features/orcamentos/QuoteEditorPage'
import { QuoteReviewPage } from '../features/orcamentos/QuoteReviewPage'
import { QuoteDetailPage } from '../features/orcamentos/QuoteDetailPage'
import { QuotePrintPage } from '../features/orcamentos/QuotePrintPage'
import { OrdersListPage } from '../features/pedidos/OrdersListPage'
import { OrderDetailPage } from '../features/pedidos/OrderDetailPage'
import { FinancialPage } from '../features/financeiro/FinancialPage'

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
          <Route path="/orcamentos" element={<QuotesListPage />} />
          <Route path="/orcamentos/novo" element={<NewQuotePage />} />
          <Route path="/orcamentos/:id" element={<QuoteDetailPage />} />
          <Route path="/orcamentos/:id/editar" element={<QuoteEditorPage />} />
          <Route path="/orcamentos/:id/revisar" element={<QuoteReviewPage />} />
          <Route path="/pedidos" element={<OrdersListPage />} />
          <Route path="/pedidos/:id" element={<OrderDetailPage />} />
          <Route path="/financeiro" element={<FinancialPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
        </Route>
        {/* Impressão/PDF: protegida, mas sem o menu (só o documento) */}
        <Route path="/orcamentos/:id/imprimir" element={<QuotePrintPage />} />
      </Route>

      {/* Qualquer outro endereço vai para o início (que pede login se precisar) */}
      <Route path="*" element={<Navigate to="/inicio" replace />} />
    </Routes>
  )
}
