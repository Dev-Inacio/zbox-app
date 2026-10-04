import type { OrderStatus, PaymentMethod, PaymentStatus } from './types'

// Textos da tela para os códigos da API. Se a PO mudar um nome, muda só aqui.

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: 'Novo',
  IN_PRODUCTION: 'Em produção',
  READY: 'Pronto',
  DELIVERED: 'Entregue',
  CANCELED: 'Cancelado',
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: 'Não pago',
  PARTIAL: 'Parcial',
  PAID: 'Pago',
  OVERDUE: 'Pagamento atrasado',
}

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  PIX: 'PIX',
  CASH: 'Dinheiro',
  CARD: 'Cartão',
  TRANSFER: 'Transferência',
  BOLETO: 'Boleto',
  OTHER: 'Outro',
}

export const METHODS = Object.keys(METHOD_LABEL) as PaymentMethod[]

// Etapas na ordem (o "Entregue" tem tela própria: pergunta se pagou)
export const ORDER_STEPS: OrderStatus[] = ['NEW', 'IN_PRODUCTION', 'READY', 'DELIVERED']

export const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  NEW: { to: 'IN_PRODUCTION', label: 'Iniciar produção' },
  IN_PRODUCTION: { to: 'READY', label: 'Marcar como pronto' },
  READY: { to: 'DELIVERED', label: 'Marcar como entregue' },
}

export const PREVIOUS_STEP: Partial<Record<OrderStatus, OrderStatus>> = {
  IN_PRODUCTION: 'NEW',
  READY: 'IN_PRODUCTION',
}
