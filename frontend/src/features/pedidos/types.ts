import type { QuoteCustomer, QuoteItem } from '../orcamentos/types'

// Tipos que espelham o contrato de Pedidos e Financeiro (docs/contrato-api-pedidos-financeiro.md).
// Dinheiro em CENTAVOS (inteiro). Datas sem hora em "YYYY-MM-DD". Data-hora em ISO 8601.

// Andamento (a operação). Decisão da PO 04/10: sem "Em instalação".
export type OrderStatus = 'NEW' | 'IN_PRODUCTION' | 'READY' | 'DELIVERED' | 'CANCELED'

// Pagamento (o dinheiro). Calculado pelo BACK, nunca enviado pelo front.
// OVERDUE = "Pagamento atrasado": entregue e ainda falta receber (não existe data de vencimento).
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE'

export type PaymentMethod = 'PIX' | 'CASH' | 'CARD' | 'TRANSFER' | 'BOLETO' | 'OTHER'

export type Payment = {
  id: number
  amountCents: number
  method: PaymentMethod
  paidAt: string // YYYY-MM-DD
  note: string | null
  userName: string
  createdAt: string
  reversed: boolean
  reversedReason: string | null
}

export type OrderEvent = {
  id: number
  type: 'CREATED' | 'STATUS_CHANGED' | 'DELIVERED' | 'PAYMENT' | 'PAYMENT_REVERSED' | 'COLLECTION' | 'CANCELED'
  detail: string | null
  userName: string
  createdAt: string
}

export type Order = {
  id: number
  number: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  quote: { id: number; number: string; version: number }
  customer: QuoteCustomer
  items: QuoteItem[]
  subtotalCents: number
  discountCents: number
  totalCents: number
  paidCents: number
  remainingCents: number
  paymentTerms: string | null
  notes: string | null
  createdAt: string
  deliveredAt: string | null
  deliveredOn: string | null
  receivedBy: string | null
  deliveryNote: string | null
  canceledAt: string | null
  cancelReason: string | null
  payments: Payment[]
  lastCollectionAt: string | null
  events: OrderEvent[]
}

export type OrderSummary = {
  id: number
  number: string
  customerName: string
  createdAt: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  totalCents: number
  paidCents: number
  remainingCents: number
  deliveredOn: string | null
}

export type OrderStatusFilter = OrderStatus | 'ALL'

export type ListOrdersParams = {
  search: string
  status: OrderStatusFilter
  payment: PaymentStatus | 'ALL'
  customerId?: number
  page: number
  size: number
}

export type OrderCounts = Record<OrderStatus, number> & { ALL: number; OVERDUE_PAYMENT: number }

// ---------- Requests ----------
export type PaymentRequest = { amountCents: number; method: PaymentMethod; paidAt: string; note: string | null }

// Decisão da PO (04/10, revista): pedido NÃO tem prazo de entrega.
export type ConvertToOrderRequest = { downPayment: Omit<PaymentRequest, 'note'> | null }

export type DeliverRequest = {
  deliveredOn: string
  receivedBy: string
  note: string | null
  payment: Omit<PaymentRequest, 'note'> | null // null = "Não, ainda vai pagar"
}
