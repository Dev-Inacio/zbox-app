import type { ReactNode } from 'react'
import './zbox.css'

type Props = {
  title: ReactNode            // "Orçamento #000129 v1", "Pedido #000045", "Entrada de R$ 1.681,50"
  meta?: ReactNode            // "enviado 04/10 · " (texto antes dos selos)
  badges?: ReactNode          // selos de status que você já tem (Enviado, Em produção, Parcial, PIX…)
  valueLabel: string          // "Total" | "Falta receber" | "Recebido"
  value: ReactNode            // "R$ 3.363,00"
  positive?: boolean          // true = valor em verde (pagamento recebido)
  href?: string
  testId?: string
}

// Linha em bloco das abas do cliente (Orçamentos / Pedidos / Pagamentos)
export function RecordRow({ title, meta, badges, valueLabel, value, positive, href, testId }: Props) {
  const body = (
    <>
      <span className="zb-rec__info">
        <span className="zb-rec__title">{title}</span>
        <span className="zb-rec__meta">{meta}{badges}</span>
      </span>
      <span className="zb-item__value">
        <span className="zb-item__value-label">{valueLabel}</span>
        <span className={`zb-item__value-num${positive ? ' zb-positive' : ''}`}>{value}</span>
      </span>
    </>
  )
  return (
    <li className="zb-block zb-rec" data-testid={testId}>
      {href ? <a href={href} className="zb-rec__link">{body}</a> : body}
    </li>
  )
}
