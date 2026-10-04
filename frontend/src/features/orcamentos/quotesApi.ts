import { ApiError } from '../auth/types'
import type { FieldError } from '../auth/types'
import { readMockSession } from '../auth/session'
import { mockFindCustomer } from '../clientes/customersApi'
import type { Customer, Page } from '../clientes/types'
import { discountCents, formatMoney, itemSubtotalCents, validateDiscount } from './money'
import type {
  ApprovalMethod,
  DispatchChannel,
  ListQuotesParams,
  Quote,
  QuoteCounts,
  QuoteCustomer,
  QuoteEvent,
  QuoteItem,
  QuoteRequest,
  QuoteStatus,
  QuoteSummary,
  RejectionReason,
} from './types'

// ⚠️ SIMULAÇÃO (mock) — enquanto o Inácio não publica /api/quotes.
// Este arquivo faz o papel do BACK: valida, recalcula os valores e controla as transições de status.
// Assim a tela já se comporta como vai se comportar de verdade.
// Na integração, cada função vira um fetch e as regras saem daqui (passam a ser do back).
//
// Testar estados: /orcamentos?simular=erro  |  /orcamentos?simular=vazio

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const simulation = () => new URLSearchParams(window.location.search).get('simular')
const userName = () => readMockSession()?.name ?? 'Usuário'
const now = () => new Date().toISOString()

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Cada orçamento guarda TODAS as versões. A última é a atual.
type StoredQuote = { versions: Quote[] }
const store = new Map<number, StoredQuote>()
let nextQuoteId = 1
let nextNumber = 120
let nextItemId = 1
let nextEventId = 1

function toQuoteCustomer(c: Customer): QuoteCustomer {
  const a = c.address
  const parts = [
    [a.street, a.number].filter(Boolean).join(', '),
    a.district,
    [a.city, a.state].filter(Boolean).join('/'),
  ].filter(Boolean)
  return { id: c.id, name: c.name, whatsapp: c.whatsapp, phone: c.phone, addressLine: parts.length ? parts.join(' · ') : null }
}

function event(quote: Quote, type: QuoteEvent['type'], detail: string | null = null) {
  quote.events.unshift({ id: nextEventId++, type, version: quote.version, detail, userName: userName(), createdAt: now() })
}

// O "back" recalcula tudo. O que veio do navegador como total é ignorado (nem existe no request).
function recalc(quote: Quote) {
  for (const item of quote.items) {
    item.areaPerPieceCm2 = item.chargeType === 'AREA' ? (item.widthCm ?? 0) * (item.heightCm ?? 0) : null
    item.subtotalCents = itemSubtotalCents(item)
  }
  quote.subtotalCents = quote.items.reduce((s, i) => s + i.subtotalCents, 0)
  quote.discountCents = discountCents(quote.subtotalCents, quote.discountType, quote.discountValue)
  quote.totalCents = quote.subtotalCents - quote.discountCents
}

function latest(id: number): Quote {
  const stored = store.get(id)
  if (!stored) throw new ApiError(404, 'QUOTE_NOT_FOUND', 'Orçamento não encontrado.')
  return stored.versions[stored.versions.length - 1]
}

function transitionError(): never {
  throw new ApiError(409, 'INVALID_QUOTE_STATUS_TRANSITION', 'Esta ação não vale para a situação atual do orçamento.')
}

function requireStatus(quote: Quote, ...allowed: QuoteStatus[]) {
  if (!allowed.includes(quote.status)) transitionError()
}

function snapshot(quote: Quote): Quote {
  const stored = store.get(quote.id)!
  return structuredClone({ ...quote, latestVersion: stored.versions.length })
}

// ---------- Dados de exemplo ----------
function seed() {
  const samples: { customerId: number; status: QuoteStatus; daysAgo: number; items: Omit<QuoteItem, 'id' | 'areaPerPieceCm2' | 'subtotalCents'>[]; discount?: number }[] = [
    { customerId: 9, status: 'SENT', daysAgo: 0, discount: 500, items: [
      { description: 'Porta pivotante de alumínio', chargeType: 'AREA', quantity: 1, unit: null, widthCm: 100, heightCm: 210, unitPriceCents: 71500 },
      { description: 'Janela de correr 2 folhas', chargeType: 'AREA', quantity: 2, unit: null, widthCm: 120, heightCm: 100, unitPriceCents: 85000 },
    ] },
    { customerId: 2, status: 'APPROVED', daysAgo: 12, items: [
      { description: 'Portão basculante', chargeType: 'AREA', quantity: 1, unit: null, widthCm: 300, heightCm: 250, unitPriceCents: 69000 },
    ] },
    { customerId: 5, status: 'CONFIRMED', daysAgo: 3, items: [
      { description: 'Box de vidro temperado 8 mm', chargeType: 'AREA', quantity: 1, unit: null, widthCm: 120, heightCm: 190, unitPriceCents: 42000 },
    ] },
    { customerId: 3, status: 'REJECTED', daysAgo: 25, items: [
      { description: 'Grade de proteção', chargeType: 'AREA', quantity: 3, unit: null, widthCm: 100, heightCm: 120, unitPriceCents: 38000 },
    ] },
    { customerId: 7, status: 'DRAFT', daysAgo: 1, items: [] },
  ]
  for (const s of samples) {
    const customer = mockFindCustomer(s.customerId)
    if (!customer) continue
    const created = new Date(Date.now() - s.daysAgo * 86400000).toISOString()
    const quote: Quote = {
      id: nextQuoteId++, number: String(nextNumber++).padStart(6, '0'), version: 1, latestVersion: 1, status: s.status,
      customer: toQuoteCustomer(customer),
      items: s.items.map((i) => ({ ...i, id: nextItemId++, areaPerPieceCm2: null, subtotalCents: 0 })),
      subtotalCents: 0, discountType: s.discount ? 'PERCENT' : null, discountValue: s.discount ?? null, discountCents: 0, totalCents: 0,
      paymentTerms: '50% de entrada e 50% na entrega', notes: 'Prazo de fabricação: 15 dias úteis após a aprovação.', versionReason: null,
      createdAt: created, updatedAt: created, confirmedAt: s.status === 'DRAFT' ? null : created,
      sentAt: ['SENT', 'APPROVED', 'REJECTED'].includes(s.status) ? created : null,
      decidedAt: ['APPROVED', 'REJECTED'].includes(s.status) ? created : null,
      approvalMethod: s.status === 'APPROVED' ? 'WHATSAPP' : null,
      rejectionReason: s.status === 'REJECTED' ? 'PRICE' : null,
      decisionNote: null,
      events: [{ id: nextEventId++, type: 'CREATED', version: 1, detail: null, userName: 'Thayná', createdAt: created }],
    }
    recalc(quote)
    store.set(quote.id, { versions: [quote] })
  }
}
seed()

// ---------- Endpoints ----------

// GET /api/quotes?search=&status=&period=&customerId=&page=0&size=20
export async function listQuotes(params: ListQuotesParams): Promise<Page<QuoteSummary>> {
  await wait(500)
  const sim = simulation()
  if (sim === 'erro') throw new TypeError('Failed to fetch')

  const term = normalize(params.search.trim())
  const digits = params.search.replace(/\D/g, '')
  const minDate = params.period === 'LAST_30' ? Date.now() - 30 * 86400000 : params.period === 'LAST_90' ? Date.now() - 90 * 86400000 : 0

  const all = sim === 'vazio' ? [] : [...store.keys()].map(latest)
  const filtered = all
    .filter((q) => params.customerId === undefined || q.customer.id === params.customerId)
    .filter((q) => params.status === 'ALL' || q.status === params.status)
    .filter((q) => new Date(q.createdAt).getTime() >= minDate)
    .filter((q) => {
      if (term.length < 2) return true
      if (digits.length >= 2 && q.number.includes(digits)) return true
      return normalize(q.customer.name).includes(term)
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const start = params.page * params.size
  return {
    content: filtered.slice(start, start + params.size).map((q) => ({
      id: q.id, number: q.number, version: q.version, customerName: q.customer.name, createdAt: q.createdAt, totalCents: q.totalCents, status: q.status,
    })),
    page: params.page,
    size: params.size,
    totalElements: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / params.size)),
  }
}

// GET /api/quotes/counts — números dos filtros de status
export async function countQuotes(): Promise<QuoteCounts> {
  await wait(300)
  const counts: QuoteCounts = { ALL: 0, DRAFT: 0, CONFIRMED: 0, SENT: 0, APPROVED: 0, REJECTED: 0, CANCELED: 0 }
  if (simulation() === 'vazio') return counts
  for (const id of store.keys()) {
    const q = latest(id)
    if (q.status === 'SUPERSEDED') continue
    counts[q.status] += 1
    counts.ALL += 1
  }
  return counts
}

// POST /api/quotes { customerId } → 201 rascunho v1
export async function createQuote(customerId: number): Promise<Quote> {
  await wait(600)
  const customer = mockFindCustomer(customerId)
  if (!customer) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado.')
  if (customer.status === 'INACTIVE') throw new ApiError(409, 'CUSTOMER_INACTIVE', 'Cliente desativado não pode receber orçamento.')
  const created = now()
  const quote: Quote = {
    id: nextQuoteId++, number: String(nextNumber++).padStart(6, '0'), version: 1, latestVersion: 1, status: 'DRAFT',
    customer: toQuoteCustomer(customer), items: [], subtotalCents: 0, discountType: null, discountValue: null, discountCents: 0, totalCents: 0,
    paymentTerms: null, notes: null, versionReason: null, createdAt: created, updatedAt: created,
    confirmedAt: null, sentAt: null, decidedAt: null, approvalMethod: null, rejectionReason: null, decisionNote: null, events: [],
  }
  event(quote, 'CREATED')
  store.set(quote.id, { versions: [quote] })
  return snapshot(quote)
}

// GET /api/quotes/{id}?version=n
export async function getQuote(id: number, version?: number): Promise<Quote> {
  await wait(400)
  const stored = store.get(id)
  if (!stored) throw new ApiError(404, 'QUOTE_NOT_FOUND', 'Orçamento não encontrado.')
  const quote = version ? stored.versions.find((v) => v.version === version) : stored.versions[stored.versions.length - 1]
  if (!quote) throw new ApiError(404, 'QUOTE_VERSION_NOT_FOUND', 'Versão não encontrada.')
  return snapshot(quote)
}

// Validação do "back" para PUT
function validateRequest(request: QuoteRequest) {
  const errors: FieldError[] = []
  if (request.items.length > 100) errors.push({ field: 'items', code: 'MAX', message: 'Máximo de 100 itens.' })
  request.items.forEach((item, i) => {
    const f = (name: string) => `items[${i}].${name}`
    const desc = item.description.trim()
    if (desc.length < 2) errors.push({ field: f('description'), code: 'SIZE', message: 'Descreva o item.' })
    if (desc.length > 200) errors.push({ field: f('description'), code: 'SIZE', message: 'Máximo de 200 caracteres.' })
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 9999) errors.push({ field: f('quantity'), code: 'RANGE', message: 'Quantidade de 1 a 9.999.' })
    if (!Number.isInteger(item.unitPriceCents) || item.unitPriceCents <= 0) errors.push({ field: f('unitPriceCents'), code: 'POSITIVE', message: 'Informe um preço maior que zero.' })
    if (item.chargeType === 'AREA') {
      for (const dim of ['widthCm', 'heightCm'] as const) {
        const v = item[dim]
        if (v === null || !Number.isInteger(v) || v < 1 || v > 2000) errors.push({ field: f(dim), code: 'RANGE', message: 'Medida de 0,01 a 20,00 m.' })
      }
    }
  })
  if (errors.length) throw new ApiError(400, 'VALIDATION_ERROR', 'Existem campos inválidos.', errors)
}

// PUT /api/quotes/{id} — só em RASCUNHO
export async function updateQuote(id: number, request: QuoteRequest): Promise<Quote> {
  await wait(600)
  const quote = latest(id)
  if (quote.status !== 'DRAFT') throw new ApiError(409, 'QUOTE_NOT_EDITABLE', 'Só é possível editar orçamento em rascunho.')
  validateRequest(request)

  quote.items = request.items.map((i) => ({
    ...i,
    description: i.description.trim(),
    unit: i.chargeType === 'UNIT' ? (i.unit ?? 'un') : null,
    widthCm: i.chargeType === 'AREA' ? i.widthCm : null,
    heightCm: i.chargeType === 'AREA' ? i.heightCm : null,
    id: nextItemId++, areaPerPieceCm2: null, subtotalCents: 0,
  }))
  quote.discountType = request.discountValue ? request.discountType : null
  quote.discountValue = request.discountValue || null
  quote.paymentTerms = request.paymentTerms?.trim() || null
  quote.notes = request.notes?.trim() || null
  recalc(quote)

  const discountError = validateDiscount(quote.subtotalCents, quote.discountType, quote.discountValue)
  if (discountError === 'GREATER_THAN_SUBTOTAL') throw new ApiError(422, 'DISCOUNT_GREATER_THAN_SUBTOTAL', 'O desconto não pode ser maior que o subtotal.')
  if (discountError === 'PERCENT_OVER_100') throw new ApiError(422, 'DISCOUNT_PERCENT_OVER_100', 'O desconto não pode passar de 100%.')
  if (discountError === 'NEGATIVE') throw new ApiError(422, 'DISCOUNT_NEGATIVE', 'O desconto não pode ser negativo.')

  quote.updatedAt = now()
  event(quote, 'UPDATED')
  return snapshot(quote)
}

// POST /api/quotes/{id}/confirm — idempotente (duplo clique não confirma duas vezes)
export async function confirmQuote(id: number): Promise<Quote> {
  await wait(700)
  const quote = latest(id)
  if (quote.status === 'CONFIRMED') return snapshot(quote)
  requireStatus(quote, 'DRAFT')
  if (quote.items.length === 0) throw new ApiError(422, 'QUOTE_CANNOT_BE_CONFIRMED', 'Adicione pelo menos 1 item.')
  if (quote.totalCents <= 0) throw new ApiError(422, 'QUOTE_CANNOT_BE_CONFIRMED', 'O valor final precisa ser maior que R$ 0,00.')
  const customer = mockFindCustomer(quote.customer.id)
  if (customer?.status === 'INACTIVE') throw new ApiError(422, 'QUOTE_CANNOT_BE_CONFIRMED', 'O cliente está desativado.')
  quote.status = 'CONFIRMED'
  quote.confirmedAt = now()
  event(quote, 'CONFIRMED', formatMoney(quote.totalCents))
  return snapshot(quote)
}

// POST /api/quotes/{id}/back-to-draft — só CONFIRMADO (ainda não enviado)
export async function backToDraft(id: number): Promise<Quote> {
  await wait(500)
  const quote = latest(id)
  requireStatus(quote, 'CONFIRMED')
  quote.status = 'DRAFT'
  quote.confirmedAt = null
  event(quote, 'BACK_TO_DRAFT')
  return snapshot(quote)
}

// POST /api/quotes/{id}/dispatches { channel } — o 1º envio muda CONFIRMADO → ENVIADO
export async function registerDispatch(id: number, channel: DispatchChannel): Promise<Quote> {
  await wait(300)
  const quote = latest(id)
  requireStatus(quote, 'CONFIRMED', 'SENT')
  if (quote.status === 'CONFIRMED') {
    quote.status = 'SENT'
    quote.sentAt = now()
  }
  event(quote, 'DISPATCHED', channel)
  return snapshot(quote)
}

// POST /api/quotes/{id}/approve { method }
export async function approveQuote(id: number, method: ApprovalMethod): Promise<Quote> {
  await wait(600)
  const quote = latest(id)
  requireStatus(quote, 'SENT')
  quote.status = 'APPROVED'
  quote.approvalMethod = method
  quote.decidedAt = now()
  event(quote, 'APPROVED', method)
  return snapshot(quote)
}

// POST /api/quotes/{id}/reject { reason, note }
export async function rejectQuote(id: number, reason: RejectionReason, note: string | null): Promise<Quote> {
  await wait(600)
  const quote = latest(id)
  requireStatus(quote, 'SENT')
  quote.status = 'REJECTED'
  quote.rejectionReason = reason
  quote.decisionNote = note?.trim() || null
  quote.decidedAt = now()
  event(quote, 'REJECTED', [reason, quote.decisionNote].filter(Boolean).join(': '))
  return snapshot(quote)
}

// POST /api/quotes/{id}/cancel { reason }
export async function cancelQuote(id: number, reason: string): Promise<Quote> {
  await wait(600)
  const quote = latest(id)
  requireStatus(quote, 'DRAFT', 'CONFIRMED', 'SENT')
  if (reason.trim().length < 3) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Informe o motivo.', [{ field: 'reason', code: 'SIZE', message: 'Informe o motivo do cancelamento.' }])
  }
  quote.status = 'CANCELED'
  quote.decisionNote = reason.trim()
  quote.decidedAt = now()
  event(quote, 'CANCELED', quote.decisionNote)
  return snapshot(quote)
}

// POST /api/quotes/{id}/versions { reason } — só ENVIADO ou RECUSADO
export async function createVersion(id: number, reason: string | null): Promise<Quote> {
  await wait(700)
  const stored = store.get(id)
  const current = latest(id)
  requireStatus(current, 'SENT', 'REJECTED')
  current.status = 'SUPERSEDED'
  event(current, 'NEW_VERSION', `v${current.version + 1}`)

  const created = now()
  const next: Quote = {
    ...structuredClone(current),
    version: current.version + 1,
    status: 'DRAFT',
    items: current.items.map((i) => ({ ...structuredClone(i), id: nextItemId++ })),
    versionReason: reason?.trim() || null,
    updatedAt: created, confirmedAt: null, sentAt: null, decidedAt: null,
    approvalMethod: null, rejectionReason: null, decisionNote: null,
    events: [],
  }
  event(next, 'NEW_VERSION', next.versionReason)
  stored!.versions.push(next)
  return snapshot(next)
}
