import { useEffect, useRef, useState } from 'react'
import { Logo } from '../ui/Logo'
import './AppHeader.css'

export type Page = 'inicio' | 'perfil'

type AppHeaderProps = {
  userName: string
  current: Page
  onNavigate: (page: Page) => void
  onLogout: () => void
}

// HU03: itens provisórios definidos no Trello (a PO troca os nomes depois)
const ITEMS: { page: Page; label: string }[] = [
  { page: 'inicio', label: 'Início' },
  { page: 'perfil', label: 'Perfil' },
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

export function AppHeader({ userName, current, onNavigate, onLogout }: AppHeaderProps) {
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

  function go(page: Page) {
    onNavigate(page)
    setOpen(false)
  }

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <button type="button" className="app-header__logo" onClick={() => go('inicio')} aria-label="ZBOX, ir para o início">
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? (
                <>
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </>
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
          </button>

          <ul id="menu-principal" className={`app-header__menu${open ? ' is-open' : ''}`}>
            {ITEMS.map((item) => (
              <li key={item.page}>
                <button
                  type="button"
                  className="app-header__item"
                  aria-current={current === item.page ? 'page' : undefined}
                  onClick={() => go(item.page)}
                >
                  {item.label}
                </button>
              </li>
            ))}
            <li className="app-header__divider" aria-hidden="true" />
            <li className="app-header__avatar" aria-hidden="true">{initials(userName)}</li>
            <li>
              <button type="button" className="app-header__item" onClick={onLogout}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
                Sair
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}
