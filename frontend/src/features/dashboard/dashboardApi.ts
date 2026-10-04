import { countQuotes, mockQuoteEvents } from '../orcamentos/quotesApi'
import type { QuoteEvent } from '../orcamentos/types'
import { ORDER_STATUS_LABEL } from '../pedidos/labels'
import { daysBetween, isoDateTimeToDay, todayIso } from '../pedidos/dates'
import { mockAllOrders } from '../pedidos/ordersApi'
import type { Order, OrderEvent, OrderStatus } from '../pedidos/types'

// ⚠️ SIMULAÇÃO (mock) — o conteúdo das seções e o endpoint ainda serão definidos
// pela PO e pelo Back-end (HU04/HU05). Os números abaixo são só exemplos.
//
// Para testar os estados, coloque na URL do navegador:
//   ?recentes=vazio     ?recentes=erro   (Recentes: histórico de pedidos e orçamentos)
//   ?inicio=erro        (números, "não pagaram" e "em andamento": GET /api/dashboard)

// ---------- HU05: Recentes ----------
// Montado a partir do histórico REAL de pedidos e orçamentos (antes eram frases de exemplo,
// que contradiziam os pedidos: "Pedido #0044 entregue" com o #000044 ainda "Pronto").

export type ActivityTone = 'neutral' | 'warn' | 'ok' | 'danger'

export type ActivityItem = {
  id: string
  kind: 'orcamento' | 'pagamento' | 'pedido'
  title: string
  detail: string
  badge: { label: string; tone: ActivityTone }
  to: string // link para o pedido/orçamento
  when: string
}

type Draft = Omit<ActivityItem, 'when'> & { at: string }

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// "há 10 min", "há 3 h", "ontem", "há 5 dias", "12/09"
function relativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  if (days < 30) return `há ${days} dias`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fromOrder(o: Order, ev: OrderEvent): Draft | null {
  const base = { id: `o${ev.id}`, kind: 'pedido' as const, to: `/pedidos/${o.id}`, at: ev.createdAt }
  const by = `${o.customer.name} · por ${ev.userName}`
  switch (ev.type) {
    case 'CREATED':
      return { ...base, title: `Pedido #${o.number} criado`, detail: by, badge: { label: 'Novo', tone: 'neutral' } }
    case 'STATUS_CHANGED': {
      const to = (ev.detail ?? '').split('→')[1] as OrderStatus
      const label = ORDER_STATUS_LABEL[to] ?? 'Andamento'
      if (to === 'READY') return { ...base, title: `Pedido #${o.number} pronto`, detail: by, badge: { label, tone: 'ok' } }
      return { ...base, title: `Pedido #${o.number}: ${label.toLowerCase()}`, detail: by, badge: { label, tone: 'neutral' } }
    }
    case 'DELIVERED':
      return { ...base, title: `Pedido #${o.number} entregue`, detail: `Recebido por ${ev.detail ?? '—'} · por ${ev.userName}`, badge: { label: 'Entregue', tone: 'ok' } }
    case 'PAYMENT':
      return { ...base, kind: 'pagamento', title: `Pagamento no pedido #${o.number}`, detail: `${ev.detail ?? ''} · por ${ev.userName}`, badge: { label: 'Recebido', tone: 'ok' } }
    case 'PAYMENT_REVERSED':
      return { ...base, kind: 'pagamento', title: `Pagamento estornado no pedido #${o.number}`, detail: `${ev.detail ?? ''} · por ${ev.userName}`, badge: { label: 'Estornado', tone: 'danger' } }
    case 'COLLECTION':
      return { ...base, kind: 'pagamento', title: `Cobrança enviada · pedido #${o.number}`, detail: by, badge: { label: 'Cobrado', tone: 'warn' } }
    case 'CANCELED':
      return { ...base, title: `Pedido #${o.number} cancelado`, detail: by, badge: { label: 'Cancelado', tone: 'danger' } }
    default:
      return null // mudança de prazo não entra no resumo
  }
}

const DISPATCH_TITLE: Record<string, (n: string) => string> = {
  WHATSAPP: (n) => `Orçamento #${n} enviado pelo WhatsApp`,
  PDF: (n) => `PDF do orçamento #${n} gerado`,
  PRINT: (n) => `Orçamento #${n} impresso`,
}

function fromQuote(q: { quoteId: number; number: string; customerName: string; event: QuoteEvent }): Draft | null {
  const ev = q.event
  const base = { id: `q${ev.id}`, kind: 'orcamento' as const, to: `/orcamentos/${q.quoteId}`, at: ev.createdAt }
  const by = `${q.customerName} · por ${ev.userName}`
  switch (ev.type) {
    case 'CREATED':
      return { ...base, title: `Orçamento #${q.number} criado`, detail: by, badge: { label: 'Rascunho', tone: 'neutral' } }
    case 'CONFIRMED':
      return { ...base, title: `Orçamento #${q.number} confirmado`, detail: by, badge: { label: 'Confirmado', tone: 'neutral' } }
    case 'DISPATCHED':
      return { ...base, title: (DISPATCH_TITLE[ev.detail ?? ''] ?? DISPATCH_TITLE.WHATSAPP)(q.number), detail: by, badge: { label: 'Enviado', tone: 'neutral' } }
    case 'APPROVED':
      return { ...base, title: `Orçamento #${q.number} aprovado`, detail: by, badge: { label: 'Aprovado', tone: 'ok' } }
    case 'REJECTED':
      return { ...base, title: `Orçamento #${q.number} recusado`, detail: by, badge: { label: 'Recusado', tone: 'danger' } }
    case 'CANCELED':
      return { ...base, title: `Orçamento #${q.number} cancelado`, detail: by, badge: { label: 'Cancelado', tone: 'danger' } }
    case 'CONVERTED':
      return { ...base, title: `Orçamento #${q.number} virou o pedido #${ev.detail ?? ''}`, detail: by, badge: { label: 'Virou pedido', tone: 'ok' } }
    case 'NEW_VERSION':
      return ev.version > 1 ? { ...base, title: `Nova versão do orçamento #${q.number} (v${ev.version})`, detail: by, badge: { label: `v${ev.version}`, tone: 'neutral' } } : null
    default:
      return null // edições do rascunho não entram no resumo
  }
}

// GET /api/dashboard/recent (sugestão) — as 6 últimas coisas que aconteceram
export async function getRecentes(): Promise<ActivityItem[]> {
  await wait(500)
  const mode = new URLSearchParams(window.location.search).get('recentes')
  if (mode === 'erro') throw new Error('Falha simulada em recentes')
  if (mode === 'vazio') return []
  const drafts: Draft[] = []
  for (const o of mockAllOrders()) {
    for (const ev of o.events) {
      const d = fromOrder(o, ev)
      if (d) drafts.push(d)
    }
  }
  for (const q of mockQuoteEvents()) {
    const d = fromQuote(q)
    if (d) drafts.push(d)
  }
  return drafts
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6)
    .map(({ at: _at, ...item }) => ({ ...item, when: relativeTime(_at) }))
}

// ---------- HU25: GET /api/dashboard (números reais, vindos de Orçamentos e Pedidos) ----------

export type Dashboard = {
  quotesAwaitingAnswer: number
  quotesToSend: number
  ordersInProduction: number
  ordersNew: number
  ordersReady: number
  receivableCents: number
  receivableOrders: number
  unpaid: { orderId: number; number: string; customerName: string; customerWhatsapp: string | null; remainingCents: number; daysSinceDelivery: number }[]
  // Sem prazo de entrega (decisão da PO): pedidos em andamento, os que estão esperando há mais tempo primeiro
  inProgress: { orderId: number; number: string; customerName: string; createdOn: string; status: OrderStatus; daysOpen: number }[]
}

export async function getDashboard(): Promise<Dashboard> {
  const quotes = await countQuotes()
  await wait(300)
  if (new URLSearchParams(window.location.search).get('inicio') === 'erro') throw new Error('Falha simulada no início')
  const today = todayIso()
  const orders = mockAllOrders()
  const open = orders.filter((o) => o.status !== 'CANCELED' && o.remainingCents > 0)
  const active = orders.filter((o) => o.status === 'NEW' || o.status === 'IN_PRODUCTION' || o.status === 'READY')
  return {
    quotesAwaitingAnswer: quotes.SENT,
    quotesToSend: quotes.CONFIRMED,
    ordersInProduction: orders.filter((o) => o.status === 'IN_PRODUCTION').length,
    ordersReady: orders.filter((o) => o.status === 'READY').length,
    ordersNew: orders.filter((o) => o.status === 'NEW').length,
    receivableCents: open.reduce((s, o) => s + o.remainingCents, 0),
    receivableOrders: open.length,
    unpaid: open
      .filter((o) => o.paymentStatus === 'OVERDUE' && o.deliveredOn)
      .sort((a, b) => (a.deliveredOn ?? '').localeCompare(b.deliveredOn ?? ''))
      .slice(0, 5)
      .map((o) => ({ orderId: o.id, number: o.number, customerName: o.customer.name, customerWhatsapp: o.customer.whatsapp, remainingCents: o.remainingCents, daysSinceDelivery: daysBetween(o.deliveredOn!, today) })),
    inProgress: active
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, 5)
      .map((o) => {
        const createdOn = isoDateTimeToDay(o.createdAt)
        return { orderId: o.id, number: o.number, customerName: o.customer.name, createdOn, status: o.status, daysOpen: daysBetween(createdOn, today) }
      }),
  }
}
