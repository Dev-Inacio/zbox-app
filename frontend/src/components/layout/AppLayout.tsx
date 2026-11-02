import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import './AppLayout.css'

// Moldura das telas internas v3: menu lateral azul + página da rota.
// (O AppHeader antigo continua no projeto, mas não é mais usado aqui.)
export function AppLayout() {
  return (
    <div className="zb-app">
      <Sidebar />
      <div className="zb-app__main"><Outlet /></div>
    </div>
  )
}
