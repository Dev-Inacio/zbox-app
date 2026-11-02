import type { CustomerStatus, CustomerType } from './types'
import { StatusTag } from '../../components/zbox'

// Selos usados na lista e no detalhe. Sempre com TEXTO (não só cor), por acessibilidade.

export function StatusBadge({ status }: { status: CustomerStatus }) {
  return status === 'ACTIVE' ? <StatusTag tone="success">Ativo</StatusTag> : <StatusTag tone="neutral">Inativo</StatusTag>
}

export function TypeBadge({ type }: { type: CustomerType | null }) {
  if (type === 'PERSON') return <span className="cl-tag cl-tag--person" title="Pessoa física">PF</span>
  if (type === 'COMPANY') return <span className="cl-tag cl-tag--company" title="Empresa">PJ</span>
  return <span className="cl-tag cl-tag--none" aria-label="Tipo não informado">—</span>
}
