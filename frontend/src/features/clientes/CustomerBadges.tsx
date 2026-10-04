import type { CustomerStatus, CustomerType } from './types'

// Selos usados na lista e no detalhe. Sempre com TEXTO (não só cor), por acessibilidade.

export function StatusBadge({ status }: { status: CustomerStatus }) {
  if (status === 'ACTIVE') return <span className="cl-badge cl-badge--active">Ativo</span>
  return (
    <span className="cl-badge cl-badge--inactive">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M6 18L18 6" />
      </svg>
      Inativo
    </span>
  )
}

export function TypeBadge({ type }: { type: CustomerType | null }) {
  if (type === 'PERSON') return <span className="cl-tag cl-tag--person" title="Pessoa física">PF</span>
  if (type === 'COMPANY') return <span className="cl-tag cl-tag--company" title="Empresa">Empresa</span>
  return <span className="cl-tag cl-tag--none" aria-label="Tipo não informado">—</span>
}
