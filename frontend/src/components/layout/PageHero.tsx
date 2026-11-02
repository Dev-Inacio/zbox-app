import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AppIcon } from '../ui/AppIcon'
import './PageHero.css'

// Topo claro das páginas internas (v3): título grande; o menu lateral azul já dá a identidade.

type PageHeroProps = {
  title: string
  eyebrow?: string                      // texto pequeno acima do título
  back?: { to: string; label: string }  // link "Voltar para…"
  avatar?: string                       // iniciais à esquerda do título
  badge?: ReactNode                     // ao lado do título (ex.: "Ativo")
  subtitle?: ReactNode
  actions?: ReactNode                   // botões à direita
}

export function PageHero({ title, eyebrow, back, avatar, badge, subtitle, actions }: PageHeroProps) {
  return (
    <div className="page-hero">
      <div className="page-hero__inner">
        <div className="page-hero__text">
          {back && (
            <Link to={back.to} className="page-hero__back">
              <AppIcon name="arrowLeft" size={24} />
              {back.label}
            </Link>
          )}
          {eyebrow && <p className="page-hero__eyebrow">{eyebrow}</p>}
          <div className="page-hero__who">
            {avatar && <span className="page-hero__avatar" aria-hidden="true">{avatar}</span>}
            <div className="page-hero__names">
              <div className="page-hero__title-row">
                <h1 className="page-hero__title">{title}</h1>
                {badge}
              </div>
              {subtitle && <p className="page-hero__subtitle">{subtitle}</p>}
            </div>
          </div>
        </div>
        {actions && <div className="page-hero__actions">{actions}</div>}
      </div>
    </div>
  )
}
