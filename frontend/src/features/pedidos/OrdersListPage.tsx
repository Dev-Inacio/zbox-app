import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/ui/Pagination'
import { useRequest } from '../../hooks/useRequest'
import { formatMoney } from '../orcamentos/money'
import { formatDay, isoDateTimeToDay, sinceText } from './dates'
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from './labels'
import { OrderStatusBadge, PaymentStatusBadge } from './OrderBadges'
import { countOrders, listOrders } from './ordersApi'
import type { OrderStatusFilter, OrderSummary, PaymentStatus } from './types'
import '../../components/ui/ButtonVariants.css'
import '../clientes/Clientes.css'
import '../orcamentos/Orcamentos.css'
import './Pedidos.css'

// HU20 — Listar pedidos. Filtros na URL: ?status=IN_PRODUCTION&pagamento=OVERDUE&busca=45&pagina=2

const PAGE_SIZE = 20
const MIN_SEARCH = 2
const STATUS_TABS: OrderStatusFilter[] = ['ALL', 'NEW', 'IN_PRODUCTION', 'READY', 'DELIVERED', 'CANCELED']
const PAYMENTS: (PaymentStatus | 'ALL')[] = ['ALL', 'UNPAID', 'PARTIAL', 'PAID', 'OVERDUE']

function readStatus(v: string | null): OrderStatusFilter {
  return STATUS_TABS.includes(v as OrderStatusFilter) ? (v as OrderStatusFilter) : 'ALL'
}
function readPayment(v: string | null): PaymentStatus | 'ALL' {
  return PAYMENTS.includes(v as PaymentStatus) ? (v as PaymentStatus) : 'ALL'
}

export function OrdersListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('busca') ?? ''
  const status = readStatus(searchParams.get('status'))
  const payment = readPayment(searchParams.get('pagamento'))
  const page = Math.max(0, Number(searchParams.get('pagina') ?? '1') - 1) || 0
  const [term, setTerm] = useState(search)
  const [attempt, setAttempt] = useState(0)

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(changes)) {
          if (v === null || v === '') next.delete(k)
          else next.set(k, v)
        }
        return next
      })
    },
    [setSearchParams],
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      const value = term.trim()
      const effective = value.length >= MIN_SEARCH ? value : ''
      if (effective !== search) updateParams({ busca: effective, pagina: null })
    }, 300)
    return () => clearTimeout(timer)
  }, [term, search, updateParams])

  const fetchList = useCallback(() => listOrders({ search, status, payment, page, size: PAGE_SIZE }), [search, status, payment, page])
  const { loading, data, error } = useRequest(`${search}|${status}|${payment}|${page}|${attempt}`, fetchList)
  const counts = useRequest(`counts#${attempt}`, countOrders)

  const hasFilters = search !== '' || status !== 'ALL' || payment !== 'ALL'
  const c = counts.data

  return (
    <>
      <PageHero
        eyebrow="Operação"
        title="Pedidos"
        subtitle={c ? subtitle(c.IN_PRODUCTION, c.READY) : ' '}
      />

      <main className="page-body">
        <section className="cl-card cl-card--elevated" aria-labelledby="titulo-pedidos">
          <div className="cl-card__header">
            <h2 id="titulo-pedidos" className="cl-card__title">Todos os pedidos</h2>
            <span className="cl-card__badge">Dados de exemplo</span>
          </div>

          <div className="oc-chips" role="group" aria-label="Filtrar por andamento">
            {STATUS_TABS.map((s) => (
              <button key={s} type="button" className="oc-chip" aria-pressed={status === s} onClick={() => updateParams({ status: s === 'ALL' ? null : s, pagina: null })}>
                {s === 'ALL' ? 'Todos' : ORDER_STATUS_LABEL[s as keyof typeof ORDER_STATUS_LABEL]}
                <span className="oc-chip__count">{c ? c[s as keyof typeof c] : '–'}</span>
              </button>
            ))}
          </div>

          <div role="search" className="oc-filters">
            <div className="cl-field">
              <label htmlFor="busca-pedidos" className="cl-field__label">Buscar</label>
              <div className="cl-search">
                <svg className="cl-search__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                <input id="busca-pedidos" type="search" className="cl-input cl-search__input" placeholder="Número ou nome do cliente" value={term}
                  onChange={(e) => setTerm(e.target.value)} autoComplete="off" aria-describedby="busca-ped-dica" />
              </div>
              <p id="busca-ped-dica" className="cl-field__hint" aria-live="polite">{term.trim().length === 1 ? 'Digite pelo menos 2 caracteres para buscar.' : ''}</p>
            </div>
            <div className="cl-field">
              <label htmlFor="pagamento-pedidos" className="cl-field__label">Pagamento</label>
              <select autoComplete="off" id="pagamento-pedidos" className="cl-input" value={payment} onChange={(e) => updateParams({ pagamento: e.target.value === 'ALL' ? null : e.target.value, pagina: null })}>
                {PAYMENTS.map((p) => <option key={p} value={p}>{p === 'ALL' ? 'Todos' : PAYMENT_STATUS_LABEL[p]}</option>)}
              </select>
            </div>
          </div>

          {loading && (
            <div className="cl-skeleton" role="status" aria-label="Carregando pedidos">
              {Array.from({ length: 5 }, (_, i) => <div key={i} className="cl-skeleton__row"><span style={{ width: `${50 + i * 7}%` }} /><span style={{ width: '30%' }} /></div>)}
            </div>
          )}

          {!loading && Boolean(error) && (
            <div className="cl-state" role="alert">
              <span className="cl-state__icon cl-state__icon--error" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 16.5v.5" /></svg>
              </span>
              <p className="cl-state__title">Não foi possível carregar os pedidos.</p>
              <p className="cl-state__text">Verifique sua conexão e tente de novo.</p>
              <Button className="btn--secondary" onClick={() => setAttempt((n) => n + 1)}>Tentar novamente</Button>
            </div>
          )}

          {data && data.totalElements === 0 && (
            <div className="cl-state">
              <span className="cl-state__icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l9-4 9 4-9 4z" /><path d="M3 7v10l9 4 9-4V7" /></svg>
              </span>
              {hasFilters ? (
                <>
                  <p className="cl-state__title">Nenhum pedido encontrado.</p>
                  <p className="cl-state__text">Tente outro termo ou limpe os filtros.</p>
                  <Button className="btn--secondary" onClick={() => { setTerm(''); setSearchParams(new URLSearchParams()) }}>Limpar filtros</Button>
                </>
              ) : (
                <>
                  <p className="cl-state__title">Nenhum pedido ainda.</p>
                  <p className="cl-state__text">Pedidos nascem de orçamentos aprovados: abra um orçamento aprovado e clique em "Transformar em pedido".</p>
                  <Link to="/orcamentos?status=APPROVED" className="cl-cta">Ver orçamentos aprovados</Link>
                </>
              )}
            </div>
          )}

          {data && data.totalElements > 0 && data.content.length === 0 && (
            <div className="cl-state">
              <p className="cl-state__title">Esta página não tem pedidos.</p>
              <Button className="btn--secondary" onClick={() => updateParams({ pagina: null })}>Ir para a primeira página</Button>
            </div>
          )}

          {data && data.content.length > 0 && (
            <>
              <OrderTable items={data.content} />
              <Pagination
                page={data.page} totalPages={data.totalPages} size={data.size} total={data.totalElements} shown={data.content.length}
                onChange={(p) => { updateParams({ pagina: p === 0 ? null : String(p + 1) }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              />
            </>
          )}
        </section>
      </main>
    </>
  )
}

function subtitle(inProduction: number, ready: number): string {
  const prod = inProduction === 1 ? '1 pedido em produção' : `${inProduction} pedidos em produção`
  if (ready === 0) return prod
  return `${prod} · ${ready === 1 ? '1 pronto para entregar' : `${ready} prontos para entregar`}`
}

// Sem prazo de entrega (decisão da PO): mostra quando o pedido foi feito e há quanto tempo.
// Entregue mostra a data da entrega.
function DateCell({ o }: { o: OrderSummary }) {
  if (o.status === 'DELIVERED' && o.deliveredOn) return <span className="pd-due"><span>entregue {formatDay(o.deliveredOn).slice(0, 5)}</span></span>
  const day = isoDateTimeToDay(o.createdAt)
  return (
    <span className="pd-due">
      <span>{formatDay(day)}</span>
      {o.status !== 'CANCELED' && <span className="pd-due__hint">{sinceText(day)}</span>}
    </span>
  )
}

export function OrderTable({ items, showCustomer = true }: { items: OrderSummary[]; showCustomer?: boolean }) {
  return (
    <table className="cl-table pd-table" data-testid="tabela-pedidos">
      <thead>
        <tr>
          <th scope="col">Pedido</th>
          {showCustomer && <th scope="col">Cliente</th>}
          <th scope="col">Data</th>
          <th scope="col">Andamento</th>
          <th scope="col">Pagamento</th>
          <th scope="col" className="oc-num">Total</th>
          <th scope="col" className="oc-num">Falta receber</th>
        </tr>
      </thead>
      <tbody>
        {items.map((o) => (
          <tr key={o.id}>
            <td className="cl-table__name pd-table__num"><Link to={`/pedidos/${o.id}`}>#{o.number}</Link></td>
            {showCustomer && <td className="pd-table__customer">{o.customerName}</td>}
            <td className="pd-table__due"><DateCell o={o} /></td>
            <td className="pd-table__status"><OrderStatusBadge status={o.status} /></td>
            <td className="pd-table__pay"><PaymentStatusBadge status={o.paymentStatus} /></td>
            <td className="oc-num pd-table__total">{formatMoney(o.totalCents)}</td>
            <td className={`oc-num pd-table__rest${o.paymentStatus === 'OVERDUE' ? ' is-overdue' : ''}`}>
              {o.remainingCents > 0 && o.status !== 'CANCELED' ? <><span className="pd-table__rest-label">Falta </span>{formatMoney(o.remainingCents)}</> : <span className="cl-muted">—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
