import { customerMobile } from '../clientes/format'
import { countQuotes, mockQuoteEvents } from '../orcamentos/quotesApi'
import type { QuoteEvent } from '../orcamentos/types'
import { formatMoney } from '../orcamentos/money'
import { daysBetween, isoDateTimeToDay, todayIso } from '../pedidos/dates'
import { mockAllOrders } from '../pedidos/ordersApi'
import type { Order, OrderEvent, OrderExpense, OrderStatus } from '../pedidos/types'

// ⚠️ SIMULAÇÃO (mock) — o conteúdo das seções e o endpoint ainda serão definidos
// pela PO e pelo Back-end (HU04/HU05). Os números abaixo são só exemplos.
//
// Para testar os estados, coloque na URL do navegador:
//   ?recentes=vazio     ?recentes=erro   (Recentes: histórico de pedidos e orçamentos)
//   ?inicio=erro        (números, "não pagaram" e "em andamento": GET /api/dashboard)

// ---------- HU05: Últimas atividades ----------
// Montado a partir do histórico REAL de pedidos e orçamentos.
// Design 31/10: só pagamento, orçamento e material. Troca de etapa do pedido ("em produção") não entra.

export type ActivityItem = {
  id: string
  kind: 'orcamento' | 'aprovado' | 'pagamento' | 'estorno' | 'cobranca' | 'material'
  title: string
  detail: string
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
  const base = { id: `o${ev.id}`, to: `/pedidos/${o.id}`, at: ev.createdAt }
  switch (ev.type) {
    case 'PAYMENT':
      return { ...base, kind: 'pagamento', ...paymentText(o, ev) }
    case 'PAYMENT_REVERSED':
      return { ...base, kind: 'estorno', title: `Pagamento estornado no pedido #${o.number}`, detail: `${ev.detail ?? ''} · por ${ev.userName}` }
    case 'COLLECTION':
      return { ...base, kind: 'cobranca', title: `Cobrança enviada · pedido #${o.number}`, detail: `${o.customer.name} · por ${ev.userName}` }
    default:
      return null
  }
}

// "R$ 1.681,50 · PIX · Entrada" vira "Entrada de R$ 1.681,50 no pedido #45" + "PIX · por Thayná"
function paymentText(o: Order, ev: OrderEvent) {
  const [amount, ...rest] = (ev.detail ?? '').split(' · ')
  const isDown = rest.includes('Entrada')
  const info = rest.filter((r) => r !== 'Entrada')
  return {
    title: `${isDown ? 'Entrada' : 'Pagamento'} de ${amount} no pedido #${o.number}`,
    detail: [...info, `por ${ev.userName}`].join(' · '),
  }
}

function fromExpense(o: Order, e: OrderExpense): Draft {
  return { id: `e${e.id}`, kind: 'material', to: `/pedidos/${o.id}`, at: e.createdAt, title: `Material de ${formatMoney(e.amountCents)} no pedido #${o.number}`, detail: `${o.customer.name} · por ${e.userName}` }
}

const DISPATCH_TITLE: Record<string, (n: string) => string> = {
  WHATSAPP: (n) => `Orçamento #${n} enviado pelo WhatsApp`,
  PDF: (n) => `PDF do orçamento #${n} gerado`,
  PRINT: (n) => `Orçamento #${n} impresso`,
}

function fromQuote(q: { quoteId: number; number: string; customerName: string; event: QuoteEvent }): Draft | null {
  const ev = q.event
  const base = { id: `q${ev.id}`, kind: 'orcamento' as ActivityItem['kind'], to: `/orcamentos/${q.quoteId}`, at: ev.createdAt, detail: `${q.customerName} · por ${ev.userName}` }
  switch (ev.type) {
    case 'CREATED':
      return { ...base, title: `Orçamento #${q.number} criado` }
    case 'CONFIRMED':
      return { ...base, title: `Orçamento #${q.number} confirmado` }
    case 'DISPATCHED':
      return { ...base, title: (DISPATCH_TITLE[ev.detail ?? ''] ?? DISPATCH_TITLE.WHATSAPP)(q.number) }
    case 'APPROVED':
      return { ...base, kind: 'aprovado', title: `Orçamento #${q.number} aprovado` }
    case 'REJECTED':
      return { ...base, title: `Orçamento #${q.number} recusado` }
    case 'CANCELED':
      return { ...base, title: `Orçamento #${q.number} cancelado` }
    case 'CONVERTED':
      return { ...base, title: `Orçamento #${q.number} virou o pedido #${ev.detail ?? ''}` }
    case 'NEW_VERSION':
      return ev.version > 1 ? { ...base, title: `Nova versão do orçamento #${q.number} (v${ev.version})` } : null
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
    for (const e of o.expenses ?? []) drafts.push(fromExpense(o, e))
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
  overdueCents: number
  overdueOrders: number
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
    overdueCents: open.filter((o) => o.paymentStatus === 'OVERDUE').reduce((s, o) => s + o.remainingCents, 0),
    overdueOrders: open.filter((o) => o.paymentStatus === 'OVERDUE').length,
    unpaid: open
      .filter((o) => o.paymentStatus === 'OVERDUE' && o.deliveredOn)
      .sort((a, b) => (a.deliveredOn ?? '').localeCompare(b.deliveredOn ?? ''))
      .slice(0, 5)
      .map((o) => ({ orderId: o.id, number: o.number, customerName: o.customer.name, customerWhatsapp: customerMobile(o.customer), remainingCents: o.remainingCents, daysSinceDelivery: daysBetween(o.deliveredOn!, today) })),
    inProgress: active
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, 5)
      .map((o) => {
        const createdOn = isoDateTimeToDay(o.createdAt)
        return { orderId: o.id, number: o.number, customerName: o.customer.name, createdOn, status: o.status, daysOpen: daysBetween(createdOn, today) }
      }),
  }
}
