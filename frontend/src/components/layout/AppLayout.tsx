import { Outlet } from 'react-router-dom'
import { AppHeader } from './AppHeader'

// Moldura das telas internas: header fixo em cima, a página da rota embaixo (<Outlet />).
export function AppLayout() {
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  )
}
