import type { Page } from '../clientes/types'
import { daysBetween, todayIso } from '../pedidos/dates'
import { mockAllOrders } from '../pedidos/ordersApi'
import type { Order, OrderStatus, PaymentMethod, PaymentStatus } from '../pedidos/types'

// ⚠️ SIMULAÇÃO (mock) de /api/financial — lê os mesmos pedidos do mock de Pedidos.
// Regra de ouro: só entra em "Recebido" o que tem PAGAMENTO registrado (e não estornado).
// Testar estados: /financeiro?simular=erro | /financeiro?simular=vazio

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const simulation = () => new URLSearchParams(window.location.search).get('simular')

export type FinancialSummary = {
  receivableCents: number
  receivableOrders: number
  overdueCents: number
  overdueOrders: number
  receivedCents: number
  receivedPayments: number
  byMethod: { method: PaymentMethod; amountCents: number }[]
}

export type Receivable = {
  orderId: number
  number: string
  customerName: string
  customerWhatsapp: string | null
  status: OrderStatus
  paymentStatus: PaymentStatus
  createdAt: string
  totalCents: number
  paidCents: number
  remainingCents: number
  deliveredOn: string | null
  daysSinceDelivery: number | null
  lastCollectionAt: string | null
}

export type ReceivableFilter = 'ALL' | 'OVERDUE' | 'OPEN'

export type ReceivedPayment = {
  id: number
  orderId: number
  orderNumber: string
  customerName: string
  amountCents: number
  method: PaymentMethod
  paidAt: string
  userName: string
}

function openOrders(): Order[] {
  return mockAllOrders().filter((o) => o.status !== 'CANCELED' && o.remainingCents > 0)
}

function inPeriod(day: string, from: string, to: string) {
  return day >= from && day <= to
}

function check() {
  if (simulation() === 'erro') throw new TypeError('Failed to fetch')
}

// GET /api/financial/summary?from=&to=
export async function getFinancialSummary(from: string, to: string): Promise<FinancialSummary> {
  await wait(400)
  check()
  const empty = simulation() === 'vazio'
  const open = empty ? [] : openOrders()
  const overdue = open.filter((o) => o.paymentStatus === 'OVERDUE')
  const payments = (empty ? [] : mockAllOrders()).flatMap((o) => o.payments).filter((p) => !p.reversed && inPeriod(p.paidAt, from, to))
  const byMethod = new Map<PaymentMethod, number>()
  for (const p of payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amountCents)
  return {
    receivableCents: open.reduce((s, o) => s + o.remainingCents, 0),
    receivableOrders: open.length,
    overdueCents: overdue.reduce((s, o) => s + o.remainingCents, 0),
    overdueOrders: overdue.length,
    receivedCents: payments.reduce((s, p) => s + p.amountCents, 0),
    receivedPayments: payments.length,
    byMethod: [...byMethod.entries()].map(([method, amountCents]) => ({ method, amountCents })).sort((a, b) => b.amountCents - a.amountCents),
  }
}

// GET /api/financial/receivables?filter=&search=&page=&size=
export async function listReceivables(filter: ReceivableFilter, search: string, page: number, size: number): Promise<Page<Receivable>> {
  await wait(500)
  check()
  const term = search.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const digits = search.replace(/\D/g, '') // "#000041" ou "41" acham o pedido 000041
  const today = todayIso()
  const rows = (simulation() === 'vazio' ? [] : openOrders())
    .filter((o) => filter === 'ALL' || (filter === 'OVERDUE' ? o.paymentStatus === 'OVERDUE' : o.status !== 'DELIVERED'))
    .filter((o) => term.length < 2 || (digits.length >= 2 && o.number.includes(digits)) || o.customer.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(term))
    .sort((a, b) => {
      // Pagamento atrasado primeiro (entregue há mais tempo no topo); depois os não entregues, mais antigos primeiro
      const aOver = a.paymentStatus === 'OVERDUE'
      const bOver = b.paymentStatus === 'OVERDUE'
      if (aOver !== bOver) return aOver ? -1 : 1
      if (aOver) return (a.deliveredOn ?? '').localeCompare(b.deliveredOn ?? '')
      return a.createdAt.localeCompare(b.createdAt)
    })
    .map((o): Receivable => ({
      orderId: o.id, number: o.number, customerName: o.customer.name, customerWhatsapp: o.customer.whatsapp,
      status: o.status, paymentStatus: o.paymentStatus, createdAt: o.createdAt,
      totalCents: o.totalCents, paidCents: o.paidCents, remainingCents: o.remainingCents,
      deliveredOn: o.deliveredOn, daysSinceDelivery: o.deliveredOn ? daysBetween(o.deliveredOn, today) : null,
      lastCollectionAt: o.lastCollectionAt,
    }))
  const start = page * size
  return { content: rows.slice(start, start + size), page, size, totalElements: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / size)) }
}

// GET /api/financial/payments?from=&to=&page=&size=
export async function listReceivedPayments(from: string, to: string, page: number, size: number): Promise<Page<ReceivedPayment>> {
  await wait(500)
  check()
  const rows = (simulation() === 'vazio' ? [] : mockAllOrders())
    .flatMap((o) => o.payments.filter((p) => !p.reversed && inPeriod(p.paidAt, from, to)).map((p): ReceivedPayment => ({
      id: p.id, orderId: o.id, orderNumber: o.number, customerName: o.customer.name, amountCents: p.amountCents, method: p.method, paidAt: p.paidAt, userName: p.userName,
    })))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.id - a.id)
  const start = page * size
  return { content: rows.slice(start, start + size), page, size, totalElements: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / size)) }
}

// GET /api/financial/payments?customerId=9 — pagamentos de um cliente (aba "Pagamentos" do detalhe do cliente)
export async function listPaymentsByCustomer(customerId: number): Promise<ReceivedPayment[]> {
  await wait(400)
  check()
  return mockAllOrders()
    .filter((o) => o.customer.id === customerId)
    .flatMap((o) => o.payments.filter((p) => !p.reversed).map((p): ReceivedPayment => ({
      id: p.id, orderId: o.id, orderNumber: o.number, customerName: o.customer.name, amountCents: p.amountCents, method: p.method, paidAt: p.paidAt, userName: p.userName,
    })))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.id - a.id)
}
