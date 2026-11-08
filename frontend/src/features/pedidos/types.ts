import type { DiscountType, QuoteCustomer, QuoteItem } from '../orcamentos/types'

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

// Devolução: dinheiro que VOLTOU para o cliente (ex.: abatimento por defeito). O cliente não fica devendo.
// Diferente de estorno, que corrige um pagamento lançado errado e faz o valor voltar a "falta receber".
export type OrderRefund = {
  id: number
  amountCents: number
  method: PaymentMethod
  refundedAt: string // YYYY-MM-DD
  reason: string
  waivedCents: number // restante que deixou de ser cobrado junto com esta devolução
  userName: string
  createdAt: string
  canceled: boolean // lançada por engano e desfeita
}

export type RefundRequest = Pick<OrderRefund, 'amountCents' | 'method' | 'refundedAt' | 'reason'> & { waiveRemaining?: boolean }

export type OrderEvent = {
  id: number
  type: 'CREATED' | 'STATUS_CHANGED' | 'DELIVERED' | 'PAYMENT' | 'PAYMENT_REVERSED' | 'REFUND' | 'REFUND_CANCELED' | 'COLLECTION' | 'CANCELED'
  detail: string | null
  userName: string
  createdAt: string
}

// HU29: o ZBOX não emite a nota, só guarda o número (e o arquivo, opcional)
export type InvoiceType = 'SERVICE' | 'PRODUCT' | 'BOTH'
export type Invoice = {
  number: string
  issuedAt: string // YYYY-MM-DD
  type: InvoiceType
  notes: string | null
  hasFile: boolean
  updatedBy: string
  updatedAt: string
}
export type InvoiceRequest = Pick<Invoice, 'number' | 'issuedAt' | 'type' | 'notes'>

export type Order = {
  id: number
  number: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  quote: { id: number; number: string; version: number }
  customer: QuoteCustomer
  items: QuoteItem[]
  subtotalCents: number
  discountType: DiscountType | null
  discountValue: number | null // PERCENT: centésimos de % | AMOUNT: centavos
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
  refunds: OrderRefund[]
  refundedCents: number
  waivedCents: number // o que o cliente não vai mais pagar
  lastCollectionAt: string | null
  events: OrderEvent[]
  invoice: Invoice | null
  // HU27: só vem para ADMIN e MANAGER. Para EMPLOYEE o back manda null.
  expenses: OrderExpense[] | null
  profit: ProfitSummary | null
}

// ---------- HU27: gastos e lucro do serviço ----------
// Decisão da PO (11/10): só dois tipos, bem resumido.
export type ExpenseType = 'MATERIAL' | 'LABOR'

export type OrderExpense = {
  id: number
  type: ExpenseType
  description: string | null
  amountCents: number
  date: string // YYYY-MM-DD
  userName: string
  createdAt: string
}

// Calculado pelo BACK. O front só mostra.
export type ProfitSummary = {
  materialCents: number
  laborCents: number
  expensesCents: number
  profitCents: number         // o que já sobrou de verdade: recebido − gastos (0 até receber). Negativo só quando é prejuízo
  expectedProfitCents: number // quando receber tudo: total do pedido − gastos (negativo = prejuízo)
  marginPercent: number       // profitCents ÷ total, 1 casa decimal
  cashBalanceCents: number // recebido − gastos (pode ser negativo)
}

export type ExpenseRequest = { type: ExpenseType; description: string | null; amountCents: number; date: string }

export type OrderSummary = {
  invoiceNumber: string | null
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
