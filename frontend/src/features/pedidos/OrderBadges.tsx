import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from './labels'
import type { OrderStatus, PaymentStatus } from './types'
import './Pedidos.css'

// Selos sempre com texto (e ícone quando pede atenção), nunca só cor.

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`pd-badge pd-badge--${status.toLowerCase()}`}>{ORDER_STATUS_LABEL[status]}</span>
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`pd-badge pd-badge--pay-${status.toLowerCase()}`}>
      {status === 'OVERDUE' && <AlertIcon />}
      {status === 'PAID' && <CheckIcon />}
      {PAYMENT_STATUS_LABEL[status]}
    </span>
  )
}

export function AlertIcon({ size = 13 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 3l9 16H3z" /><path d="M12 10v4" /><path d="M12 17h.01" /></svg>
}

function CheckIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
}
