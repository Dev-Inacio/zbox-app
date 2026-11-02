import { ApiError } from '../auth/types'
import { readMockSession } from '../auth/session'
import { customerMobile } from '../clientes/format'
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
  overdueCustomers: number      // clientes diferentes com pagamento atrasado
  notDeliveredCents: number     // falta receber de pedidos ainda não entregues
  notDeliveredOrders: number
}

// YYYY-MM dos 6 meses que terminam no mês de `day`, do mais antigo para o mais novo
function lastSixMonths(day: string): string[] {
  const [y, m] = day.split('-').map(Number)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(y, m - 1 - (5 - i), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  return { from: `${month}-01`, to: `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}` }
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
  invoiceNumber: string | null
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
  note?: string | null // 'Entrada' no sinal do pedido
  // Só para ADMIN e MANAGER (mesma regra de "Gastos e lucro"). Para EMPLOYEE vem null.
  // Números do PEDIDO deste pagamento: os mesmos de "Como foi o mês" e do quadro do pedido (o cliente lança num lugar
  // e vê igual nos outros). Antes era a parte proporcional do pagamento, que confundia (R$ 0,49 de R$ 100.000).
  split?: {
    orderTotalCents: number
    orderMaterialCents: number
    orderOtherCents: number    // gasto antigo do tipo "mão de obra"
    orderRemainingCents: number
    orderLaborCents: number    // mão de obra = serviço − material − outros (o que sobra para você)
  } | null
}

// "O que entrou": um cartão por serviço. Pagar mais uma parte atualiza o cartão, não cria outro.
export type ReceivedOrder = {
  orderId: number
  orderNumber: string
  customerName: string
  amountCents: number // soma do que entrou no período
  lastPaidAt: string
  payments: { id: number; amountCents: number; method: PaymentMethod; paidAt: string }[]
  split: ReceivedPayment['split']
}

function paymentSplit(o: Order): ReceivedPayment['split'] {
  const role = readMockSession()?.role
  if (role !== 'ADMIN' && role !== 'MANAGER') return null
  const materialCents = (o.expenses ?? []).filter((e) => e.type === 'MATERIAL').reduce((s, e) => s + e.amountCents, 0)
  const otherCents = (o.expenses ?? []).filter((e) => e.type === 'LABOR').reduce((s, e) => s + e.amountCents, 0)
  return {
    orderTotalCents: o.totalCents,
    orderMaterialCents: materialCents,
    orderOtherCents: otherCents,
    orderRemainingCents: o.remainingCents,
    orderLaborCents: o.totalCents - materialCents - otherCents,
  }
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
  const notDelivered = open.filter((o) => o.status !== 'DELIVERED')
  return {
    receivableCents: open.reduce((s, o) => s + o.remainingCents, 0),
    receivableOrders: open.length,
    overdueCents: overdue.reduce((s, o) => s + o.remainingCents, 0),
    overdueOrders: overdue.length,
    receivedCents: payments.reduce((s, p) => s + p.amountCents, 0),
    receivedPayments: payments.length,
    byMethod: [...byMethod.entries()].map(([method, amountCents]) => ({ method, amountCents })).sort((a, b) => b.amountCents - a.amountCents),
    overdueCustomers: new Set(overdue.map((o) => o.customer.id)).size,
    notDeliveredCents: notDelivered.reduce((sum, o) => sum + o.remainingCents, 0),
    notDeliveredOrders: notDelivered.length,
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
      orderId: o.id, number: o.number, customerName: o.customer.name, customerWhatsapp: customerMobile(o.customer),
      status: o.status, paymentStatus: o.paymentStatus, createdAt: o.createdAt,
      totalCents: o.totalCents, paidCents: o.paidCents, remainingCents: o.remainingCents,
      deliveredOn: o.deliveredOn, daysSinceDelivery: o.deliveredOn ? daysBetween(o.deliveredOn, today) : null,
      lastCollectionAt: o.lastCollectionAt,
      invoiceNumber: o.invoice?.number ?? null,
    }))
  const start = page * size
  return { content: rows.slice(start, start + size), page, size, totalElements: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / size)) }
}

// GET /api/financial/payments/by-order?from=&to=&page=&size=
export async function listReceivedOrders(from: string, to: string, page: number, size: number): Promise<Page<ReceivedOrder>> {
  await wait(500)
  check()
  const rows = (simulation() === 'vazio' ? [] : mockAllOrders())
    .flatMap((o): ReceivedOrder[] => {
      const payments = o.payments
        .filter((p) => !p.reversed && inPeriod(p.paidAt, from, to))
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.id - a.id)
        .map((p) => ({ id: p.id, amountCents: p.amountCents, method: p.method, paidAt: p.paidAt }))
      if (payments.length === 0) return []
      return [{
        orderId: o.id, orderNumber: o.number, customerName: o.customer.name,
        amountCents: payments.reduce((s, p) => s + p.amountCents, 0),
        lastPaidAt: payments[0].paidAt, payments, split: paymentSplit(o),
      }]
    })
    .sort((a, b) => b.lastPaidAt.localeCompare(a.lastPaidAt) || b.payments[0].id - a.payments[0].id)
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
      id: p.id, orderId: o.id, orderNumber: o.number, customerName: o.customer.name, amountCents: p.amountCents, method: p.method, paidAt: p.paidAt, userName: p.userName, note: p.note,
      split: paymentSplit(o),
    })))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.id - a.id)
}

// ---------- HU27: lucro dos serviços no período (só ADMIN e MANAGER) ----------
export type ProfitRow = {
  orderId: number
  number: string
  customerName: string
  status: OrderStatus
  totalCents: number
  expensesCents: number
  profitCents: number
  marginPercent: number
  hasExpenses: boolean
  paidCents: number           // recebido do cliente (a tela mostra "falta receber" = total − recebido)
  expectedProfitCents: number // mão de obra = serviço − material (− outros gastos)
  materialCents: number
  laborCents: number
}

export type ProfitReport = {
  receivedCents: number   // pagamentos no período (não estornados)
  materialCents: number   // gastos de material com data no período
  laborCents: number      // gastos de mão de obra com data no período
  expensesCents: number
  cashCents: number       // recebido − gastos do período
  orders: ProfitRow[]     // serviços com movimento no período, do maior lucro para o menor
}

// GET /api/financial/profit?from=&to=
// Entra o pedido que teve movimento no período: criado, entregue ou com gasto lançado nele.
export async function getProfitReport(from: string, to: string): Promise<ProfitReport> {
  await wait(500)
  check()
  const role = readMockSession()?.role
  if (role !== 'ADMIN' && role !== 'MANAGER') throw new ApiError(403, 'FORBIDDEN', 'Só Administrador e Gerente veem o lucro.')
  const all = simulation() === 'vazio' ? [] : mockAllOrders()
  const received = all.flatMap((o) => o.payments).filter((p) => !p.reversed && inPeriod(p.paidAt, from, to)).reduce((s, p) => s + p.amountCents, 0)
  const expenses = all.flatMap((o) => o.expenses ?? []).filter((e) => inPeriod(e.date, from, to))
  const sum = (t: 'MATERIAL' | 'LABOR') => expenses.filter((e) => e.type === t).reduce((s, e) => s + e.amountCents, 0)
  const materialCents = sum('MATERIAL')
  const laborCents = sum('LABOR')
  const orders = all
    .filter((o) => inPeriod(o.createdAt.slice(0, 10), from, to) || (o.deliveredOn !== null && inPeriod(o.deliveredOn, from, to)) || (o.expenses ?? []).some((e) => inPeriod(e.date, from, to)))
    .filter((o) => o.status !== 'CANCELED' || (o.expenses ?? []).length > 0) // cancelado só aparece se teve gasto (prejuízo)
    .map((o): ProfitRow => ({
      orderId: o.id, number: o.number, customerName: o.customer.name, status: o.status,
      totalCents: o.status === 'CANCELED' ? 0 : o.totalCents,
      expensesCents: o.profit!.expensesCents,
      profitCents: o.status === 'CANCELED' ? -o.profit!.expensesCents : o.profit!.profitCents,
      marginPercent: o.status === 'CANCELED' ? 0 : o.profit!.marginPercent,
      hasExpenses: (o.expenses ?? []).length > 0,
      paidCents: o.paidCents,
      expectedProfitCents: o.status === 'CANCELED' ? -o.profit!.expensesCents : o.profit!.expectedProfitCents,
      materialCents: o.profit!.materialCents,
      laborCents: o.profit!.laborCents,
    }))
    .sort((a, b) => Number(b.hasExpenses) - Number(a.hasExpenses) || b.profitCents - a.profitCents)
  return { receivedCents: received, materialCents, laborCents, expensesCents: materialCents + laborCents, cashCents: received - materialCents - laborCents, orders }
}

// Quanto sobrou em cada um dos 6 meses (só serviços com material lançado, a mesma conta de "Como foi o mês")
export async function getProfitByMonth(day: string): Promise<{ month: string; leftCents: number; percent: number | null }[]> {
  return Promise.all(lastSixMonths(day).map(async (month) => {
    const { from, to } = monthRange(month)
    const rated = (await getProfitReport(from, to)).orders.filter((o) => o.status !== 'CANCELED' && (o.materialCents > 0 || o.expectedProfitCents < 0))
    const leftCents = rated.reduce((sum, o) => sum + o.expectedProfitCents, 0)
    const base = rated.reduce((sum, o) => sum + o.totalCents, 0)
    return { month, leftCents, percent: base > 0 ? Math.round((leftCents / base) * 100) : null }
  }))
}
