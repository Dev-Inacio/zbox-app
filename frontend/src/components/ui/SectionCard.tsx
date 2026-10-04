import type { ReactNode } from 'react'
import { Button } from './Button'
import './SectionCard.css'

// HU04/HU05 RN03: os 4 estados do card
export type LoadState = 'loading' | 'success' | 'empty' | 'error'

type SectionCardProps = {
  title: string
  state: LoadState
  onRetry: () => void
  badge?: string       // selo ao lado do título (ex.: "Dados de exemplo")
  action?: ReactNode   // link à direita do título (ex.: "Ver tudo")
  elevated?: boolean   // com sombra (o card que "sobe" sobre o cabeçalho)
  children?: ReactNode // o conteúdo, mostrado só no estado "success"
}

export function SectionCard({ title, state, onRetry, badge, action, elevated = false, children }: SectionCardProps) {
  const titleId = `secao-${title.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <section
      className={`section-card${elevated ? ' section-card--elevated' : ''}`}
      aria-labelledby={titleId}
      aria-busy={state === 'loading'}
    >
      <div className="section-card__header">
        <h2 id={titleId} className="section-card__title">{title}</h2>
        {badge && <span className="section-card__badge">{badge}</span>}
        {action && <div className="section-card__action">{action}</div>}
      </div>

      <div className="section-card__body">
        {state === 'loading' && (
          <div className="section-card__skeleton" aria-label="Carregando">
            <span /><span /><span />
          </div>
        )}

        {state === 'success' && children}

        {state === 'empty' && <p className="section-card__message">Nada por aqui ainda.</p>}

        {state === 'error' && (
          <div className="section-card__error" role="alert">
            <p className="section-card__message">Não foi possível carregar.</p>
            <Button onClick={onRetry}>Tentar novamente</Button>
          </div>
        )}
      </div>
    </section>
  )
}
