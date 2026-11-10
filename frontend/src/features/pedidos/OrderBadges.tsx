import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from './labels'
import type { OrderStatus, PaymentStatus } from './types'
import { AppIcon } from '../../components/ui/AppIcon'
import { StatusTag } from '../../components/zbox'
import type { StatusTone } from '../../components/zbox/StatusTag'
import './Pedidos.css'

// Selos sempre com texto, nunca só cor.
const ORDER_TONE: Record<OrderStatus, StatusTone> = {
  NEW: 'neutral', IN_PRODUCTION: 'info', READY: 'info', DELIVERED: 'success', CANCELED: 'neutral',
}
const PAYMENT_TONE: Record<PaymentStatus, StatusTone> = {
  UNPAID: 'danger', PARTIAL: 'warning', PAID: 'success', OVERDUE: 'danger',
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <StatusTag tone={ORDER_TONE[status]}>{ORDER_STATUS_LABEL[status]}</StatusTag>
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <StatusTag tone={PAYMENT_TONE[status]}>{PAYMENT_STATUS_LABEL[status]}</StatusTag>
}

export function AlertIcon({ size = 13 }: { size?: number }) {
  return <AppIcon name="alert" size={size} />
}
