import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/ui/Pagination'
import { Toast } from '../../components/ui/Toast'
import { useRequest } from '../../hooks/useRequest'
import { formatMoney } from '../orcamentos/money'
import { formatDay, formatDayShort, isoDateTimeToDay, sinceText } from '../pedidos/dates'
import { METHOD_LABEL, ORDER_STATUS_LABEL } from '../pedidos/labels'
import { AlertIcon, PaymentStatusBadge } from '../pedidos/OrderBadges'
import { CollectDialog, ExpenseDialog, PaymentDialog } from '../pedidos/OrderDialogs'
import { getOrder } from '../pedidos/ordersApi'
import type { Order } from '../pedidos/types'
import { getFinancialSummary, getProfitReport, listReceivables, listReceivedPayments } from './financialApi'
import type { ProfitReport, Receivable, ReceivableFilter } from './financialApi'
import { useAuth } from '../auth/useAuth'
import { canSeeProfit } from '../pedidos/permissions'
import { ORDER_STATUS_LABEL as STATUS } from '../pedidos/labels'
import { PERIODS, periodRange, readPeriod } from './period'
import '../../components/ui/ButtonVariants.css'
import '../clientes/Clientes.css'
import '../orcamentos/Orcamentos.css'
import '../pedidos/Pedidos.css'
import './Financeiro.css'

// HU24 — Financeiro (não é contabilidade): quanto tem para receber, quem está devendo, quanto entrou.
// URL: ?aba=recebidos&periodo=LAST_30&filtro=OVERDUE&pagina=2

const PAGE_SIZE = 20
const FILTERS: { value: ReceivableFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'OVERDUE', label: 'Pagamento atrasado' },
  { value: 'OPEN', label: 'Ainda não entregue' },
]

type Action = { kind: 'pay' | 'collect'; row: Receivable } | { kind: 'expense'; order: Order } | null

export function FinancialPage() {
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const showProfit = canSeeProfit(user?.role)
  const aba = params.get('aba')
  const tab = aba === 'recebidos' ? 'received' : aba === 'lucro' && showProfit ? 'profit' : 'receivable'
  const period = readPeriod(params.get('periodo'))
  const filter = (FILTERS.find((f) => f.value === params.get('filtro'))?.value ?? 'ALL') as ReceivableFilter
  const page = Math.max(0, Number(params.get('pagina') ?? '1') - 1) || 0
  const range = periodRange(period)
  const search = params.get('busca') ?? ''
  const [term, setTerm] = useState(search)
  const [version, setVersion] = useState(0) // muda depois de pagar/cobrar → recarrega
  const [action, setAction] = useState<Action>(null)
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

  const summaryFetcher = useCallback(() => getFinancialSummary(range.from, range.to), [range.from, range.to])
  const summary = useRequest(`sum|${range.from}|${range.to}|${version}`, summaryFetcher)
  const recFetcher = useCallback(() => listReceivables(filter, search, page, PAGE_SIZE), [filter, search, page])
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
  const payFetcher = useCallback(() => listReceivedPayments(range.from, range.to, page, PAGE_SIZE), [range.from, range.to, page])
  const received = useRequest(`pay|${range.from}|${range.to}|${page}|${version}`, payFetcher)

  const profitFetcher = useCallback(() => (showProfit && tab === 'profit' ? getProfitReport(range.from, range.to) : Promise.resolve(null)), [showProfit, tab, range.from, range.to])
  const profit = useRequest(`lucro|${tab}|${range.from}|${range.to}|${version}`, profitFetcher)

  const s = summary.data
  const methods = s?.byMethod.map((m) => `${METHOD_LABEL[m.method]} ${formatMoney(m.amountCents)}`).join(' · ')

  function finished(message: string) {
    setAction(null)
    setVersion((n) => n + 1)
    setToast(message)
  }

  return (
    <>
      <PageHero
        eyebrow="Financeiro"
        title="Financeiro"
        subtitle="Quanto tem para receber, quem está devendo e quanto entrou."
        actions={
          <label className="fn-period">
            <span>Período</span>
            <select autoComplete="off" value={period} onChange={(e) => update({ periodo: e.target.value === 'THIS_MONTH' ? null : e.target.value, pagina: null })} data-testid="periodo">
              {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
        }
      />

      <main className="page-body">
        <section className="cl-card cl-card--elevated" aria-label="Resumo do financeiro">
          {summary.loading && <div className="fn-tiles">{[0, 1, 2].map((i) => <div key={i} className="fn-tile fn-tile--loading" aria-hidden="true" />)}</div>}
          {!summary.loading && Boolean(summary.error) && (
            <div className="cl-state" role="alert">
              <p className="cl-state__title">Não foi possível carregar o resumo.</p>
              <Button className="btn--secondary" onClick={() => setVersion((n) => n + 1)}>Tentar novamente</Button>
            </div>
          )}
          {s && (
            <div className="fn-tiles">
              <div className="fn-tile" data-testid="total-a-receber">
                <span className="fn-tile__label">A receber</span>
                <span className="fn-tile__value">{formatMoney(s.receivableCents)}</span>
                <span className="fn-tile__hint">{s.receivableOrders === 1 ? 'em 1 pedido' : `em ${s.receivableOrders} pedidos`}</span>
              </div>
              <button type="button" className={`fn-tile fn-tile--button${s.overdueOrders > 0 ? ' fn-tile--bad' : ''}`} onClick={() => update({ aba: null, filtro: 'OVERDUE', pagina: null })} data-testid="total-atrasado">
                <span className="fn-tile__label">{s.overdueOrders > 0 && <AlertIcon size={14} />}Pagamento atrasado</span>
                <span className="fn-tile__value">{formatMoney(s.overdueCents)}</span>
                <span className="fn-tile__hint">{s.overdueOrders === 0 ? 'ninguém devendo depois da entrega' : s.overdueOrders === 1 ? '1 pedido entregue e não pago' : `${s.overdueOrders} pedidos entregues e não pagos`}</span>
              </button>
              <div className="fn-tile" data-testid="total-recebido">
                <span className="fn-tile__label">Recebido {range.label}</span>
                <span className="fn-tile__value">{formatMoney(s.receivedCents)}</span>
                <span className="fn-tile__hint">{s.receivedPayments === 1 ? '1 pagamento' : `${s.receivedPayments} pagamentos`}{methods ? ` · ${methods}` : ''}</span>
              </div>
            </div>
          )}
        </section>

        <section className="cl-card" aria-label="Detalhes do financeiro">
          <div className="fn-tabs" role="tablist" aria-label="Financeiro">
            <button type="button" role="tab" aria-selected={tab === 'receivable'} className="fn-tab" onClick={() => update({ aba: null, pagina: null })} data-testid="aba-a-receber">
              A receber{receivables.data ? ` · ${receivables.data.totalElements}` : ''}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'received'} className="fn-tab" onClick={() => update({ aba: 'recebidos', pagina: null })} data-testid="aba-recebidos">
              Recebidos{s ? ` · ${s.receivedPayments}` : ''}
            </button>
            {showProfit && (
              <button type="button" role="tab" aria-selected={tab === 'profit'} className="fn-tab" onClick={() => update({ aba: 'lucro', pagina: null })} data-testid="aba-lucro">
                Gastos e lucro
              </button>
            )}
          </div>

          {tab === 'profit' ? (
            <>
              <ListState loading={profit.loading} error={profit.error} empty={false} emptyTitle="" emptyText="" onRetry={() => setVersion((n) => n + 1)} />
              {profit.data && <ProfitTab report={profit.data} label={range.label} from={range.from} to={range.to} onAddExpense={(id) => { void getOrder(id).then((order) => setAction({ kind: 'expense', order })).catch(() => setToast('Não foi possível abrir o pedido. Tente de novo.')) }} />}
            </>
          ) : tab === 'receivable' ? (
            <>
              <div className="oc-chips" role="group" aria-label="Filtrar">
                {FILTERS.map((f) => (
                  <button key={f.value} type="button" className="oc-chip" aria-pressed={filter === f.value} onClick={() => update({ filtro: f.value === 'ALL' ? null : f.value, pagina: null })}>{f.label}</button>
                ))}
              </div>
              <div role="search" className="cl-field fn-search">
                <label htmlFor="busca-financeiro" className="cl-field__label">Buscar</label>
                <div className="cl-search">
                  <svg className="cl-search__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                  <input id="busca-financeiro" type="search" className="cl-input cl-search__input" placeholder="Nome do cliente ou número do pedido" value={term}
                    onChange={(e) => setTerm(e.target.value)} autoComplete="off" aria-describedby="busca-fin-dica" data-testid="busca-financeiro" />
                </div>
                <p id="busca-fin-dica" className="cl-field__hint" aria-live="polite">{term.trim().length === 1 ? 'Digite pelo menos 2 caracteres para buscar.' : ''}</p>
              </div>
              <ListState loading={receivables.loading} error={receivables.error} empty={receivables.data?.totalElements === 0}
                emptyTitle={search ? `Nada a receber para "${search}".` : filter === 'OVERDUE' ? 'Ninguém devendo depois da entrega.' : 'Nada a receber.'} emptyText={search ? 'Confira o nome ou o número do pedido.' : 'Quando um pedido tiver valor em aberto, ele aparece aqui.'}
                onRetry={() => setVersion((n) => n + 1)} />
              {receivables.data && receivables.data.content.length > 0 && (
                <>
                  <ul className="fn-list" data-testid="lista-a-receber">
                    {receivables.data.content.map((r) => <ReceivableRow key={r.orderId} r={r} onPay={() => setAction({ kind: 'pay', row: r })} onCollect={() => setAction({ kind: 'collect', row: r })} />)}
                  </ul>
                  <Pagination page={receivables.data.page} totalPages={receivables.data.totalPages} size={receivables.data.size} total={receivables.data.totalElements} shown={receivables.data.content.length}
                    onChange={(p) => update({ pagina: p === 0 ? null : String(p + 1) })} />
                </>
              )}
            </>
          ) : (
            <>
              <p className="oc-small cl-muted">Pagamentos registrados {range.label} ({formatDay(range.from)} a {formatDay(range.to)}). Estornados não entram.</p>
              <ListState loading={received.loading} error={received.error} empty={received.data?.totalElements === 0}
                emptyTitle="Nenhum pagamento no período." emptyText="Escolha outro período no topo da página." onRetry={() => setVersion((n) => n + 1)} />
              {received.data && received.data.content.length > 0 && (
                <>
                  <table className="cl-table fn-table" data-testid="lista-recebidos">
                    <thead><tr><th scope="col">Data</th><th scope="col">Cliente</th><th scope="col">Pedido</th><th scope="col">Forma</th><th scope="col" className="oc-num">Valor</th></tr></thead>
                    <tbody>
                      {received.data.content.map((p) => (
                        <tr key={p.id}>
                          <td className="fn-table__date">{formatDay(p.paidAt)}</td>
                          <td className="fn-table__customer">{p.customerName}</td>
                          <td className="fn-table__order"><Link to={`/pedidos/${p.orderId}`}>#{p.orderNumber}</Link></td>
                          <td className="fn-table__method">{METHOD_LABEL[p.method]}</td>
                          <td className="oc-num fn-table__value">{formatMoney(p.amountCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination page={received.data.page} totalPages={received.data.totalPages} size={received.data.size} total={received.data.totalElements} shown={received.data.content.length}
                    onChange={(p) => update({ pagina: p === 0 ? null : String(p + 1) })} />
                </>
              )}
            </>
          )}
        </section>
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
        <ExpenseDialog order={action.order} expense={null} onCancel={() => setAction(null)} onDone={(o) => finished(`Gasto lançado no pedido #${o.number}.`)} />
      )}
      <Toast message={toast} onClose={clearToast} />
    </>
  )
}

// HU27 — Gastos e lucro do período (só ADMIN e MANAGER)
function ProfitTab({ report, label, from, to, onAddExpense }: { report: ProfitReport; label: string; from: string; to: string; onAddExpense: (orderId: number) => void }) {
  const neg = report.cashCents < 0
  const missing = report.orders.filter((o) => !o.hasExpenses || o.materialCents === 0 || o.laborCents === 0).length
  return (
    <div className="fn-profit">
      <p className="oc-small cl-muted">Dinheiro que entrou e saiu {label} ({formatDay(from)} a {formatDay(to)}).</p>
      <div className="fn-cash" data-testid="resumo-lucro">
        <div className="fn-cash__item"><span>Recebido</span><strong className="pd-plus">{formatMoney(report.receivedCents)}</strong></div>
        <span className="fn-cash__op" aria-hidden="true">−</span>
        <div className="fn-cash__item">
          <span>Gastos</span><strong>{formatMoney(report.expensesCents)}</strong>
          <span className="oc-small cl-muted"><i className="pd-dot is-material" />Material {formatMoney(report.materialCents)} · <i className="pd-dot is-labor" />Mão de obra {formatMoney(report.laborCents)}</span>
        </div>
        <span className="fn-cash__op" aria-hidden="true">=</span>
        <div className={`fn-cash__item fn-cash__result${neg ? ' is-neg' : ''}`}><span>Sobrou {label}</span><strong data-testid="sobrou-periodo">{formatMoney(report.cashCents)}</strong></div>
      </div>

      <h3 className="fn-subtitle">Quanto cada serviço deu</h3>
      {report.orders.length === 0 ? (
        <div className="cl-state"><p className="cl-state__title">Nenhum serviço com movimento no período.</p><p className="cl-state__text">Escolha outro período no topo da página.</p></div>
      ) : (
        <>
          {missing > 0 && <p className="fn-warn" role="note">{missing === 1 ? '1 serviço ainda não tem' : `${missing} serviços ainda não têm`} material e mão de obra lançados. Lance os dois para o lucro ficar certo.</p>}
          <ul className="fn-list" data-testid="lista-lucro">
            {report.orders.map((o) => {
              const loss = o.profitCents < 0
              const missing = !o.hasExpenses ? null : o.materialCents === 0 ? 'Falta lançar material' : o.laborCents === 0 ? 'Falta lançar mão de obra' : null
              const pct = o.totalCents > 0 ? Math.min(100, Math.max(0, (o.expensesCents / o.totalCents) * 100)) : 100
              return (
                <li key={o.orderId} className="fn-prow">
                  <span className="fn-row__who">
                    <span className="fn-row__title"><Link to={`/pedidos/${o.orderId}`}>{o.customerName}</Link></span>
                    <span className="cl-muted oc-small">Pedido #{o.number} · {STATUS[o.status]}</span>
                  </span>
                  <span className={`fn-prow__bar${o.hasExpenses ? '' : ' is-empty'}`} aria-hidden="true">{o.hasExpenses && <span style={{ width: `${pct}%` }} className={loss ? 'is-loss' : ''} />}</span>
                  <span className="fn-prow__nums cl-muted oc-small"><span>Serviço {formatMoney(o.totalCents)}</span><span>Gastos {formatMoney(o.expensesCents)}</span></span>
                  <span className="fn-row__rest">
                    {o.hasExpenses ? (
                      <>
                        <span className={missing && !loss ? 'fn-pending oc-small' : 'cl-muted oc-small'}>{loss ? 'Prejuízo' : missing ?? `Lucro · ${String(o.marginPercent).replace('.', ',')}%`}</span>
                        <strong className={loss ? 'fn-neg' : missing ? '' : 'fn-pos'}>{formatMoney(o.profitCents)}</strong>
                      </>
                    ) : (
                      <span className="cl-muted oc-small">Sem gastos lançados</span>
                    )}
                  </span>
                  <button type="button" className="btn btn--secondary fn-add" onClick={() => onAddExpense(o.orderId)} aria-label={`Lançar gasto no pedido ${o.number} de ${o.customerName}`} data-testid="lancar-gasto-linha">+ Lançar gasto</button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

function ReceivableRow({ r, onPay, onCollect }: { r: Receivable; onPay: () => void; onCollect: () => void }) {
  const overdue = r.paymentStatus === 'OVERDUE'
  let situation: string
  if (r.status === 'DELIVERED' && r.deliveredOn) situation = `Entregue ${sinceText(r.deliveredOn)}`
  else {
    situation = `${ORDER_STATUS_LABEL[r.status]} · pedido de ${formatDayShort(isoDateTimeToDay(r.createdAt))}`
  }
  const collected = r.lastCollectionAt ? `cobrado ${formatDayShort(isoDateTimeToDay(r.lastCollectionAt))}` : overdue ? 'nunca cobrado' : null
  return (
    <li className={`fn-row${overdue ? ' fn-row--overdue' : ''}`}>
      <span className="fn-row__who">
        <span className="fn-row__title"><Link to={`/pedidos/${r.orderId}`}>{r.customerName}</Link><PaymentStatusBadge status={r.paymentStatus} /></span>
        <span className="cl-muted oc-small">Pedido #{r.number} · {situation}{collected ? ` · ${collected}` : ''}</span>
      </span>
      <span className="fn-row__money cl-muted oc-small"><span>Total {formatMoney(r.totalCents)}</span><span>Recebido {formatMoney(r.paidCents)}</span></span>
      <span className="fn-row__rest"><span className="cl-muted oc-small">Falta</span><strong>{formatMoney(r.remainingCents)}</strong></span>
      <span className="fn-row__actions">
        <Button className="btn--secondary" onClick={onCollect} data-testid="cobrar-linha">Cobrar</Button>
        <Button className={overdue ? undefined : 'btn--secondary'} onClick={onPay} data-testid="pagar-linha">Registrar pagamento</Button>
      </span>
    </li>
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
