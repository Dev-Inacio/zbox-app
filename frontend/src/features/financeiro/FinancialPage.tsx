import { useCallback, useEffect, useState } from 'react'
import { Calendar, MessageCircle, Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { AppIcon } from '../../components/ui/AppIcon'
import { Pagination } from '../../components/ui/Pagination'
import { Toast } from '../../components/ui/Toast'
import { ListFilters, SegFilter, StatusTag } from '../../components/zbox'
import { usePagedList } from '../../hooks/usePagedList'
import { useRequest } from '../../hooks/useRequest'
import { formatMoney } from '../orcamentos/money'
import { formatDay, sinceText } from '../pedidos/dates'
import { METHOD_LABEL } from '../pedidos/labels'
import { OrderStatusBadge } from '../pedidos/OrderBadges'
import { InvoiceTag } from '../pedidos/Invoice'
import { CollectDialog, DeleteExpenseDialog, ExpenseDialog, ExpensesListDialog, PaymentDialog } from '../pedidos/OrderDialogs'
import { getOrder } from '../pedidos/ordersApi'
import type { Order, OrderExpense } from '../pedidos/types'
import { getFinancialSummary, getProfitByMonth, getProfitReport, listReceivables, listReceivedOrders } from './financialApi'
import type { FinancialSummary, ProfitReport, ProfitRow, Receivable, ReceivableFilter, ReceivedPayment } from './financialApi'
import { useAuth } from '../auth/useAuth'
import { canSeeProfit } from '../pedidos/permissions'
import { ORDER_STATUS_LABEL as STATUS } from '../pedidos/labels'
import { PERIODS, periodRange, readPeriod } from './period'
import { formatPercentBR, LABOR_GOOD_PERCENT, LABOR_MIN_PERCENT, profitHealth, profitView } from '../pedidos/profitHealth'
import type { ProfitHealth, ProfitView } from '../pedidos/profitHealth'
import '../../components/ui/ButtonVariants.css'
import '../clientes/Clientes.css'
import '../orcamentos/Orcamentos.css'
import '../pedidos/Pedidos.css'
import './Financeiro.css'

// HU24 — Financeiro (não é contabilidade): quanto tem para receber, quem está devendo, quanto entrou.
// URL: ?aba=recebidos&periodo=LAST_30&filtro=OVERDUE&pagina=2

const PAGE_SIZE = 5
const MONTH_NAME = new Intl.DateTimeFormat('pt-BR', { month: 'long' })
const RECEIVABLE_PAGE_SIZE = 5 // design 25/10: "Falta receber" de 5 em 5
const FILTERS: { value: ReceivableFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'OVERDUE', label: 'Atrasados' },
  { value: 'OPEN', label: 'Ainda não entregues' },
]

type Action =
  | { kind: 'pay'; row: Pick<Receivable, 'orderId' | 'number' | 'customerName' | 'remainingCents'> }
  | { kind: 'collect'; row: Receivable }
  | { kind: 'expense' | 'expenses'; order: Order }
  | { kind: 'editExpense' | 'deleteExpense'; order: Order; expense: OrderExpense }
  | null

export function FinancialPage() {
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const showProfit = canSeeProfit(user?.role)
  const aba = params.get('aba') // link antigo (?aba=recebidos, ?aba=lucro): rola até o bloco
  const period = readPeriod(params.get('periodo'))
  const filter = (FILTERS.find((f) => f.value === params.get('filtro'))?.value ?? 'ALL') as ReceivableFilter
  const page = Math.max(0, Number(params.get('pagina') ?? '1') - 1) || 0
  const range = periodRange(period)
  const receivedPeriod = readPeriod(params.get('entrou'))
  const receivedRange = periodRange(receivedPeriod)
  const receivedPage = Math.max(0, Number(params.get('paginaEntrou') ?? '1') - 1) || 0
  const search = params.get('busca') ?? ''
  const [term, setTerm] = useState(search)
  const [version, setVersion] = useState(0) // muda depois de pagar/cobrar → recarrega
  const [action, setAction] = useState<Action>(null)
  const [picking, setPicking] = useState(false) // botão do topo: primeiro escolhe o pedido
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  const update = useCallback((changes: Record<string, string | null>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === '') next.delete(k)
        else next.set(k, v)
      }
      return next
    })
  }, [setParams])

  // Quadros do topo: fixos ("entrou este mês", "falta receber hoje"). O período escolhido vale só dentro das seções.
  const month = periodRange('THIS_MONTH')
  const summaryFetcher = useCallback(() => getFinancialSummary(month.from, month.to), [month.from, month.to])
  const summary = useRequest(`sum|${month.from}|${month.to}|${version}`, summaryFetcher)
  const periodFetcher = useCallback(() => getFinancialSummary(receivedRange.from, receivedRange.to), [receivedRange.from, receivedRange.to])
  const periodSummary = useRequest(`per|${receivedRange.from}|${receivedRange.to}|${version}`, periodFetcher)
  const recFetcher = useCallback(() => listReceivables(filter, search, page, RECEIVABLE_PAGE_SIZE), [filter, search, page])
  const receivables = useRequest(`rec|${filter}|${search}|${page}|${version}`, recFetcher)

  // Busca por cliente ou número do pedido: espera a pessoa parar de digitar (300 ms) e só busca com 2+ caracteres
  useEffect(() => {
    const timer = setTimeout(() => {
      const value = term.trim()
      const effective = value.length >= 2 ? value : ''
      if (effective !== search) update({ busca: effective, pagina: null })
    }, 300)
    return () => clearTimeout(timer)
  }, [term, search, update])
  const payFetcher = useCallback(() => listReceivedOrders(receivedRange.from, receivedRange.to, receivedPage, PAGE_SIZE), [receivedRange.from, receivedRange.to, receivedPage])
  const received = useRequest(`pay|${receivedRange.from}|${receivedRange.to}|${receivedPage}|${version}`, payFetcher)

  const profitFetcher = useCallback(() => (showProfit ? getProfitReport(range.from, range.to) : Promise.resolve(null)), [showProfit, range.from, range.to])
  const profit = useRequest(`lucro|${range.from}|${range.to}|${version}`, profitFetcher)

  const s = summary.data
  const byMonthFetcher = useCallback(() => (showProfit ? getProfitByMonth(month.to) : Promise.resolve(null)), [showProfit, month.to])
  const profitByMonth = useRequest(`meses|${month.to}|${version}`, byMonthFetcher)
  // Quadro "Como foi o mês": mesma conta da seção (só serviços com material lançado)
  const monthProfitFetcher = useCallback(() => (showProfit ? getProfitReport(month.from, month.to) : Promise.resolve(null)), [showProfit, month.from, month.to])
  const monthProfit = useRequest(`mes|${month.from}|${month.to}|${version}`, monthProfitFetcher)
  const monthRated = monthProfit.data?.orders.filter((o) => o.status !== 'CANCELED' && (o.materialCents > 0 || o.expectedProfitCents < 0)) ?? []
  const monthLeft = monthRated.length > 0 ? monthRated.reduce((sum, o) => sum + o.expectedProfitCents, 0) : null
  const monthBase = monthRated.reduce((sum, o) => sum + o.totalCents, 0)
  const monthPercent = monthLeft !== null && monthBase > 0 ? Math.round((monthLeft / monthBase) * 100) : null
  const monthTitle = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(`${month.from}T12:00:00`)).replace(/^./, (c) => c.toUpperCase())
  const monthName = MONTH_NAME.format(new Date(`${month.from}T12:00:00`))

  // Lançar ou editar gasto: busca o pedido (com os gastos atuais) e abre a janela
  function openOrder(id: number, kind: 'expense' | 'expenses') {
    getOrder(id).then((order) => {
      // Só um gasto (o material): "Editar" já abre a edição dele
      const only = kind === 'expenses' && order.expenses?.length === 1 ? order.expenses[0] : null
      setAction(only ? { kind: 'editExpense', order, expense: only } : { kind, order })
    }).catch(() => setToast('Não foi possível abrir o pedido. Tente de novo.'))
  }

  useEffect(() => {
    const target = aba === 'recebidos' ? 'entrou' : aba === 'lucro' ? 'resumo' : null
    if (target) document.getElementById(target)?.scrollIntoView()
  }, [aba])

  function finished(message: string) {
    setAction(null)
    setVersion((n) => n + 1)
    setToast(message)
  }

  return (
    <>
      <PageHero title="Financeiro" subtitle="Quanto falta receber, o que entrou e quanto sobrou no mês."
        actions={<>
          <span className="zv-btn zv-static"><Calendar size={20} strokeWidth={1.8} aria-hidden="true" />{monthTitle}</span>
          <Button onClick={() => setPicking(true)} data-testid="registrar-pagamento"><Plus size={20} strokeWidth={1.8} aria-hidden="true" />Registrar pagamento</Button>
        </>} />

      <main className="page-body fn-page">
        {/* Os quadros SÃO o menu: cada um abre a sua lista logo abaixo */}
        {summary.loading && <div className="fn-cards">{[0, 1, 2].map((i) => <div key={i} className="fn-card fn-card--loading" aria-hidden="true" />)}</div>}
        {!summary.loading && Boolean(summary.error) && (
          <div className="cl-state" role="alert">
            <p className="cl-state__title">Não foi possível carregar o resumo.</p>
            <Button className="btn--secondary" onClick={() => setVersion((n) => n + 1)}>Tentar novamente</Button>
          </div>
        )}
        {s && (
          <FinanceHero s={s} monthName={monthName} showProfit={showProfit} monthLeft={monthLeft} monthPercent={monthPercent} />
        )}

        {/* Atalhos: a página é uma só (design 13) */}
        <nav className="fn-jump" aria-label="Ir para">
          <a href="#falta">Falta receber</a>
          <a href="#entrou">O que entrou</a>
          {showProfit && <a href="#resumo">Resumo do mês</a>}
        </nav>

        <section id="falta" className="zv-card fn-section" aria-labelledby="t-falta-receber">
          <div className="fn-section__head">
            <h2 id="t-falta-receber" className="fn-section__title">Falta receber</h2>
            {s && <span className="cl-muted">{s.receivableOrders === 1 ? '1 pedido' : `${s.receivableOrders} pedidos`} · {formatMoney(s.receivableCents)} · os atrasados aparecem primeiro</span>}
          </div>
          <ListFilters value={term} onChange={setTerm} placeholder="Buscar cliente ou pedido" testId="busca-financeiro"
                hint={term.trim().length === 1 ? 'Digite pelo menos 2 caracteres para buscar.' : undefined}>
                <SegFilter label="Mostrar" options={FILTERS} value={filter} onChange={(v) => update({ filtro: v === 'ALL' ? null : v, pagina: null })} />
              </ListFilters>
              <ListState loading={receivables.loading} error={receivables.error} empty={receivables.data?.totalElements === 0}
                emptyTitle={search ? `Nada a receber para "${search}".` : filter === 'OVERDUE' ? 'Ninguém devendo depois da entrega.' : 'Nada a receber.'} emptyText={search ? 'Confira o nome ou o número do pedido.' : 'Quando um pedido tiver valor em aberto, ele aparece aqui.'}
                onRetry={() => setVersion((n) => n + 1)} />
              {receivables.data && receivables.data.content.length > 0 && (
                <>
                  <div className="zv-table-wrap">
                    <table className="zv-table" data-testid="lista-a-receber">
                      <thead><tr><th scope="col">Cliente</th><th scope="col">Situação</th><th scope="col">Falta receber</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
                      <tbody>
                        {receivables.data.content.map((r) => <ReceivableRow key={r.orderId} r={r} onPay={() => setAction({ kind: 'pay', row: r })} onCollect={() => setAction({ kind: 'collect', row: r })} />)}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={receivables.data.page} totalPages={receivables.data.totalPages} size={receivables.data.size} total={receivables.data.totalElements} shown={receivables.data.content.length}
                    onChange={(p) => update({ pagina: p === 0 ? null : String(p + 1) })} />
                </>
              )}
        </section>

        <section id="entrou" className="zv-card fn-section" aria-labelledby="t-entrou">
          <div className="fn-section__head">
            <h2 id="t-entrou" className="fn-section__title">O que entrou {receivedRange.label}</h2>
            {periodSummary.data && periodSummary.data.receivedPayments > 0 && (
              <span className="fn-section__chips">
                <span className="fn-chip fn-chip--good">Total <strong>{formatMoney(periodSummary.data.receivedCents)}</strong></span>
                {periodSummary.data.byMethod.map((m) => <span key={m.method} className="fn-chip">{METHOD_LABEL[m.method]} <strong>{formatMoney(m.amountCents)}</strong></span>)}
              </span>
            )}
          </div>
          <div className="fn-periods" role="group" aria-label="Período">
            {PERIODS.map((p) => (
              <button key={p.value} type="button" className="fn-periods__btn" aria-pressed={receivedPeriod === p.value}
                onClick={() => update({ entrou: p.value === 'THIS_MONTH' ? null : p.value, paginaEntrou: null })} data-testid={`entrou-${p.value}`}>
                {p.label}
              </button>
            ))}
          </div>
          <ListState loading={received.loading} error={received.error} empty={received.data?.totalElements === 0}
                emptyTitle="Nenhum pagamento neste período." emptyText="Escolha outro período." onRetry={() => setVersion((n) => n + 1)} />
              {received.data && received.data.content.length > 0 && (
                <>
                  {/* Cada pagamento é um cartão: quem pagou e quanto em destaque; o resto em letra menor */}
                  <ul className="fn-pays" data-testid="lista-recebidos">
                    {received.data.content.map((p) => (
                      <li key={p.orderId} className="fn-pay">
                        <div className="fn-pay__top">
                          <span className="fn-pay__who">
                            <span className="fn-pay__name">{p.customerName}</span>
                            <span className="fn-pay__meta">{p.payments.length === 1 ? `${formatDay(p.lastPaidAt)} · ${METHOD_LABEL[p.payments[0].method]}` : `${p.payments.length} pagamentos`} · <Link to={`/pedidos/${p.orderId}`}>Pedido #{p.orderNumber}</Link></span>
                          </span>
                          <strong className="fn-pay__value">+ {formatMoney(p.amountCents)}</strong>
                        </div>
                        {p.payments.length > 1 && (
                          <ul className="fn-pay__parts" data-testid="partes-pagamento">
                            {p.payments.map((part) => <li key={part.id}><span>{formatDay(part.paidAt)} · {METHOD_LABEL[part.method]}</span><span>{formatMoney(part.amountCents)}</span></li>)}
                          </ul>
                        )}
                        {p.split && <PaymentSplit split={p.split} onAddExpense={() => openOrder(p.orderId, 'expense')} onEditExpenses={() => openOrder(p.orderId, 'expenses')} />}
                      </li>
                    ))}
                  </ul>
                  <Pagination page={received.data.page} totalPages={received.data.totalPages} size={received.data.size} total={received.data.totalElements} shown={received.data.content.length}
                    onChange={(p) => update({ paginaEntrou: p === 0 ? null : String(p + 1) })} />
                </>
              )}
        </section>

        {showProfit && (
          <section id="resumo" className="zv-card fn-section" aria-labelledby="t-resumo">
            <div className="fn-section__head">
              <h2 id="t-resumo" className="fn-section__title">Resumo do mês</h2>
              <span className="cl-muted">Como foi {range.label}. Só Admin e Gerente veem.</span>
            </div>
            <div className="fn-periods" role="group" aria-label="Período">
            {PERIODS.map((p) => (
              <button key={p.value} type="button" className="fn-periods__btn" aria-pressed={period === p.value}
                onClick={() => update({ periodo: p.value === 'THIS_MONTH' ? null : p.value })} data-testid={`periodo-${p.value}`}>
                {p.label}
              </button>
            ))}
          </div>
            <ListState loading={profit.loading} error={profit.error} empty={false} emptyTitle="" emptyText="" onRetry={() => setVersion((n) => n + 1)} />
              {profit.data && <ProfitTab report={profit.data} byMonth={profitByMonth.data ?? null} label={range.label} onAddExpense={(id) => openOrder(id, 'expense')}
                onPay={(o) => setAction({ kind: 'pay', row: { orderId: o.orderId, number: o.number, customerName: o.customerName, remainingCents: o.totalCents - o.paidCents } })} />}
          </section>
        )}
      </main>

      {action?.kind === 'pay' && (
        <PaymentDialog target={{ id: action.row.orderId, number: action.row.number, customerName: action.row.customerName, remainingCents: action.row.remainingCents }}
          onCancel={() => setAction(null)} onDone={(o) => finished(o.paymentStatus === 'PAID' ? `Pagamento registrado. Pedido #${o.number} pago!` : `Pagamento registrado. Falta ${formatMoney(o.remainingCents)}.`)} />
      )}
      {action?.kind === 'collect' && (
        <CollectDialog target={{ id: action.row.orderId, number: action.row.number, customerName: action.row.customerName, customerWhatsapp: action.row.customerWhatsapp, remainingCents: action.row.remainingCents, deliveredOn: action.row.deliveredOn }}
          onCancel={() => setAction(null)} onDone={() => finished('WhatsApp aberto. Confira a mensagem e envie por lá.')} />
      )}
      {action?.kind === 'expense' && (
        <ExpenseDialog order={action.order} expense={null} onCancel={() => setAction(null)} onDone={(o) => finished(`Material lançado no pedido #${o.number}. O que o cliente deve não muda: para isso, use "Recebi pagamento".`)} />
      )}
      {action?.kind === 'expenses' && (
        <ExpensesListDialog order={action.order} onCancel={() => setAction(null)}
          onEdit={(expense) => setAction({ kind: 'editExpense', order: action.order, expense })}
          onDelete={(expense) => setAction({ kind: 'deleteExpense', order: action.order, expense })} />
      )}
      {action?.kind === 'editExpense' && (
        <ExpenseDialog order={action.order} expense={action.expense} onCancel={() => setAction({ kind: 'expenses', order: action.order })}
          onDone={(o) => finished(`Gasto corrigido no pedido #${o.number}.`)} />
      )}
      {action?.kind === 'deleteExpense' && (
        <DeleteExpenseDialog order={action.order} expense={action.expense} onCancel={() => setAction({ kind: 'expenses', order: action.order })}
          onDone={(o) => finished(`Gasto excluído do pedido #${o.number}.`)} />
      )}
      {picking && <PickOrderDialog onCancel={() => setPicking(false)} onPick={(row) => { setPicking(false); setAction({ kind: 'pay', row }) }} />}
      <Toast message={toast} onClose={clearToast} />
    </>
  )
}

// HU27 — Gastos e lucro do período (só ADMIN e MANAGER)
// Recebidos: de onde vem e para onde vai cada pagamento, em linguagem simples
// Também lança/corrige o material dali mesmo: quem esqueceu de lançar no pedido resolve em Recebidos.
function PaymentSplit({ split: s, onAddExpense, onEditExpenses }: {
  split: NonNullable<ReceivedPayment['split']>; onAddExpense: () => void; onEditExpenses: () => void
}) {
  const noMaterial = s.orderMaterialCents === 0 && s.orderOtherCents === 0
  // Etiquetas curtas no lugar de frases: dá para entender batendo o olho
  return (
    <div className="fn-split" data-testid="detalhe-pagamento">
      <span className="fn-split__chips">
        {noMaterial ? (
          <span className="fn-chip fn-chip--warn">Sem material lançado</span>
        ) : (
          <>
            <span className="fn-chip"><i className="pd-dot is-material" />Material do pedido <strong>{formatMoney(s.orderMaterialCents + s.orderOtherCents)}</strong></span>
            <span className={`fn-chip ${s.orderLaborCents < 0 ? 'fn-chip--bad' : 'fn-chip--good'}`}><i className="pd-dot is-labor" />{s.orderLaborCents < 0 ? 'Prejuízo' : 'Sua mão de obra'} <strong>{formatMoney(s.orderLaborCents)}</strong></span>
          </>
        )}
        {s.orderRemainingCents > 0
          ? <span className="fn-chip fn-chip--muted">Falta receber <strong>{formatMoney(s.orderRemainingCents)}</strong></span>
          : <span className="fn-chip fn-chip--muted"><AppIcon name="check" size={16} />Pedido pago</span>}
      </span>
      <span className="fn-split__actions">
        {/* Um valor de material por pedido: depois de lançado, só editar */}
        {noMaterial
          ? <button type="button" className="btn btn--primary fn-add" onClick={onAddExpense} data-testid="lancar-material-recebido"><AppIcon name="plus" size={24} onAccent={noMaterial} />Lançar material</button>
          : <button type="button" className="btn btn--secondary fn-add" onClick={onEditExpenses} data-testid="editar-gastos-recebido"><AppIcon name="edit" size={24} />Editar material</button>}
      </span>
    </div>
  )
}

const HEALTH_TAG: Record<ProfitHealth, string> = { OUT_OF_POCKET: 'Prejuízo', LOW: 'Prejuízo', NORMAL: 'Normal', GREAT: 'Ótimo' }

// "Gastos e lucro" virou um painel: em poucos segundos, o mês foi bom ou ruim?
// O detalhe de cada pagamento (material × mão de obra) e a correção do material ficam em Recebidos.
const VERDICT: Record<ProfitHealth, { title: string; tone: 'bad' | 'ok' | 'great' }> = {
  OUT_OF_POCKET: { title: 'Mês ruim: teve prejuízo', tone: 'bad' },
  LOW: { title: 'Mês ruim: sobrou pouco', tone: 'bad' },
  NORMAL: { title: 'Mês bom', tone: 'ok' },
  GREAT: { title: 'Mês ótimo', tone: 'great' },
}

type ServiceRow = { o: ProfitRow; view: ProfitView }

function ProfitTab({ report, byMonth, label, onAddExpense, onPay }: {
  byMonth: { month: string; leftCents: number; percent: number | null }[] | null
  report: ProfitReport; label: string; onAddExpense: (orderId: number) => void; onPay: (o: ProfitRow) => void
}) {
  const active = report.orders.filter((o) => o.status !== 'CANCELED')
  // Cada serviço com a MESMA conta do pedido (profitView): régua, selo e mão de obra
  const rows: ServiceRow[] = active.map((o) => ({
    o,
    view: profitView({
      totalCents: o.totalCents, materialCents: o.materialCents, expectedProfitCents: o.expectedProfitCents,
    }),
  }))
  const rated = rows.filter((r) => r.view.rate !== null)     // já tem material: dá para medir
  const missing = rows.filter((r) => r.o.materialCents === 0) // sem material: falta lançar
  const sum = (list: ServiceRow[], f: (o: ProfitRow) => number) => list.reduce((s, r) => s + f(r.o), 0)

  // Veredito do mês: a régua aplicada à soma dos serviços que já têm material
  const ratedTotal = sum(rated, (o) => o.totalCents)
  const ratedLabor = sum(rated, (o) => o.expectedProfitCents)
  const month = rated.length > 0 ? profitHealth(ratedTotal, ratedLabor) : null
  const verdict = month ? VERDICT[month.health] : null

  const servicesCents = sum(rows, (o) => o.totalCents)
  const materialCents = sum(rows, (o) => o.materialCents + o.laborCents)
  const toReceiveCents = sum(rows, (o) => Math.max(0, o.totalCents - o.paidCents))

  const byPercent = [...rated].sort((a, b) => b.view.rate!.percent - a.view.rate!.percent)
  const best = byPercent[0]
  const worst = byPercent.length > 1 ? byPercent[byPercent.length - 1] : null
  // Listas de 5 em 5 (design 25/10). Os números de cima continuam do resumo inteiro.
  const missingPage = usePagedList(missing, 5)
  const servicesPage = usePagedList(byPercent, 5)

  if (active.length === 0) {
    return <div className="cl-state"><p className="cl-state__title">Nenhum serviço com movimento {label}.</p><p className="cl-state__text">Escolha outro período acima.</p></div>
  }

  return (
    <div className="fn-profit" data-testid="resumo-lucro">
      {/* 1. O veredito */}
      <section className={`fn-verdict fn-verdict--${verdict?.tone ?? 'none'}`} aria-labelledby="t-veredito">
        <h3 id="t-veredito" className="fn-verdict__title"><AppIcon name={!verdict ? 'chart' : verdict.tone === 'bad' ? 'alert' : 'check'} size={44} />{verdict ? verdict.title : 'Ainda não dá para saber'}</h3>
        {month ? (
          <>
            <p className="fn-verdict__text">
              {rated.length === 1 ? 'No serviço' : `Nos ${rated.length} serviços`} com material lançado, sobrou <strong>{formatPercentBR(month.percent)}</strong> para a sua mão de obra.
              {' '}O normal é de {LABOR_MIN_PERCENT}% a {LABOR_GOOD_PERCENT}%.
              {month.health === 'LOW' && <> Para chegar em {LABOR_MIN_PERCENT}%, faltaram <strong>{formatMoney(month.missingCents)}</strong>.</>}
              {month.health === 'OUT_OF_POCKET' && <> Os gastos passaram o valor dos serviços: <strong>{formatMoney(-ratedLabor)}</strong> saíram do seu bolso.</>}
            </p>
            <MonthGauge percent={month.percent} />
          </>
        ) : (
          <p className="fn-verdict__text">Nenhum serviço deste período tem material lançado. Lance o material (aqui embaixo ou em Recebidos) para ver se o mês foi bom.</p>
        )}
      </section>

      {/* 2. Os números do mês */}
      <dl className="fn-kpis">
        <div className="fn-kpi"><dt>Serviços</dt><dd>{formatMoney(servicesCents)}</dd><span>{active.length === 1 ? '1 serviço' : `${active.length} serviços`}</span></div>
        <div className="fn-kpi"><dt><i className="pd-dot is-material" />Material</dt><dd>− {formatMoney(materialCents)}</dd><span>{missing.length > 0 ? `${missing.length} sem material lançado` : 'todos lançados'}</span></div>
        <div className="fn-kpi fn-kpi--mine"><dt><i className="pd-dot is-labor" />Sua mão de obra</dt><dd className={ratedLabor < 0 ? 'fn-neg' : 'fn-pos'} data-testid="mao-de-obra-periodo">{formatMoney(ratedLabor)}</dd><span>{missing.length > 0 ? 'só dos serviços com material' : 'serviços − material'}</span></div>
        <div className="fn-kpi"><dt>Falta receber</dt><dd>{formatMoney(toReceiveCents)}</dd><span>{toReceiveCents > 0 ? 'destes serviços' : 'tudo recebido'}</span></div>
      </dl>

      {/* 3. Melhor e pior serviço */}
      {best && (
        <div className="fn-duo">
          {/* Com 1 serviço só, não é "melhor" nem "pior": é "o serviço do mês" */}
          <ServiceHighlight label={worst ? 'Melhor serviço' : 'Serviço do mês'} row={best} />
          {worst && <ServiceHighlight label="Pior serviço" row={worst} />}
        </div>
      )}

      <div className="fn-two">
      {byMonth && <LeftByMonth rows={byMonth} />}
      {/* 4. O que falta fazer */}
      {missing.length > 0 && (
        <section className="fn-todo" aria-labelledby="t-falta">
          <h3 id="t-falta" className="fn-subtitle fn-subtitle--icon"><AppIcon name="material" size={32} />Falta lançar o material ({missing.length === 1 ? '1 serviço' : `${missing.length} serviços`})</h3>
          <p className="oc-small cl-muted">Sem o material, não dá para saber quanto estes serviços deixaram para você.</p>
          <ul className="fn-mini">
            {missingPage.content.map(({ o }) => (
              <li key={o.orderId}>
                <span><Link to={`/pedidos/${o.orderId}`}>{o.customerName}</Link><span className="cl-muted oc-small"> · #{o.number} · {formatMoney(o.totalCents)}</span></span>
                <span className="fn-mini__right">
                  {o.totalCents > o.paidCents && <button type="button" className="btn btn--secondary fn-add" onClick={() => onPay(o)} data-testid="receber-falta-material">Recebi pagamento</button>}
                  <button type="button" className="btn btn--secondary fn-add" onClick={() => onAddExpense(o.orderId)} data-testid="lancar-gasto-linha"><AppIcon name="plus" size={24} />Lançar material</button>
                </span>
              </li>
            ))}
          </ul>
          {missingPage.needsPages && <Pagination page={missingPage.page} totalPages={missingPage.totalPages} size={missingPage.size} total={missingPage.total} shown={missingPage.content.length} onChange={missingPage.setPage} />}
        </section>
      )}

      </div>

      {/* 5. Todos os serviços, resumidos */}
      {rated.length > 0 && (
        <section aria-labelledby="t-todos">
          <h3 id="t-todos" className="fn-subtitle">Como foi cada serviço ({rated.length === 1 ? '1 serviço' : `${rated.length} serviços`})</h3>
          <ul className="fn-mini" data-testid="lista-lucro">
            {servicesPage.content.map(({ o, view }) => (
              <li key={o.orderId}>
                <span><Link to={`/pedidos/${o.orderId}`}>{o.customerName}</Link><span className="cl-muted oc-small"> · #{o.number} · {STATUS[o.status]}</span></span>
                <span className="fn-mini__right">
                  <span className={`pd-health__tag fn-tag pd-health--${view.rate!.health.toLowerCase()}`}>{HEALTH_TAG[view.rate!.health]} · {formatPercentBR(view.rate!.percent)}</span>
                  <strong className={view.tone === 'loss' ? 'fn-neg' : 'fn-pos'} data-testid="lucro-servico">{formatMoney(view.valueCents)}</strong>
                  {o.totalCents > o.paidCents && <button type="button" className="btn btn--secondary fn-add" onClick={() => onPay(o)} data-testid="receber-servico">Recebi pagamento</button>}
                </span>
              </li>
            ))}
          </ul>
          {servicesPage.needsPages && <Pagination page={servicesPage.page} totalPages={servicesPage.totalPages} size={servicesPage.size} total={servicesPage.total} shown={servicesPage.content.length} onChange={servicesPage.setPage} />}
        </section>
      )}
    </div>
  )
}

function ServiceHighlight({ label, row: { o, view } }: { label: string; row: ServiceRow }) {
  const loss = view.tone === 'loss'
  return (
    <div className={`fn-highlight${loss ? ' is-loss' : ''}`}>
      <span className="fn-highlight__label">{label}</span>
      <Link to={`/pedidos/${o.orderId}`} className="fn-highlight__name">{o.customerName}</Link>
      <span className="cl-muted oc-small">Pedido #{o.number} · serviço de {formatMoney(o.totalCents)}</span>
      <span className="fn-highlight__value">
        <strong className={loss ? 'fn-neg' : 'fn-pos'}>{formatMoney(view.valueCents)}</strong>
        <span className={`pd-health__tag fn-tag pd-health--${view.rate!.health.toLowerCase()}`}>{HEALTH_TAG[view.rate!.health]} · {formatPercentBR(view.rate!.percent)}</span>
      </span>
    </div>
  )
}

// Régua do mês: onde caiu a média, com a faixa normal (30% a 45%) marcada
function MonthGauge({ percent }: { percent: number }) {
  const scale = 60
  const pos = (n: number) => `${Math.min(100, Math.max(0, (n / scale) * 100))}%`
  return (
    <div className="fn-gauge" role="img" aria-label={`${formatPercentBR(percent)} de mão de obra. Normal de ${LABOR_MIN_PERCENT}% a ${LABOR_GOOD_PERCENT}%.`}>
      <div className="pd-health__track">
        <span className="pd-health__ok" style={{ left: pos(LABOR_MIN_PERCENT), width: `calc(${pos(LABOR_GOOD_PERCENT)} - ${pos(LABOR_MIN_PERCENT)})` }} />
        <span className="pd-health__great" style={{ left: pos(LABOR_GOOD_PERCENT), right: 0 }} />
        <span className="pd-health__mark" style={{ left: pos(percent) }} />
      </div>
      <div className="pd-health__scale" aria-hidden="true">
        <span>0%</span><span style={{ left: pos(LABOR_MIN_PERCENT) }}>{LABOR_MIN_PERCENT}%</span><span style={{ left: pos(LABOR_GOOD_PERCENT) }}>{LABOR_GOOD_PERCENT}%</span>
      </div>
    </div>
  )
}

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
const shortMoney = (cents: number) => (cents >= 100000 ? `R$ ${(cents / 100000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : formatMoney(cents))
const monthShort = (month: string) => {
  const name = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(`${month}-15T12:00:00`)).replace('.', '')
  return name.charAt(0).toUpperCase() + name.slice(1)
}
const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`)

function FinanceHero({ s, monthName, showProfit, monthLeft, monthPercent }: { s: FinancialSummary; monthName: string; showProfit: boolean; monthLeft: number | null; monthPercent: number | null }) {
  const sold = s.receivedCents + s.receivableCents
  const percent = sold > 0 ? Math.round((s.receivedCents / sold) * 100) : 0
  return (
    <section className="fn-hero" aria-label="Resumo do mês">
      <div data-testid="total-a-receber">
        <span className="fn-hero__label">Falta receber</span>
        <b className="fn-hero__value">{formatMoney(s.receivableCents)}</b>
        <span>
          {s.receivableOrders === 0 ? 'Ninguém devendo' : `em ${plural(s.receivableOrders, 'pedido', 'pedidos')}`}
          {s.overdueOrders > 0 && <> · <strong className="fn-hero__late" data-testid="total-atrasado">{plural(s.overdueOrders, 'atrasado', 'atrasados')} ({formatMoney(s.overdueCents)})</strong></>}
        </span>
        <div className="fn-hero__progress">
          <div className="fn-hero__row"><span>Recebido de tudo que foi vendido em {monthName}</span><strong>{percent}%</strong></div>
          <div className="fn-hero__bar"><i style={{ width: `${percent}%` }} /></div>
          <div className="fn-hero__row"><span>{formatMoney(s.receivedCents)} recebidos</span><span>de {formatMoney(sold)}</span></div>
        </div>
      </div>
      <div className="fn-hero__tiles">
        <div className="fn-hero__tile" data-testid="total-recebido">
          <span>Entrou em {monthName}</span><b className="is-good">{shortMoney(s.receivedCents)}</b>
          <span>{s.receivedPayments === 0 ? 'Nenhum pagamento' : plural(s.receivedPayments, 'pagamento', 'pagamentos')}</span>
        </div>
        <div className="fn-hero__tile">
          <span>Atrasado</span><b className={s.overdueCents > 0 ? 'is-bad' : undefined}>{shortMoney(s.overdueCents)}</b>
          <span>{plural(s.overdueCustomers, 'cliente', 'clientes')}</span>
        </div>
        <div className="fn-hero__tile">
          <span>Ainda não entregue</span><b>{shortMoney(s.notDeliveredCents)}</b>
          <span>{plural(s.notDeliveredOrders, 'pedido', 'pedidos')}</span>
        </div>
        {showProfit && (
          <div className="fn-hero__tile" data-testid="aba-lucro">
            <span>Sobrou para você</span><b>{shortMoney(monthLeft ?? 0)}</b>
            <span>{monthPercent === null ? 'Lance o material para ver' : `${monthPercent}% dos serviços`}</span>
          </div>
        )}
      </div>
    </section>
  )
}

function LeftByMonth({ rows }: { rows: { month: string; leftCents: number; percent: number | null }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.leftCents))
  return (
    <section className="zv-card fn-panel" aria-labelledby="t-sobrou-mes">
      <h3 id="t-sobrou-mes" className="fn-panel__title">Quanto sobrou por mês</h3>
      <p className="fn-panel__sub">Em reais e a % de cada mês.</p>
      <ol className="fn-bars fn-bars--green" data-testid="grafico-sobrou">
        {rows.map((r, i) => (
          <li key={r.month} className={i === rows.length - 1 ? 'is-now' : undefined}>
            <span>{shortMoney(Math.max(0, r.leftCents))}</span>
            <i style={{ height: `${Math.round((Math.max(0, r.leftCents) / max) * 70)}%` }} />
            <span>{monthShort(r.month)}{r.percent !== null && <><br />{r.percent}%</>}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

// Botão "Registrar pagamento" do topo: escolhe o pedido e segue para a janela de pagamento que já existe
function PickOrderDialog({ onCancel, onPick }: { onCancel: () => void; onPick: (row: Receivable) => void }) {
  const [term, setTerm] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Receivable | null>(null)
  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim().length >= 2 ? term.trim() : ''), 300)
    return () => clearTimeout(timer)
  }, [term])
  const fetcher = useCallback(() => listReceivables('ALL', query, 0, 100), [query])
  const list = useRequest(`pick|${query}`, fetcher)
  return (
    <ConfirmDialog open title="Registrar pagamento" confirmLabel="Continuar" confirmDisabled={!selected} onCancel={onCancel} onConfirm={() => { if (selected) onPick(selected) }}>
      <div className="fn-pick">
        <label className="cl-field">
          <span className="cl-field__label">De quem é o pagamento?</span>
          <input autoComplete="off" className="cl-input" type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Cliente ou número do pedido" data-testid="registrar-busca" />
        </label>
        {list.loading && <p className="cl-muted">Buscando…</p>}
        {Boolean(list.error) && <p className="field__error">Não foi possível buscar. Tente de novo.</p>}
        {list.data?.content.length === 0 && <p className="cl-muted">{query ? `Nenhum pedido com valor em aberto para "${query}".` : 'Nenhum pedido com valor em aberto.'}</p>}
        {list.data && list.data.content.length > 0 && (
          <ul className="fn-pick__list">
            {/* Para achar pelo nome: em ordem alfabética */}
            {[...list.data.content].sort((a, b) => a.customerName.localeCompare(b.customerName, 'pt-BR') || a.number.localeCompare(b.number)).map((r) => (
              <li key={r.orderId}>
                <label className="fn-pick__opt">
                  <input type="radio" name="pedido-pagamento" checked={selected?.orderId === r.orderId} onChange={() => setSelected(r)} />
                  <span>{r.customerName}<small>Pedido nº {r.number}</small></span>
                  <strong>{formatMoney(r.remainingCents)}</strong>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ConfirmDialog>
  )
}

function ReceivableRow({ r, onPay, onCollect }: { r: Receivable; onPay: () => void; onCollect: () => void }) {
  const percent = r.totalCents > 0 ? Math.round((r.paidCents / r.totalCents) * 100) : 0
  return (
    <tr>
      <td><span className="fn-who"><span className="fn-avatar" aria-hidden="true">{initials(r.customerName)}</span><span className="zv-two"><Link to={`/pedidos/${r.orderId}`}>{r.customerName}</Link><span>Pedido nº {r.number}</span></span></span></td>
      <td>
        <span className="inv-stack">
          {r.paymentStatus === 'OVERDUE' && r.deliveredOn
          ? <StatusTag tone="danger">Atrasado · {sinceText(r.deliveredOn).replace('há ', '')}</StatusTag>
          : <OrderStatusBadge status={r.status} />}
          {r.status === 'DELIVERED' && <InvoiceTag number={r.invoiceNumber} />}
        </span>
      </td>
      <td>
        <span className="fn-paid">
          <span className="fn-paid__row"><b>{formatMoney(r.remainingCents)}</b><span>de {formatMoney(r.totalCents)}</span></span>
          <span className="fn-paid__bar"><i style={{ width: `${percent}%` }} /></span>
          <small>{percent}% já pago</small>
        </span>
      </td>
      <td className="zv-r zv-actions">
        <span>
          <button type="button" className="zv-btn zv-btn--sm" onClick={onCollect} data-testid="cobrar-linha"><MessageCircle size={20} strokeWidth={1.8} aria-hidden="true" />Cobrar</button>
          <button type="button" className="zv-btn zv-btn--sm" onClick={onPay} data-testid="pagar-linha"><Plus size={20} strokeWidth={1.8} aria-hidden="true" />Pagamento</button>
        </span>
      </td>
    </tr>
  )
}

function ListState({ loading, error, empty, emptyTitle, emptyText, onRetry }: { loading: boolean; error: unknown; empty: boolean; emptyTitle: string; emptyText: string; onRetry: () => void }) {
  if (loading) {
    return (
      <div className="cl-skeleton" role="status" aria-label="Carregando">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="cl-skeleton__row"><span style={{ width: `${55 + i * 8}%` }} /><span style={{ width: '25%' }} /></div>)}
      </div>
    )
  }
  if (error) {
    return (
      <div className="cl-state" role="alert">
        <p className="cl-state__title">Não foi possível carregar.</p>
        <p className="cl-state__text">Verifique sua conexão e tente de novo.</p>
        <Button className="btn--secondary" onClick={onRetry}>Tentar novamente</Button>
      </div>
    )
  }
  if (empty) {
    return (
      <div className="cl-state">
        <p className="cl-state__title">{emptyTitle}</p>
        <p className="cl-state__text">{emptyText}</p>
      </div>
    )
  }
  return null
}
