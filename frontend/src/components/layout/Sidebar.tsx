import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Banknote, Building2, FileText, Home, LogOut, Menu, Package, PanelLeftClose, PanelLeftOpen, Users, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import logo from '../../assets/zbox-logo-escuro.png'
import { useAuth } from '../../features/auth/useAuth'
import './Sidebar.css'

type Item = { path: string; label: string; icon: LucideIcon; roles?: string[] }
// Mesmas rotas de antes — só a apresentação mudou.
const GROUPS: { title: string; items: Item[] }[] = [
  { title: 'Principal', items: [{ path: '/inicio', label: 'Início', icon: Home }] },
  { title: 'Vendas', items: [{ path: '/clientes', label: 'Clientes', icon: Users }, { path: '/orcamentos', label: 'Orçamentos', icon: FileText }] },
  { title: 'Operação', items: [{ path: '/pedidos', label: 'Pedidos', icon: Package }] },
  { title: 'Gestão', items: [{ path: '/financeiro', label: 'Financeiro', icon: Banknote }, { path: '/perfil', label: 'Dados da empresa', icon: Building2 }] },
]

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Administrador', MANAGER: 'Gerente', EMPLOYEE: 'Funcionário' }
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')

export function Sidebar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('zbox.menu') === 'min' } catch { return false } })
  const [open, setOpen] = useState(false) // gaveta no tablet/celular

  useEffect(() => { try { localStorage.setItem('zbox.menu', collapsed ? 'min' : 'full') } catch { /* sem storage: tudo bem */ } }, [collapsed])
  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [open])

  function logout() {
    setOpen(false)
    signOut() // sem recado: quem clicou em Sair sabe que saiu
    navigate('/login', { replace: true })
  }

  return (
    <>
      {/* Tablet/celular: barra no topo com botão "Menu" escrito (não só ícone) */}
      <div className="zb-topbar">
        <img src={logo} alt="ZBOX Serralheria e Alumínio" className="zb-topbar__logo" />
        <button type="button" className="zb-topbar__menu" aria-expanded={open} aria-controls="zb-sidebar" onClick={() => setOpen(true)}>
          <Menu size={24} aria-hidden="true" /> Menu
        </button>
      </div>
      {open && <div className="zb-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside id="zb-sidebar" className={`zb-sidebar${collapsed ? ' is-min' : ''}${open ? ' is-open' : ''}`} aria-label="Menu principal">
        <div className="zb-sidebar__top">
          <img src={logo} alt="ZBOX Serralheria e Alumínio" className="zb-sidebar__logo" />
          <button type="button" className="zb-sidebar__close" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={24} /></button>
        </div>

        <nav className="zb-sidebar__nav">
          {GROUPS.map((g) => (
            <div key={g.title} className="zb-sidebar__group">
              <span className="zb-sidebar__title">{g.title}</span>
              {g.items.filter((i) => !i.roles || (user && i.roles.includes(user.role))).map((i) => (
                <NavLink key={i.path} to={i.path} className="zb-sidebar__item" onClick={() => setOpen(false)} title={collapsed ? i.label : undefined}>
                  <i.icon size={22} strokeWidth={1.8} aria-hidden="true" />
                  <span className="zb-sidebar__label">{i.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="zb-sidebar__foot">
          {user && (
            <div className="zb-sidebar__user">
              <span className="zb-sidebar__avatar" aria-hidden="true">{initials(user.name)}</span>
              <span className="zb-sidebar__label zb-sidebar__who"><b>{user.name}</b><span>{ROLE_LABEL[user.role] ?? user.role}</span></span>
            </div>
          )}
          <button type="button" className="zb-sidebar__item" onClick={logout}><LogOut size={22} strokeWidth={1.8} aria-hidden="true" /><span className="zb-sidebar__label">Sair</span></button>
          <button type="button" className="zb-sidebar__collapse" onClick={() => setCollapsed((c) => !c)} aria-pressed={collapsed}>
            {collapsed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
            <span className="zb-sidebar__label">{collapsed ? 'Abrir menu' : 'Recolher menu'}</span>
          </button>
        </div>
      </aside>
    </>
  )
}
