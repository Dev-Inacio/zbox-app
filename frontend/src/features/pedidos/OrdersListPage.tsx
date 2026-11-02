import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/ui/Pagination'
import { useRequest } from '../../hooks/useRequest'
import { formatMoney } from '../orcamentos/money'
import { formatDay, isoDateTimeToDay, sinceText } from './dates'
import { OrderStatusBadge, PaymentStatusBadge } from './OrderBadges'
import { InvoiceTag } from './Invoice'
import { countOrders, listOrders } from './ordersApi'
import { ListFilters, SegFilter } from '../../components/zbox'
import type { OrderStatusFilter, OrderSummary, PaymentStatus } from './types'
import { AppIcon } from '../../components/ui/AppIcon'
import '../../components/ui/ButtonVariants.css'
import '../clientes/Clientes.css'
import '../orcamentos/Orcamentos.css'
import './Pedidos.css'

// HU20 — Listar pedidos. Filtros na URL: ?status=IN_PRODUCTION&pagamento=OVERDUE&busca=45&pagina=2

const PAGE_SIZE = 10
const MIN_SEARCH = 2
const STATUS_TABS: OrderStatusFilter[] = ['ALL', 'NEW', 'IN_PRODUCTION', 'READY', 'DELIVERED', 'CANCELED']
const SEG: { value: OrderStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' }, { value: 'NEW', label: 'Novos' }, { value: 'IN_PRODUCTION', label: 'Em produção' },
  { value: 'READY', label: 'Prontos' }, { value: 'DELIVERED', label: 'Entregues' },
]
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
        subtitle={c ? `${c.NEW + c.IN_PRODUCTION + c.READY} em andamento · ${c.OVERDUE_PAYMENT} com pagamento atrasado` : ' '}
      />

      <main className="page-body">
        <section className="zv-card" aria-label="Lista de pedidos">
          <ListFilters value={term} onChange={setTerm} placeholder="Buscar por número ou cliente"
            hint={term.trim().length === 1 ? 'Digite pelo menos 2 caracteres para buscar.' : undefined}>
            <SegFilter label="Andamento" options={SEG} value={status} onChange={(v) => updateParams({ status: v === 'ALL' ? null : v, pagina: null })} />
          </ListFilters>

          {loading && (
            <div className="cl-skeleton" role="status" aria-label="Carregando pedidos">
              {Array.from({ length: 5 }, (_, i) => <div key={i} className="cl-skeleton__row"><span style={{ width: `${50 + i * 7}%` }} /><span style={{ width: '30%' }} /></div>)}
            </div>
          )}

          {!loading && Boolean(error) && (
            <div className="cl-state" role="alert">
              <span className="cl-state__icon cl-state__icon--error" aria-hidden="true">
                <AppIcon name="alert" size={26} />
              </span>
              <p className="cl-state__title">Não foi possível carregar os pedidos.</p>
              <p className="cl-state__text">Verifique sua conexão e tente de novo.</p>
              <Button className="btn--secondary" onClick={() => setAttempt((n) => n + 1)}>Tentar novamente</Button>
            </div>
          )}

          {data && data.totalElements === 0 && (
            <div className="cl-state">
              <span className="cl-state__icon" aria-hidden="true">
                <AppIcon name="order" size={26} />
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

// Sem prazo de entrega (decisão da PO): mostra quando o pedido foi feito e há quanto tempo.
// Entregue mostra a data da entrega.
function DateCell({ o }: { o: OrderSummary }) {
  const day = o.status === 'DELIVERED' && o.deliveredOn ? o.deliveredOn : isoDateTimeToDay(o.createdAt)
  return (
    <span className="zv-two">
      <span>{formatDay(day)}</span>
      <span>{o.status === 'DELIVERED' ? 'entregue' : o.status === 'CANCELED' ? 'cancelado' : sinceText(day)}</span>
    </span>
  )
}

function OrderTable({ items }: { items: OrderSummary[] }) {
  return (
    <div className="zv-table-wrap">
      <table className="zv-table" data-testid="tabela-pedidos">
        <thead>
          <tr>
            <th scope="col">Pedido</th>
            <th scope="col">Andamento</th>
            <th scope="col">Pagamento</th>
            <th scope="col">Data</th>
            <th scope="col" className="zv-r">Total</th>
            <th scope="col"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((o) => (
            <tr key={o.id}>
              <td>
                <span className="zv-two">
                  <Link to={`/pedidos/${o.id}`}>Nº {o.number}</Link>
                  <span>{o.customerName}</span>
                </span>
              </td>
              <td><OrderStatusBadge status={o.status} /></td>
              <td><span className="inv-stack"><PaymentStatusBadge status={o.paymentStatus} />{o.status === 'DELIVERED' && <InvoiceTag number={o.invoiceNumber} />}</span></td>
              <td className="zv-m-hide"><DateCell o={o} /></td>
              <td className="zv-r"><span className="pd-list-money"><b>{formatMoney(o.totalCents)}</b>{o.status !== 'CANCELED' && <span data-testid="lista-falta">{o.remainingCents > 0 ? `Falta ${formatMoney(o.remainingCents)}` : 'Tudo pago'}</span>}</span></td>
              <td className="zv-r zv-m-hide"><Link to={`/pedidos/${o.id}`} className="zv-btn zv-btn--sm" tabIndex={-1} aria-label={`Ver pedido ${o.number}`}>Ver</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
