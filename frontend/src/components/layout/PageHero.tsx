import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './PageHero.css'

// Faixa grafite do topo das páginas internas (mesmo visual da tela principal).
// O primeiro card da página "sobe" por cima dela (classe .page-body).

type PageHeroProps = {
  title: string
  eyebrow?: string                      // texto pequeno laranja acima do título
  back?: { to: string; label: string }  // link "Voltar para…"
  badge?: ReactNode                     // ao lado do título (ex.: "Ativo")
  subtitle?: ReactNode
  actions?: ReactNode                   // botões à direita
}

export function PageHero({ title, eyebrow, back, badge, subtitle, actions }: PageHeroProps) {
  return (
    <div className="page-hero">
      <div className="page-hero__inner">
        <div className="page-hero__text">
          {back && (
            <Link to={back.to} className="page-hero__back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
              {back.label}
            </Link>
          )}
          {eyebrow && <p className="page-hero__eyebrow">{eyebrow}</p>}
          <div className="page-hero__title-row">
            <h1 className="page-hero__title">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="page-hero__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-hero__actions">{actions}</div>}
      </div>
    </div>
  )
}
