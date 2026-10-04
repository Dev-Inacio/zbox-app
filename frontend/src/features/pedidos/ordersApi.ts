import { ApiError } from '../auth/types'
import type { FieldError } from '../auth/types'
import { readMockSession } from '../auth/session'
import type { Page } from '../clientes/types'
import { formatMoney } from '../orcamentos/money'
import { mockCreateApprovedQuote, mockMarkQuoteConverted, mockQuoteForConversion } from '../orcamentos/quotesApi'
import type { Quote, QuoteItem } from '../orcamentos/types'
import { addDaysIso, todayIso } from './dates'
import { METHOD_LABEL, METHODS } from './labels'
import type {
  ConvertToOrderRequest,
  DeliverRequest,
  ListOrdersParams,
  Order,
  OrderCounts,
  OrderEvent,
  OrderStatus,
  OrderSummary,
  PaymentMethod,
  PaymentRequest,
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
const daysAgoIso = (days: number) => new Date(Date.now() - days * 86400000).toISOString()

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const store = new Map<number, Order>()
let nextOrderId = 1
let nextNumber = 40
let nextPaymentId = 1
let nextEventId = 1
// Idempotency-Key → pagamento já criado (o back guarda por 24 h). Evita pagamento duplicado no duplo clique.
const idempotency = new Map<string, number>()

const ACTIVE: OrderStatus[] = ['NEW', 'IN_PRODUCTION', 'READY']

// ---------- Regras de dinheiro (no back real: no Service, dentro da transação) ----------
function recompute(order: Order) {
  order.paidCents = order.payments.filter((p) => !p.reversed).reduce((sum, p) => sum + p.amountCents, 0)
  order.remainingCents = order.totalCents - order.paidCents
  order.paymentStatus =
    order.remainingCents <= 0 ? 'PAID'
      : order.status === 'DELIVERED' ? 'OVERDUE'
        : order.paidCents > 0 ? 'PARTIAL'
          : 'UNPAID'
}

function snapshot(order: Order): Order {
  recompute(order)
  return structuredClone(order)
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
    customer: structuredClone(quote.customer),
    items: structuredClone(quote.items) as QuoteItem[],
    subtotalCents: quote.subtotalCents, discountCents: quote.discountCents, totalCents: quote.totalCents,
    paidCents: 0, remainingCents: quote.totalCents,
    paymentTerms: quote.paymentTerms, notes: quote.notes,
    createdAt,
    deliveredAt: null, deliveredOn: null, receivedBy: null, deliveryNote: null, canceledAt: null, cancelReason: null,
    payments: [], lastCollectionAt: null, events: [],
  }
}

function toSummary(o: Order): OrderSummary {
  return {
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

// ---------- Dados de exemplo (datas relativas a hoje) ----------
type SeedPayment = { amountCents: number; method: PaymentMethod; daysAgo: number; note?: string }
type Seed = {
  customerId: number; createdDaysAgo: number; status: OrderStatus
  items: Omit<QuoteItem, 'id' | 'areaPerPieceCm2' | 'subtotalCents'>[]
  payments?: SeedPayment[]; deliveredDaysAgo?: number; receivedBy?: string; collectedDaysAgo?: number; half?: boolean
}

function seed() {
  const seeds: Seed[] = [
    { customerId: 1, createdDaysAgo: 60, status: 'DELIVERED', deliveredDaysAgo: 40, receivedBy: 'Síndico Paulo', half: true,
      items: [{ description: 'Janela de correr 2 folhas (fachada)', chargeType: 'AREA', quantity: 12, unit: null, widthCm: 150, heightCm: 120, unitPriceCents: 62000 }],
      payments: [{ amountCents: 0, method: 'TRANSFER', daysAgo: 40, note: 'Restante na entrega' }] },
    { customerId: 5, createdDaysAgo: 50, status: 'DELIVERED', deliveredDaysAgo: 35, receivedBy: 'Dra. Helena', collectedDaysAgo: 22, half: true,
      items: [
        { description: 'Box de vidro temperado 8 mm', chargeType: 'AREA', quantity: 4, unit: null, widthCm: 120, heightCm: 190, unitPriceCents: 42000 },
        { description: 'Espelho bisotê', chargeType: 'UNIT', quantity: 1, unit: 'un', widthCm: null, heightCm: null, unitPriceCents: 36960 },
      ] },
    { customerId: 6, createdDaysAgo: 30, status: 'DELIVERED', deliveredDaysAgo: 22, receivedBy: 'Roberto',
      items: [{ description: 'Portão de garagem', chargeType: 'AREA', quantity: 1, unit: null, widthCm: 300, heightCm: 220, unitPriceCents: 47000 }] },
    { customerId: 4, createdDaysAgo: 20, status: 'IN_PRODUCTION', half: true,
      items: [{ description: 'Fachada de vidro da loja', chargeType: 'UNIT', quantity: 1, unit: 'conj', widthCm: null, heightCm: null, unitPriceCents: 420000 }] },
    { customerId: 8, createdDaysAgo: 10, status: 'READY',
      items: [
        { description: 'Porta de abrir alumínio', chargeType: 'AREA', quantity: 1, unit: null, widthCm: 80, heightCm: 210, unitPriceCents: 70000 },
        { description: 'Janela maxim-ar banheiro', chargeType: 'AREA', quantity: 1, unit: null, widthCm: 60, heightCm: 60, unitPriceCents: 90000 },
      ],
      payments: [{ amountCents: -1, method: 'PIX', daysAgo: 1, note: 'À vista' }] },
    { customerId: 10, createdDaysAgo: 2, status: 'NEW',
      payments: [{ amountCents: 200000, method: 'CASH', daysAgo: 2, note: 'Entrada' }],
      items: [
        { description: 'Janela maxim-ar 60 × 60', chargeType: 'AREA', quantity: 6, unit: null, widthCm: 60, heightCm: 60, unitPriceCents: 90000 },
        { description: 'Porta pivotante de alumínio', chargeType: 'UNIT', quantity: 1, unit: 'un', widthCm: null, heightCm: null, unitPriceCents: 459600 },
      ] },
  ]

  for (const s of seeds) {
    const quote = mockCreateApprovedQuote(s.customerId, s.items, s.createdDaysAgo + 2)
    if (!quote) continue
    const created = daysAgoIso(s.createdDaysAgo)
    const order = fromQuote(quote, created)
    event(order, 'CREATED', `${quote.number} v1`, created, 'Thayná')
    const half = Math.round(order.totalCents / 2)
    if (s.half) pushPayment(order, { amountCents: half, method: 'PIX', paidAt: addDaysIso(todayIso(), -s.createdDaysAgo), note: 'Entrada' }, created, 'Thayná')

    const steps: OrderStatus[] = ['IN_PRODUCTION', 'READY', 'DELIVERED']
    const target = steps.indexOf(s.status)
    for (let i = 0; i < steps.length && i <= target; i++) {
      const to = steps[i]
      if (to === 'DELIVERED') {
        const day = addDaysIso(todayIso(), -(s.deliveredDaysAgo ?? 0))
        order.status = 'DELIVERED'
        order.deliveredOn = day
        order.deliveredAt = daysAgoIso(s.deliveredDaysAgo ?? 0)
        order.receivedBy = s.receivedBy ?? null
        event(order, 'DELIVERED', s.receivedBy ?? null, order.deliveredAt, 'Inácio')
      } else {
        const from = order.status
        order.status = to
        event(order, 'STATUS_CHANGED', `${from}→${to}`, daysAgoIso(Math.max(0, s.createdDaysAgo - (i + 1) * 3)), 'Inácio')
      }
    }
    for (const p of s.payments ?? []) {
      recompute(order)
      const amount = p.amountCents <= 0 ? order.remainingCents : p.amountCents
      pushPayment(order, { amountCents: amount, method: p.method, paidAt: addDaysIso(todayIso(), -p.daysAgo), note: p.note }, daysAgoIso(p.daysAgo), 'Thayná')
    }
    if (s.collectedDaysAgo !== undefined) {
      order.lastCollectionAt = daysAgoIso(s.collectedDaysAgo)
      event(order, 'COLLECTION', 'WHATSAPP', order.lastCollectionAt, 'Thayná')
    }
    order.events.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    recompute(order)
    store.set(order.id, order)
    mockMarkQuoteConverted(quote.id, { id: order.id, number: order.number }, created)
  }
}
seed()

// Para o mock do Financeiro e do Início (no back real, são consultas no mesmo banco)
export function mockAllOrders(): Order[] {
  return [...store.values()].map(snapshot)
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
  payment.reversed = true
  payment.reversedReason = reason.trim()
  event(order, 'PAYMENT_REVERSED', `${formatMoney(payment.amountCents)} · ${reason.trim()}`)
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
  return snapshot(order)
}
