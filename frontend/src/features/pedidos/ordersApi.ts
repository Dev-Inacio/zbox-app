import { ApiError } from '../auth/types'
import type { FieldError } from '../auth/types'
import { readMockSession } from '../auth/session'
import type { Page } from '../clientes/types'
import { formatMoney } from '../orcamentos/money'
import { mockDirectSaleApprove, mockMarkQuoteConverted, mockMarkQuoteRejected, mockQuoteForConversion } from '../orcamentos/quotesApi'
import type { Quote, QuoteItem } from '../orcamentos/types'
import { todayIso } from './dates'
import { METHOD_LABEL, METHODS } from './labels'
import type {
  InvoiceRequest,
  ConvertToOrderRequest,
  ExpenseRequest,
  ExpenseType,
  OrderExpense,
  ProfitSummary,
  DeliverRequest,
  ListOrdersParams,
  Order,
  OrderCounts,
  OrderEvent,
  OrderStatus,
  OrderSummary,
  PaymentRequest,
  RefundRequest,
} from './types'

// ⚠️ SIMULAÇÃO (mock) — enquanto o Inácio não publica /api/orders e /api/financial.
// Este arquivo faz o papel do BACK: valida, calcula recebido/falta/status do pagamento,
// controla as etapas e nunca deixa o recebido passar do total.
// Na integração, cada função vira um fetch e as regras saem daqui (passam a ser do back).
//
// Testar estados: /pedidos?simular=erro  |  /pedidos?simular=vazio

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const simulation = () => new URLSearchParams(window.location.search).get('simular')
const userName = () => readMockSession()?.name ?? 'Usuário'
const now = () => new Date().toISOString()

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const store = new Map<number, Order>()
let nextOrderId = 1
let nextNumber = 40
let nextPaymentId = 1
let nextEventId = 1
let nextExpenseId = 1
// Idempotency-Key → pagamento já criado (o back guarda por 24 h). Evita pagamento duplicado no duplo clique.
const idempotency = new Map<string, number>()
let nextRefundId = 1_000_000

const ACTIVE: OrderStatus[] = ['NEW', 'IN_PRODUCTION', 'READY']

// ---------- Regras de dinheiro (no back real: no Service, dentro da transação) ----------
function recompute(order: Order) {
  order.paidCents = order.payments.filter((p) => !p.reversed).reduce((sum, p) => sum + p.amountCents, 0)
  const refunds = order.refunds.filter((r) => !r.canceled)
  order.refundedCents = refunds.reduce((sum, r) => sum + r.amountCents, 0) // sozinha, não muda o que falta receber
  order.waivedCents = refunds.reduce((sum, r) => sum + r.waivedCents, 0)   // "não cobrar o restante"
  order.remainingCents = order.totalCents - order.paidCents - order.waivedCents
  order.paymentStatus =
    order.remainingCents <= 0 ? 'PAID'
      : order.status === 'DELIVERED' ? 'OVERDUE'
        : order.paidCents > 0 ? 'PARTIAL'
          : 'UNPAID'
}

// HU27: quanto sobra do serviço. Sempre calculado aqui (no back).
// Regras da PO (11/10):
//   - Previsto = valor do serviço − gastos. Material lançado: o resto é a mão de obra de quem faz (o "sobrou para você").
//   - O lucro só conta o que o cliente PAGOU: fica R$ 0,00 até receber e volta a zero se o pagamento for estornado.
//   - Gastos maiores que o valor do serviço = prejuízo (saiu do bolso), mesmo sem ter recebido.
export function computeProfit(order: Order): ProfitSummary {
  const expenses = order.expenses ?? []
  const sum = (t: ExpenseType) => expenses.filter((e) => e.type === t).reduce((acc, e) => acc + e.amountCents, 0)
  const materialCents = sum('MATERIAL')
  const laborCents = sum('LABOR')
  const expensesCents = materialCents + laborCents
  // Devolução diminui o que o serviço rendeu
  const netCents = order.totalCents - order.refundedCents - order.waivedCents
  const expectedProfitCents = netCents - expensesCents
  const cashBalanceCents = order.paidCents - order.refundedCents - expensesCents
  const profitCents = expectedProfitCents < 0 ? expectedProfitCents : Math.max(0, Math.min(cashBalanceCents, expectedProfitCents))
  return {
    materialCents, laborCents, expensesCents, profitCents, expectedProfitCents,
    marginPercent: netCents > 0 ? Math.round((profitCents / netCents) * 1000) / 10 : 0,
    cashBalanceCents,
  }
}

const seesProfit = () => {
  const role = readMockSession()?.role
  return role === 'ADMIN' || role === 'MANAGER'
}

function snapshot(order: Order): Order {
  recompute(order)
  const copy = structuredClone(order)
  if (seesProfit()) {
    copy.expenses = [...(order.expenses ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    copy.profit = computeProfit(order)
  } else {
    // EMPLOYEE não recebe gastos nem lucro (nem escondido na resposta)
    copy.expenses = null
    copy.profit = null
  }
  return copy
}

function event(order: Order, type: OrderEvent['type'], detail: string | null = null, when = now(), who = userName()) {
  order.events.unshift({ id: nextEventId++, type, detail, userName: who, createdAt: when })
}

function find(id: number): Order {
  const order = store.get(id)
  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
  recompute(order)
  return order
}

function transitionError(): never {
  throw new ApiError(409, 'INVALID_ORDER_STATUS_TRANSITION', 'Esta ação não vale para a situação atual do pedido.')
}

function fieldError(field: string, message: string): never {
  throw new ApiError(400, 'VALIDATION_ERROR', message, [{ field, code: 'INVALID', message } satisfies FieldError])
}

function isDay(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

// Valida um pagamento contra o que falta. Nunca deixa passar do saldo.
function validatePayment(p: Omit<PaymentRequest, 'note'>, remainingCents: number, field = 'amountCents') {
  if (!Number.isInteger(p.amountCents) || p.amountCents <= 0) {
    throw new ApiError(422, 'PAYMENT_AMOUNT_INVALID', 'Informe um valor maior que R$ 0,00.', [{ field, code: 'POSITIVE', message: 'Informe um valor maior que R$ 0,00.' }])
  }
  if (p.amountCents > remainingCents) {
    const message = `O valor não pode ser maior que o que falta receber (${formatMoney(remainingCents)}).`
    throw new ApiError(422, 'PAYMENT_EXCEEDS_BALANCE', message, [{ field, code: 'MAX', message }])
  }
  if (!METHODS.includes(p.method)) fieldError('method', 'Escolha a forma de pagamento.')
  if (!isDay(p.paidAt)) fieldError('paidAt', 'Informe a data do pagamento.')
  if (p.paidAt > todayIso()) {
    throw new ApiError(422, 'PAYMENT_DATE_IN_FUTURE', 'A data do pagamento não pode ser no futuro.', [{ field: 'paidAt', code: 'PAST', message: 'A data do pagamento não pode ser no futuro.' }])
  }
}

function pushPayment(order: Order, p: Omit<PaymentRequest, 'note'> & { note?: string | null }, when = now(), who = userName()) {
  const payment = { id: nextPaymentId++, amountCents: p.amountCents, method: p.method, paidAt: p.paidAt, note: p.note?.trim() || null, userName: who, createdAt: when, reversed: false, reversedReason: null }
  order.payments.unshift(payment)
  event(order, 'PAYMENT', `${formatMoney(p.amountCents)} · ${METHOD_LABEL[p.method]}${payment.note ? ` · ${payment.note}` : ''}`, when, who)
  return payment
}

function fromQuote(quote: Quote, createdAt: string): Order {
  return {
    id: nextOrderId++,
    number: String(nextNumber++).padStart(6, '0'),
    status: 'NEW', paymentStatus: 'UNPAID',
    quote: { id: quote.id, number: quote.number, version: quote.version },
    directSale: quote.directSale ?? false,
    customer: structuredClone(quote.customer),
    items: structuredClone(quote.items) as QuoteItem[],
    subtotalCents: quote.subtotalCents, discountType: quote.discountType, discountValue: quote.discountValue, discountCents: quote.discountCents, totalCents: quote.totalCents,
    paidCents: 0, remainingCents: quote.totalCents,
    paymentTerms: quote.paymentTerms, notes: quote.notes,
    createdAt,
    deliveredAt: null, deliveredOn: null, receivedBy: null, deliveryNote: null, canceledAt: null, cancelReason: null,
    payments: [], refunds: [], refundedCents: 0, waivedCents: 0, lastCollectionAt: null, events: [], invoice: null,
    expenses: [], profit: null,
  }
}

function toSummary(o: Order): OrderSummary {
  return {
    invoiceNumber: o.invoice?.number ?? null,
    id: o.id, number: o.number, customerName: o.customer.name, createdAt: o.createdAt, status: o.status, paymentStatus: o.paymentStatus,
    totalCents: o.totalCents, paidCents: o.paidCents, remainingCents: o.remainingCents, deliveredOn: o.deliveredOn,
  }
}

// Ordem das listas: em andamento primeiro (os mais antigos no topo: estão esperando há mais tempo);
// entregues/cancelados no fim, os mais recentes primeiro
function byPriority(a: Order, b: Order): number {
  const aActive = ACTIVE.includes(a.status)
  const bActive = ACTIVE.includes(b.status)
  if (aActive !== bActive) return aActive ? -1 : 1
  if (aActive) return a.createdAt.localeCompare(b.createdAt)
  const aDay = a.deliveredOn ?? a.canceledAt ?? ''
  const bDay = b.deliveredOn ?? b.canceledAt ?? ''
  return bDay.localeCompare(aDay)
}

// Para o mock do Financeiro e do Início (no back real, são consultas no mesmo banco)
export function mockAllOrders(): Order[] {
  return [...store.values()].map((o) => {
    recompute(o)
    const copy = structuredClone(o)
    copy.profit = computeProfit(o)
    return copy
  })
}

// ---------- Endpoints ----------

// POST /api/quotes/{id}/convert-to-order { downPayment }
export async function convertQuoteToOrder(quoteId: number, request: ConvertToOrderRequest): Promise<Order> {
  await wait(700)
  const quote = mockQuoteForConversion(quoteId) // 409 se não aprovado ou já convertido
  if (request.downPayment) {
    try {
      validatePayment(request.downPayment, quote.totalCents, 'downPayment.amountCents')
    } catch (e) {
      // Mensagem própria para a entrada (critério da HU19)
      if (e instanceof ApiError && e.code === 'PAYMENT_EXCEEDS_BALANCE') {
        throw new ApiError(422, 'PAYMENT_EXCEEDS_BALANCE', 'A entrada não pode ser maior que o total do pedido.', [{ field: 'downPayment.amountCents', code: 'MAX', message: 'A entrada não pode ser maior que o total do pedido.' }])
      }
      throw e
    }
  }
  // Tudo validado: agora grava (no back, numa transação só)
  const created = now()
  const order = fromQuote(quote, created)
  event(order, 'CREATED', `${quote.number} v${quote.version}`)
  if (request.downPayment) pushPayment(order, { ...request.downPayment, note: 'Entrada' })
  store.set(order.id, order)
  mockMarkQuoteConverted(quote.id, { id: order.id, number: order.number })
  return snapshot(order)
}

// HU32 — POST /api/quotes/{id}/direct-sale (proposto): confirma + aprova + cria o pedido de uma vez.
// No back real tem que ser UMA transação: ou cria tudo, ou nada.
export async function directSaleToOrder(quoteId: number): Promise<Order> {
  await wait(300)
  const existing = [...store.values()].find((o) => o.quote.id === quoteId)
  if (existing) return snapshot(existing) // duplo clique: devolve o mesmo pedido
  mockDirectSaleApprove(quoteId)
  return convertQuoteToOrder(quoteId, { downPayment: null })
}

// GET /api/orders?search=&status=&payment=&customerId=&page=0&size=20
export async function listOrders(params: ListOrdersParams): Promise<Page<OrderSummary>> {
  await wait(500)
  const sim = simulation()
  if (sim === 'erro') throw new TypeError('Failed to fetch')
  const term = normalize(params.search.trim())
  const digits = params.search.replace(/\D/g, '')
  const all = sim === 'vazio' ? [] : [...store.values()]
  all.forEach(recompute)
  const filtered = all
    .filter((o) => params.customerId === undefined || o.customer.id === params.customerId)
    .filter((o) => params.status === 'ALL' || o.status === params.status)
    .filter((o) => params.payment === 'ALL' || o.paymentStatus === params.payment)
    .filter((o) => {
      if (term.length < 2) return true
      if (digits.length >= 2 && o.number.includes(digits)) return true
      return normalize(o.customer.name).includes(term)
    })
    .sort(byPriority)
  const start = params.page * params.size
  return {
    content: filtered.slice(start, start + params.size).map(toSummary),
    page: params.page, size: params.size, totalElements: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / params.size)),
  }
}

// GET /api/orders/counts
export async function countOrders(): Promise<OrderCounts> {
  await wait(300)
  const counts: OrderCounts = { ALL: 0, NEW: 0, IN_PRODUCTION: 0, READY: 0, DELIVERED: 0, CANCELED: 0, OVERDUE_PAYMENT: 0 }
  if (simulation() === 'vazio') return counts
  for (const o of store.values()) {
    recompute(o)
    counts.ALL += 1
    counts[o.status] += 1
    if (o.paymentStatus === 'OVERDUE') counts.OVERDUE_PAYMENT += 1
  }
  return counts
}

// GET /api/orders/{id}
export async function getOrder(id: number): Promise<Order> {
  await wait(400)
  return snapshot(find(id))
}

// POST /api/orders/{id}/status { status } — avançar ou voltar UMA etapa (Entregue tem endpoint próprio)
const ALLOWED: Partial<Record<OrderStatus, OrderStatus[]>> = {
  NEW: ['IN_PRODUCTION'],
  IN_PRODUCTION: ['READY', 'NEW'],
  READY: ['IN_PRODUCTION'],
}
export async function changeOrderStatus(id: number, to: OrderStatus): Promise<Order> {
  await wait(500)
  const order = find(id)
  if (!ALLOWED[order.status]?.includes(to)) transitionError()
  const from = order.status
  order.status = to
  event(order, 'STATUS_CHANGED', `${from}→${to}`)
  return snapshot(order)
}

// POST /api/orders/{id}/deliver { deliveredOn, receivedBy, note, payment }
// Entrega + pagamento do restante numa transação só.
export async function deliverOrder(id: number, request: DeliverRequest): Promise<Order> {
  await wait(700)
  const order = find(id)
  if (order.status !== 'READY') transitionError()
  const receivedBy = request.receivedBy.trim()
  if (receivedBy.length < 2 || receivedBy.length > 120) fieldError('receivedBy', 'Informe quem recebeu o pedido.')
  if (!isDay(request.deliveredOn)) fieldError('deliveredOn', 'Informe a data da entrega.')
  if (request.deliveredOn > todayIso()) fieldError('deliveredOn', 'A data da entrega não pode ser no futuro.')
  if (request.payment) {
    if (order.remainingCents === 0) throw new ApiError(409, 'ORDER_ALREADY_PAID', 'Este pedido já está pago.')
    validatePayment(request.payment, order.remainingCents, 'payment.amountCents')
    if (request.payment.amountCents !== order.remainingCents) {
      throw new ApiError(422, 'PAYMENT_MUST_SETTLE_BALANCE', `Na entrega, o pagamento é o restante: ${formatMoney(order.remainingCents)}. Pagamento parcial: registre antes em "Registrar pagamento".`)
    }
  }
  order.status = 'DELIVERED'
  order.deliveredOn = request.deliveredOn
  order.deliveredAt = now()
  order.receivedBy = receivedBy
  order.deliveryNote = request.note?.trim() || null
  event(order, 'DELIVERED', receivedBy)
  if (request.payment) pushPayment(order, { ...request.payment, note: 'Restante na entrega' })
  return snapshot(order)
}

// POST /api/orders/{id}/payments { amountCents, method, paidAt, note }  · header Idempotency-Key
export async function addPayment(id: number, request: PaymentRequest, idempotencyKey?: string): Promise<Order> {
  await wait(600)
  if (idempotencyKey && idempotency.has(idempotencyKey)) return snapshot(find(id)) // mesmo clique → mesmo pagamento
  const order = find(id)
  if (order.status === 'CANCELED') throw new ApiError(409, 'ORDER_CANCELED', 'Pedido cancelado não recebe pagamento.')
  if (order.remainingCents <= 0) throw new ApiError(409, 'ORDER_ALREADY_PAID', 'Este pedido já está pago.')
  // No back: SELECT ... FOR UPDATE no pedido antes de conferir o saldo (dois usuários ao mesmo tempo).
  // Aqui o JavaScript roda uma coisa por vez, então conferir e gravar já acontecem "juntos".
  validatePayment(request, order.remainingCents)
  const payment = pushPayment(order, request)
  if (idempotencyKey) idempotency.set(idempotencyKey, payment.id)
  return snapshot(order)
}

// POST /api/orders/{id}/payments/{paymentId}/reverse { reason } — só ADMIN e MANAGER
export async function reversePayment(id: number, paymentId: number, reason: string): Promise<Order> {
  await wait(500)
  const role = readMockSession()?.role
  if (role !== 'ADMIN' && role !== 'MANAGER') throw new ApiError(403, 'FORBIDDEN', 'Você não tem permissão para estornar pagamentos.')
  const order = find(id)
  const payment = order.payments.find((p) => p.id === paymentId)
  if (!payment) throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Pagamento não encontrado.')
  if (payment.reversed) throw new ApiError(409, 'PAYMENT_ALREADY_REVERSED', 'Este pagamento já foi estornado.')
  if (reason.trim().length < 3) fieldError('reason', 'Conte o motivo do estorno.')
  if (order.paidCents - payment.amountCents < order.refundedCents) {
    throw new ApiError(409, 'PAYMENT_HAS_REFUND', 'Este valor já foi devolvido ao cliente. Desfaça a devolução antes de estornar.')
  }
  payment.reversed = true
  payment.reversedReason = reason.trim()
  event(order, 'PAYMENT_REVERSED', `${formatMoney(payment.amountCents)} · ${reason.trim()}`)
  return snapshot(order)
}

// POST /api/orders/{id}/refunds { amountCents, method, refundedAt, reason } — só ADMIN e MANAGER
export async function addRefund(id: number, request: RefundRequest, idempotencyKey?: string): Promise<Order> {
  await wait(500)
  if (idempotencyKey && idempotency.has(idempotencyKey)) return snapshot(find(id))
  const role = readMockSession()?.role
  if (role !== 'ADMIN' && role !== 'MANAGER') throw new ApiError(403, 'FORBIDDEN', 'Você não tem permissão para devolver valores.')
  const order = find(id)
  const available = order.paidCents - order.refundedCents
  if (available <= 0) throw new ApiError(409, 'NOTHING_TO_REFUND', 'Este pedido não tem valor recebido para devolver.')
  if (!Number.isInteger(request.amountCents) || request.amountCents <= 0) fieldError('amountCents', 'Informe um valor maior que R$ 0,00.')
  if (request.amountCents > available) throw new ApiError(422, 'REFUND_EXCEEDS_RECEIVED', 'O valor passou do recebido.', [{ field: 'amountCents', code: 'MAX', message: `O valor não pode ser maior que o recebido (${formatMoney(available)}).` }])
  if (!METHODS.includes(request.method)) fieldError('method', 'Escolha a forma da devolução.')
  if (!isDay(request.refundedAt)) fieldError('refundedAt', 'Informe a data da devolução.')
  if (request.refundedAt > todayIso()) fieldError('refundedAt', 'A data da devolução não pode ser no futuro.')
  const reason = request.reason.trim()
  if (reason.length < 3) fieldError('reason', 'Conte o motivo da devolução.')
  const waivedCents = request.waiveRemaining ? Math.max(0, order.remainingCents) : 0
  const refund = { id: nextRefundId++, amountCents: request.amountCents, method: request.method, refundedAt: request.refundedAt, reason, waivedCents, userName: userName(), createdAt: now(), canceled: false }
  order.refunds.unshift(refund)
  event(order, 'REFUND', `${formatMoney(refund.amountCents)} · ${METHOD_LABEL[refund.method]} · ${reason}${waivedCents ? ` · restante de ${formatMoney(waivedCents)} não será cobrado` : ''}`)
  if (idempotencyKey) idempotency.set(idempotencyKey, refund.id)
  return snapshot(order)
}

// POST /api/orders/{id}/refunds/{refundId}/cancel — devolução lançada por engano
export async function cancelRefund(id: number, refundId: number): Promise<Order> {
  await wait(400)
  const role = readMockSession()?.role
  if (role !== 'ADMIN' && role !== 'MANAGER') throw new ApiError(403, 'FORBIDDEN', 'Você não tem permissão para desfazer devoluções.')
  const order = find(id)
  const refund = order.refunds.find((r) => r.id === refundId)
  if (!refund) throw new ApiError(404, 'REFUND_NOT_FOUND', 'Devolução não encontrada.')
  if (refund.canceled) throw new ApiError(409, 'REFUND_ALREADY_CANCELED', 'Esta devolução já foi desfeita.')
  refund.canceled = true
  event(order, 'REFUND_CANCELED', formatMoney(refund.amountCents))
  return snapshot(order)
}

// POST /api/orders/{id}/collections { channel } — a pessoa abriu a cobrança no WhatsApp (quem envia é ela)
export async function registerCollection(id: number): Promise<Order> {
  await wait(300)
  const order = find(id)
  if (order.status === 'CANCELED' || order.remainingCents <= 0) transitionError()
  order.lastCollectionAt = now()
  event(order, 'COLLECTION', 'WHATSAPP')
  return snapshot(order)
}

// POST /api/orders/{id}/cancel { reason }
export async function cancelOrder(id: number, reason: string): Promise<Order> {
  await wait(600)
  const order = find(id)
  if (!ACTIVE.includes(order.status)) transitionError()
  if (reason.trim().length < 3) fieldError('reason', 'Informe o motivo do cancelamento.')
  order.status = 'CANCELED'
  order.canceledAt = now()
  order.cancelReason = reason.trim()
  event(order, 'CANCELED', order.cancelReason)
  mockMarkQuoteRejected(order.quote.id, order.cancelReason) // o orçamento de origem fica "Recusado"
  return snapshot(order)
}

// ---------- HU27: gastos do serviço (só ADMIN e MANAGER) ----------
function forbidIfEmployee() {
  if (!seesProfit()) throw new ApiError(403, 'FORBIDDEN', 'Só Administrador e Gerente podem ver e lançar gastos.')
}

function validateExpense(r: ExpenseRequest): ExpenseRequest {
  const errors: FieldError[] = []
  const description = (r.description ?? '').trim() || null // PO 11/10: sem descrição na tela (campo opcional)
  if (r.type !== 'MATERIAL' && r.type !== 'LABOR') errors.push({ field: 'type', code: 'REQUIRED', message: 'Escolha Material ou Mão de obra.' })
  if (description && description.length > 120) errors.push({ field: 'description', code: 'SIZE', message: 'Descreva o gasto (2 a 120 letras).' })
  if (!Number.isInteger(r.amountCents) || r.amountCents <= 0) errors.push({ field: 'amountCents', code: 'POSITIVE', message: 'Informe um valor maior que zero.' })
  else if (r.amountCents > 100_000_000) errors.push({ field: 'amountCents', code: 'MAX', message: 'Valor alto demais. Confira os números.' })
  if (!isDay(r.date)) errors.push({ field: 'date', code: 'REQUIRED', message: 'Informe a data do gasto.' })
  else if (r.date > todayIso()) errors.push({ field: 'date', code: 'PAST', message: 'A data do gasto não pode ser no futuro.' })
  if (errors.length) throw new ApiError(400, 'VALIDATION_ERROR', 'Existem campos inválidos.', errors)
  return { ...r, description }
}

function findExpense(order: Order, expenseId: number): OrderExpense {
  const expense = order.expenses?.find((e) => e.id === expenseId)
  if (!expense) throw new ApiError(404, 'EXPENSE_NOT_FOUND', 'Gasto não encontrado.')
  return expense
}

// POST /api/orders/{id}/expenses
export async function addExpense(id: number, request: ExpenseRequest): Promise<Order> {
  await wait(500)
  forbidIfEmployee()
  const order = find(id)
  const r = validateExpense(request)
  order.expenses ??= []
  // Regra do cliente: cada pedido tem UM valor de material. Mudou? Edita, não soma outro.
  if (r.type === 'MATERIAL' && order.expenses.some((e) => e.type === 'MATERIAL')) {
    throw new ApiError(409, 'MATERIAL_ALREADY_SET', 'Este pedido já tem material lançado. Use "Editar" para mudar o valor.')
  }
  order.expenses.push({ id: nextExpenseId++, type: r.type, description: r.description, amountCents: r.amountCents, date: r.date, userName: userName(), createdAt: now() })
  return snapshot(order)
}

// PUT /api/orders/{id}/expenses/{expenseId}
export async function updateExpense(id: number, expenseId: number, request: ExpenseRequest): Promise<Order> {
  await wait(500)
  forbidIfEmployee()
  const order = find(id)
  const expense = findExpense(order, expenseId)
  const r = validateExpense(request)
  Object.assign(expense, { type: r.type, description: r.description, amountCents: r.amountCents, date: r.date })
  return snapshot(order)
}

// DELETE /api/orders/{id}/expenses/{expenseId}
export async function deleteExpense(id: number, expenseId: number): Promise<Order> {
  await wait(400)
  forbidIfEmployee()
  const order = find(id)
  findExpense(order, expenseId)
  order.expenses = order.expenses!.filter((e) => e.id !== expenseId)
  return snapshot(order)
}

// ---------- HU29: nota fiscal ----------
const invoiceFiles = new Map<number, File>() // no back: arquivo guardado no servidor
const INVOICE_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

// PUT /api/orders/{id}/invoice — só ADMIN e MANAGER
export async function saveInvoice(id: number, request: InvoiceRequest): Promise<Order> {
  await wait(400)
  forbidIfEmployee()
  const order = find(id)
  if (order.status === 'CANCELED') throw new ApiError(409, 'ORDER_CANCELLED', 'Pedido cancelado não recebe nota.')
  const number = request.number.trim()
  const errors: FieldError[] = []
  if (!/^[\p{L}\p{N}]{1,20}$/u.test(number)) errors.push({ field: 'number', code: 'INVALID', message: 'Informe o número da nota.' })
  if (!request.issuedAt) errors.push({ field: 'issuedAt', code: 'REQUIRED', message: 'Informe a data da nota.' })
  else if (request.issuedAt > todayIso()) errors.push({ field: 'issuedAt', code: 'FUTURE', message: 'A data da nota não pode ser no futuro.' })
  if (!['SERVICE', 'PRODUCT', 'BOTH'].includes(request.type)) errors.push({ field: 'type', code: 'INVALID', message: 'Escolha o tipo da nota.' })
  if ((request.notes ?? '').length > 300) errors.push({ field: 'notes', code: 'SIZE', message: 'Máximo de 300 caracteres.' })
  if (errors.length) throw new ApiError(400, 'VALIDATION_ERROR', 'Existem campos inválidos.', errors)
  order.invoice = { number, issuedAt: request.issuedAt, type: request.type, notes: request.notes?.trim() || null, hasFile: order.invoice?.hasFile ?? false, updatedBy: userName(), updatedAt: now() }
  return snapshot(order)
}

// POST /api/orders/{id}/invoice/file (multipart "file")
export async function uploadInvoiceFile(id: number, file: File): Promise<Order> {
  await wait(400)
  forbidIfEmployee()
  const order = find(id)
  if (!order.invoice) throw new ApiError(409, 'INVOICE_NOT_FOUND', 'Anote a nota antes de enviar o arquivo.')
  if (!INVOICE_FILE_TYPES.includes(file.type) || file.size > 5 * 1024 * 1024) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Existem campos inválidos.', [{ field: 'file', code: 'INVALID', message: 'Envie um PDF ou foto de até 5 MB.' }])
  }
  invoiceFiles.set(id, file)
  order.invoice.hasFile = true
  return snapshot(order)
}

// GET /api/orders/{id}/invoice/file
export async function getInvoiceFile(id: number): Promise<File | null> {
  await wait(200)
  return invoiceFiles.get(id) ?? null
}
