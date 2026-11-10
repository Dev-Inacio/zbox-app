import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../ui/Logo'
import { useAuth } from '../../features/auth/useAuth'
import { Menu } from 'lucide-react' // única exceção do padrão: ☰ do celular só em linha
import { AppIcon } from '../ui/AppIcon'
import './AppHeader.css'

// HU03: itens provisórios definidos no Trello (a PO troca os nomes depois)
const ITEMS = [
  { path: '/inicio', label: 'Início' },
  { path: '/clientes', label: 'Clientes' },
  { path: '/orcamentos', label: 'Orçamentos' },
  { path: '/pedidos', label: 'Pedidos' },
  { path: '/financeiro', label: 'Financeiro' },
  { path: '/perfil', label: 'Perfil' },
]

// "Thayná Dias" → "TD"
function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

export function AppHeader() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false) // menu hambúrguer aberto? (só no celular)
  const navRef = useRef<HTMLElement>(null)

  // HU03 Cenário 4: fecha o menu ao tocar fora ou apertar Esc
  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setOpen(false)
    }
    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      // limpeza: remove os "ouvintes" quando o menu fecha, para não acumular
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  function go(path: string) {
    navigate(path)
    setOpen(false)
  }

  // HU06: sair → login com aviso. (A chamada POST /api/auth/logout entra na integração.)
  function handleLogout() {
    setOpen(false)
    signOut() // sem recado: quem clicou em Sair sabe que saiu
    navigate('/login', { replace: true })
  }

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <button type="button" className="app-header__logo" onClick={() => go('/inicio')} aria-label="Zezinho Esquadrinhas, ir para o início">
          <Logo />
        </button>

        <nav ref={navRef} className="app-header__nav" aria-label="Menu principal">
          <button
            type="button"
            className="app-header__burger"
            aria-expanded={open}
            aria-controls="menu-principal"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <AppIcon name="close" size={24} /> : <Menu size={24} aria-hidden="true" />}
          </button>

          <ul id="menu-principal" className={`app-header__menu${open ? ' is-open' : ''}`}>
            {ITEMS.map((item) => (
              <li key={item.path}>
                <button
                  type="button"
                  className="app-header__item"
                  // /clientes/12 também deixa "Clientes" marcado
                  aria-current={pathname === item.path || pathname.startsWith(`${item.path}/`) ? 'page' : undefined}
                  onClick={() => go(item.path)}
                >
                  {item.label}
                </button>
              </li>
            ))}
            <li className="app-header__divider" aria-hidden="true" />
            <li className="app-header__avatar" aria-hidden="true">{initials(user?.name ?? '')}</li>
            <li>
              <button type="button" className="app-header__item" onClick={handleLogout}>
                <AppIcon name="logout" size={24} />
                Sair
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}
