import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { MapPin, MoreHorizontal, Pencil, Phone, StickyNote, UserCheck, UserPlus, UserX } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import type { IconTone } from '../../components/ui/IconBadge'
import { Toast } from '../../components/ui/Toast'
import { ActivityList, CountChip } from '../../components/zbox'
import { useFlashMessage } from '../../hooks/useFlashMessage'
import { PagedList } from '../../components/ui/PagedList'
import { useRequest } from '../../hooks/useRequest'
import { ApiError } from '../auth/types'
import { useAuth } from '../auth/useAuth'
import { StatusBadge } from './CustomerBadges'
import { CardSkeleton, CustomerLoadError } from './CustomerLoadStates'
import { activateCustomer, deactivateCustomer, getCustomer, getCustomerHistory } from './customersApi'
import { customerMobile, formatDate, formatDateTime, maskCep, maskPhone, typeLabel, whatsappLink } from './format'
import { canChangeCustomerStatus } from './permissions'
import { listQuotes } from '../orcamentos/quotesApi'
import { QuoteStatusBadge } from '../orcamentos/QuoteStatusBadge'
import type { QuoteSummary } from '../orcamentos/types'
import { formatMoney } from '../orcamentos/money'
import { listOrders } from '../pedidos/ordersApi'
import { OrderStatusBadge, PaymentStatusBadge } from '../pedidos/OrderBadges'
import type { OrderSummary } from '../pedidos/types'
import { formatDay, isoDateTimeToDay } from '../pedidos/dates'
import { METHOD_LABEL } from '../pedidos/labels'
import { listPaymentsByCustomer } from '../financeiro/financialApi'
import type { ReceivedPayment } from '../financeiro/financialApi'
import type { Page } from './types'
import type { Customer, CustomerHistoryItem } from './types'
import { AppIcon } from '../../components/ui/AppIcon'
import '../../components/ui/ButtonVariants.css'
import './Clientes.css'

// HU11 — Ver detalhe do cliente. Também é onde se desativa/reativa (HU10).

const initials = (name: string) => name.trim().split(/\s+/).filter((_, i, a) => i === 0 || i === a.length - 1).map((p) => p[0]).join('').toUpperCase()

export function CustomerDetailPage() {
  const { id } = useParams()
  // key no id: trocar de cliente recria a página do zero (sem dado velho na tela)
  return <CustomerDetail key={id} id={Number(id)} />
}

function CustomerDetail({ id }: { id: number }) {
  const { user } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [historyAttempt, setHistoryAttempt] = useState(0)
  const [toast, setToast, clearToast] = useFlashMessage()
  const [dialog, setDialog] = useState<'deactivate' | 'activate' | null>(null)
  const [changing, setChanging] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)

  const fetchCustomer = useCallback(() => getCustomer(id), [id])
  const fetchHistory = useCallback(() => getCustomerHistory(id), [id])
  const customer = useRequest(`${id}#${attempt}`, fetchCustomer)
  const history = useRequest(`${id}#${historyAttempt}`, fetchHistory)
  const fetchQuotes = useCallback(() => listQuotes({ search: '', status: 'ALL', period: 'ALL', customerId: id, page: 0, size: 100 }), [id])
  const quotes = useRequest(`orcamentos-${id}`, fetchQuotes)
  // Pedidos do cliente: até 50 para somar "A receber" (no back real, um campo no resumo do cliente resolve isso)
  const fetchOrders = useCallback(() => listOrders({ search: '', status: 'ALL', payment: 'ALL', customerId: id, page: 0, size: 100 }), [id])
  const orders = useRequest(`pedidos-${id}`, fetchOrders)
  const fetchPayments = useCallback(() => listPaymentsByCustomer(id), [id])
  const payments = useRequest(`pagamentos-${id}`, fetchPayments)
  const receivable = orders.data ? orders.data.content.filter((o) => o.status !== 'CANCELED').reduce((sum, o) => sum + o.remainingCents, 0) : null

  const canChangeStatus = canChangeCustomerStatus(user?.role)
  const [activeTab, setActiveTab] = useState(0)


  async function changeStatus() {
    if (!dialog) return
    setChanging(true)
    setDialogError(null)
    try {
      const updated = dialog === 'deactivate' ? await deactivateCustomer(id) : await activateCustomer(id)
      customer.setData(updated)
      setToast(dialog === 'deactivate' ? 'Cliente desativado.' : 'Cliente reativado.')
      setDialog(null)
      setHistoryAttempt((n) => n + 1) // o histórico ganhou uma linha nova
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setDialogError('Você não tem permissão para fazer isso.')
      } else if (error instanceof ApiError && error.status === 409) {
        // Alguém mudou antes de nós: recarrega para mostrar a situação real e avisa
        setDialog(null)
        setAttempt((n) => n + 1)
        setHistoryAttempt((n) => n + 1)
        setToast(dialog === 'deactivate' ? 'Este cliente já estava desativado. A tela foi atualizada.' : 'Este cliente já estava ativo. A tela foi atualizada.')
      } else {
        setDialogError('Não foi possível concluir. Verifique sua conexão e tente de novo.')
      }
    } finally {
      setChanging(false)
    }
  }

  function openDialog(kind: 'deactivate' | 'activate') {
    setDialogError(null)
    setDialog(kind)
  }

  const c = customer.data

  if (!c) {
    return (
      <>
        <PageHero title={customer.loading ? 'Carregando…' : 'Cliente'} back={{ to: '/clientes', label: 'Voltar para clientes' }} />
        <main className="page-body">
          {customer.loading ? <CardSkeleton /> : <CustomerLoadError error={customer.error} onRetry={() => setAttempt((n) => n + 1)} />}
        </main>
      </>
    )
  }

  const inactive = c.status === 'INACTIVE'
  const mobile = customerMobile(c)

  return (
    <>
      <PageHero
        title={c.name}
        avatar={initials(c.name)}
        back={{ to: '/clientes', label: 'Voltar para clientes' }}
        badge={<StatusBadge status={c.status} />}
        subtitle={`${typeLabel(c.type)} · Cliente desde ${formatDate(c.createdAt)}`}
        actions={
          <>
            {mobile && (
              <a className="cl-hero-btn" href={whatsappLink(mobile)} target="_blank" rel="noopener noreferrer" data-testid="abrir-whatsapp">
                <AppIcon name="chat" size={24} />
                WhatsApp
                <span className="sr-only">(abre em nova aba)</span>
              </a>
            )}
            <Link className="cl-hero-btn" to={`/clientes/${c.id}/editar`} data-testid="editar-cliente">
              <AppIcon name="edit" size={24} />
              Editar
            </Link>
            {inactive ? (
              <button type="button" className="cl-cta" disabled title="Cliente desativado não recebe orçamento">Novo orçamento</button>
            ) : (
              <Link to={`/orcamentos/novo?cliente=${c.id}`} className="cl-cta" data-testid="cliente-novo-orcamento">
                <AppIcon name="plus" size={24} onAccent />
                Novo orçamento
              </Link>
            )}
            {canChangeStatus && !inactive && <MoreMenu onDeactivate={() => openDialog('deactivate')} />}
          </>
        }
      />

      <main className="page-body cl-detail">
        {inactive && (
          <div className="cl-inactive-banner" role="status">
            <AppIcon name="cancel" size={24} />
            <div className="cl-inactive-banner__text">
              <strong>Este cliente está desativado.</strong>
              {c.deactivatedAt && (
                <span>Desativado{c.deactivatedBy ? ` por ${c.deactivatedBy}` : ''} em {formatDate(c.deactivatedAt)}.</span>
              )}
            </div>
            {canChangeStatus && (
              <Button className="btn--secondary" onClick={() => openDialog('activate')} data-testid="reativar-cliente">
                Reativar cliente
              </Button>
            )}
          </div>
        )}

        <div className="cl-detail__grid">
          <div className="cl-detail__main">
            <section className="zv-card" aria-labelledby="titulo-resumo">
              <h2 id="titulo-resumo" className="zv-h2">Resumo</h2>
              <ul className="zv-tiles">
                <li><span>Orçamentos</span><b>{quotes.data ? quotes.data.totalElements : '–'}</b><span>{quotes.data ? awaitingText(quotes.data.content) : ''}</span></li>
                <li><span>Pedidos</span><b>{orders.data ? orders.data.totalElements : '–'}</b><span>{orders.data ? productionText(orders.data.content) : ''}</span></li>
                <li><span>Falta receber</span><b>{receivable === null ? '–' : formatMoney(receivable)}</b><span>{orders.data ? receivableText(orders.data.content) : ''}</span></li>
              </ul>
            </section>

            <MovementTabs active={activeTab} onChange={setActiveTab} quotes={quotes} orders={orders} payments={payments} newQuoteHref={inactive ? null : `/orcamentos/novo?cliente=${c.id}`} />

            <section className="zv-card" aria-labelledby="titulo-historico">
              <h2 id="titulo-historico" className="zv-h2">Histórico</h2>
              <HistoryList state={history} onRetry={() => setHistoryAttempt((n) => n + 1)} />
            </section>
          </div>

          <aside className="cl-detail__side">
            <CustomerData customer={c} />

          </aside>
        </div>
      </main>

      <ConfirmDialog
        open={dialog !== null}
        title={dialog === 'deactivate' ? `Desativar ${c.name}?` : `Reativar ${c.name}?`}
        confirmLabel={dialog === 'deactivate' ? 'Desativar cliente' : 'Reativar cliente'}
        variant={dialog === 'deactivate' ? 'danger' : 'primary'}
        loading={changing}
        loadingText={dialog === 'deactivate' ? 'Desativando…' : 'Reativando…'}
        onConfirm={changeStatus}
        onCancel={() => setDialog(null)}
      >
        {dialog === 'deactivate' ? (
          <p>Ele deixa de aparecer na busca de novos orçamentos. O histórico continua salvo e você pode reativar depois.</p>
        ) : (
          <p>Ele volta a aparecer na lista de clientes ativos e na busca de novos orçamentos.</p>
        )}
        {dialogError && <Alert variant="error">{dialogError}</Alert>}
      </ConfirmDialog>

      <Toast message={toast} onClose={clearToast} />
    </>
  )
}

// ---------- Abas: Orçamentos / Pedidos / Pagamentos ----------
// As setas ← → trocam de aba (padrão de acessibilidade de tabs).

const TABS = [
  { id: 'orcamentos', label: 'Orçamentos', empty: 'Nenhum orçamento para este cliente.' },
  { id: 'pedidos', label: 'Pedidos', empty: 'Nenhum pedido para este cliente.' },
  { id: 'pagamentos', label: 'Pagamentos', empty: 'Nenhum pagamento para este cliente.' },
] as const

type Loadable<T> = { loading: boolean; data?: T; error?: unknown }

const QUOTE_STATUS_WORD: Record<QuoteSummary['status'], string> = {
  DRAFT: 'Criado', CONFIRMED: 'Confirmado', SENT: 'Enviado', APPROVED: 'Aprovado', REJECTED: 'Recusado', CANCELED: 'Cancelado', SUPERSEDED: 'Criado',
}

function awaitingText(items: QuoteSummary[]) {
  const n = items.filter((q) => q.status === 'SENT').length
  return `${n} aguardando resposta`
}

function productionText(items: OrderSummary[]) {
  const n = items.filter((o) => o.status === 'IN_PRODUCTION').length
  return `${n === 1 ? 'em produção' : `${n} em produção`}`
}

function receivableText(items: OrderSummary[]) {
  const open = items.filter((o) => o.status !== 'CANCELED' && o.remainingCents > 0)
  if (open.length === 0) return 'nada em aberto'
  const total = open.reduce((sum, o) => sum + o.totalCents, 0)
  return `de ${formatMoney(total)}`
}

function QuoteRows({ items }: { items: QuoteSummary[] }) {
  return (
    <div className="zv-table-wrap">
      <table className="zv-table">
        <thead><tr><th scope="col">Orçamento</th><th scope="col">Situação</th><th scope="col" className="zv-r">Total</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
        <tbody>
          {items.map((q) => {
            const word = q.statusAt ? QUOTE_STATUS_WORD[q.status] : 'Criado'
            return (
              <tr key={q.id}>
                <td><span className="zv-two"><Link to={`/orcamentos/${q.id}`}>Nº {q.number}</Link><span>{q.orderNumber ? `Virou o pedido nº ${q.orderNumber}` : `${word} em ${formatDay(isoDateTimeToDay(q.statusAt ?? q.createdAt))}`}</span></span></td>
                <td><QuoteStatusBadge status={q.status} /></td>
                <td className="zv-r"><b>{formatMoney(q.totalCents)}</b></td>
                <td className="zv-r zv-m-hide"><Link to={`/orcamentos/${q.id}`} className="zv-btn zv-btn--sm" tabIndex={-1} aria-label={`Ver orçamento ${q.number}`}>Ver</Link></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function OrderRows({ items }: { items: OrderSummary[] }) {
  return (
    <div className="zv-table-wrap">
      <table className="zv-table">
        <thead><tr><th scope="col">Pedido</th><th scope="col">Situação</th><th scope="col" className="zv-r">Falta receber</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
        <tbody>
          {items.map((o) => {
            const owes = o.status !== 'CANCELED' && o.remainingCents > 0
            return (
              <tr key={o.id}>
                <td><span className="zv-two"><Link to={`/pedidos/${o.id}`}>Nº {o.number}</Link><span>Criado em {formatDay(isoDateTimeToDay(o.createdAt))}</span></span></td>
                <td><span className="zv-tags"><OrderStatusBadge status={o.status} />{o.status !== 'CANCELED' && <PaymentStatusBadge status={o.paymentStatus} />}</span></td>
                <td className="zv-r"><b>{formatMoney(owes ? o.remainingCents : 0)}</b></td>
                <td className="zv-r zv-m-hide"><Link to={`/pedidos/${o.id}`} className="zv-btn zv-btn--sm" tabIndex={-1} aria-label={`Ver pedido ${o.number}`}>Ver</Link></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PaymentRows({ items }: { items: ReceivedPayment[] }) {
  return (
    <div className="zv-table-wrap">
      <table className="zv-table">
        <thead><tr><th scope="col">Pagamento</th><th scope="col">Forma</th><th scope="col" className="zv-r">Recebido</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td><span className="zv-two"><Link to={`/pedidos/${p.orderId}`}>{p.refund ? 'Devolução' : p.note === 'Entrada' ? 'Entrada' : 'Pagamento'} · pedido nº {p.orderNumber}</Link><span>{formatDay(p.paidAt)} · por {p.userName}{p.refund ? ` · ${p.note}` : ''}</span></span></td>
              <td>{METHOD_LABEL[p.method]}</td>
              <td className={`zv-r ${p.refund ? 'zv-late' : 'zv-green'}`}><b>{p.refund ? '−' : '+'} {formatMoney(p.amountCents)}</b></td>
              <td className="zv-r zv-m-hide"><Link to={`/pedidos/${p.orderId}`} className="zv-btn zv-btn--sm" tabIndex={-1} aria-label={`Ver pedido ${p.orderNumber}`}>Ver</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MovementTabs({ active, onChange, quotes, orders, payments, newQuoteHref }: {
  active: number; onChange: (index: number) => void
  quotes: Loadable<Page<QuoteSummary>>; orders: Loadable<Page<OrderSummary>>; payments: Loadable<ReceivedPayment[]>; newQuoteHref: string | null
}) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 }
    if (event.key in moves) {
      event.preventDefault()
      const next = (active + moves[event.key] + TABS.length) % TABS.length
      onChange(next)
      tabRefs.current[next]?.focus()
    }
  }

  const tab = TABS[active]
  const counts = [quotes.data?.totalElements, orders.data?.totalElements, payments.data?.length]
  const loading = tab.id === 'orcamentos' ? quotes.loading : tab.id === 'pedidos' ? orders.loading : payments.loading
  const hasData =
    tab.id === 'orcamentos' ? Boolean(quotes.data?.content.length)
      : tab.id === 'pedidos' ? Boolean(orders.data?.content.length)
        : Boolean(payments.data?.length)

  return (
    <section className="zv-card" aria-labelledby="titulo-movimentacao">
      <h2 id="titulo-movimentacao" className="zv-h2">Orçamentos, pedidos e pagamentos</h2>
      <div className="cl-tabs" role="tablist" aria-label="Movimentação do cliente">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`aba-${t.id}`}
            aria-selected={i === active}
            aria-controls={`painel-${t.id}`}
            tabIndex={i === active ? 0 : -1}
            className="cl-tabs__tab"
            onClick={() => onChange(i)}
            onKeyDown={handleKeyDown}
          >
            {t.label}
            {counts[i] !== undefined && <> <CountChip>{counts[i]}</CountChip></>}
          </button>
        ))}
      </div>
      {hasData ? (
        <div role="tabpanel" id={`painel-${tab.id}`} aria-labelledby={`aba-${tab.id}`}>
          {tab.id === 'orcamentos' && quotes.data && (
            <PagedList items={quotes.data.content} noun="orçamentos" render={(items) => <QuoteRows items={items} />} />
          )}
          {tab.id === 'pedidos' && orders.data && (
            <PagedList items={orders.data.content} noun="pedidos" render={(items) => <OrderRows items={items} />} />
          )}
          {tab.id === 'pagamentos' && payments.data && (
            <PagedList items={payments.data} noun="pagamentos" render={(items) => <PaymentRows items={items} />} />
          )}
        </div>
      ) : (
        <div className="cl-state cl-state--compact" role="tabpanel" id={`painel-${tab.id}`} aria-labelledby={`aba-${tab.id}`}>
          <span className="cl-state__icon" aria-hidden="true">
            <AppIcon name="quote" size={24} />
          </span>
          {loading ? (
            <p className="cl-state__text" role="status">Carregando…</p>
          ) : (
            <>
              <p className="cl-state__title">{tab.empty}</p>
              {tab.id === 'orcamentos' && newQuoteHref && <Link to={newQuoteHref} className="cl-cta">Criar orçamento</Link>}
              {tab.id === 'pedidos' && <p className="cl-state__text">Pedidos nascem de orçamentos aprovados.</p>}
              {tab.id === 'pagamentos' && <p className="cl-state__text">Pagamentos são registrados nos pedidos.</p>}
            </>
          )}
        </div>
      )}
    </section>
  )
}

// ---------- Histórico (vem do AuditLog) ----------
// "…" do cabeçalho: ação que não é do dia a dia fica guardada aqui
function MoreMenu({ onDeactivate }: { onDeactivate: () => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="cl-more" ref={box}>
      <button type="button" className="cl-hero-btn cl-more__btn" aria-label="Mais opções" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-testid="cliente-mais-opcoes">
        <MoreHorizontal size={24} aria-hidden="true" />
      </button>
      {open && (
        <div className="cl-more__menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onDeactivate() }} data-testid="desativar-cliente">
            <AppIcon name="cancel" size={24} />Desativar cliente
          </button>
        </div>
      )}
    </div>
  )
}

const FIELD_LABELS: Record<string, string> = {
  name: 'nome', type: 'tipo', phone: 'celular', whatsapp: 'celular', address: 'endereço', notes: 'observações',
}

function describe(item: CustomerHistoryItem): string {
  switch (item.action) {
    case 'CREATED':
      return 'Cliente cadastrado'
    case 'DEACTIVATED':
      return 'Cliente desativado'
    case 'ACTIVATED':
      return 'Cliente reativado'
    case 'UPDATED': {
      const fields = [...new Set(item.changedFields.map((f) => FIELD_LABELS[f] ?? f))] // telefone e WhatsApp viraram "celular"
      if (fields.length === 0) return 'Dados alterados'
      if (fields.length === 1 && fields[0] !== 'observações') return `${fields[0][0].toUpperCase()}${fields[0].slice(1)} alterado`
      return `Alterado: ${fields.join(', ')}`
    }
  }
}

const HISTORY_ICON: Record<CustomerHistoryItem['action'], [LucideIcon, IconTone]> = {
  CREATED: [UserPlus, 'teal'], UPDATED: [Pencil, 'blue'], DEACTIVATED: [UserX, 'gray'], ACTIVATED: [UserCheck, 'green'],
}

type HistoryState = { loading: boolean; data?: CustomerHistoryItem[]; error?: unknown }

// Contato, endereço e observações num card só. O que o cliente não tem não aparece.
function DataRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="zv-data">
      <span className="zv-data__icon"><Icon size={22} strokeWidth={1.8} aria-hidden="true" /></span>
      <span className="zv-data__text"><span>{label}</span><span>{children}</span></span>
    </div>
  )
}

function CustomerData({ customer: c }: { customer: Customer }) {
  const a = c.address
  const mobile = customerMobile(c)
  const street = [[a.street, a.number].filter(Boolean).join(', '), a.complement].filter(Boolean).join(' · ')
  const place = [a.district, [a.city, a.state].filter(Boolean).join('/'), a.zipCode ? `CEP ${maskCep(a.zipCode)}` : null].filter(Boolean).join(' · ')
  return (
    <section className="zv-card zv-card--data" aria-labelledby="titulo-dados">
      <h2 id="titulo-dados" className="zv-h2">Dados do cliente</h2>
      <div>
        {!mobile && !street && !place && !c.notes && <p className="zv-sub">Só o nome foi informado.</p>}
        {mobile && <DataRow icon={Phone} label="Celular (WhatsApp)">{maskPhone(mobile)}</DataRow>}
        {(street || place) && <DataRow icon={MapPin} label="Endereço">{street}{street && place && <br />}{place && <span className="zv-data__light">{place}</span>}</DataRow>}
        {c.notes && <DataRow icon={StickyNote} label="Observações"><span className="zv-data__light cl-notes">{c.notes}</span></DataRow>}
      </div>
    </section>
  )
}

function HistoryList({ state, onRetry }: { state: HistoryState; onRetry: () => void }) {
  if (state.loading) {
    return (
      <div className="cl-skeleton" role="status" aria-label="Carregando histórico">
        <div className="cl-skeleton__row"><span style={{ width: '60%' }} /><span style={{ width: '30%' }} /></div>
        <div className="cl-skeleton__row"><span style={{ width: '50%' }} /><span style={{ width: '25%' }} /></div>
      </div>
    )
  }

  if (!state.data) {
    return (
      <div className="cl-inline-error" role="alert">
        <span>Não foi possível carregar o histórico.</span>
        <Button className="btn--secondary" onClick={onRetry}>Tentar novamente</Button>
      </div>
    )
  }

  if (state.data.length === 0) return <p className="cl-muted">Nenhum registro ainda.</p>

  return (
    <ActivityList items={state.data.map((item) => {
      const [icon, tone] = HISTORY_ICON[item.action]
      return { id: item.id, icon, tone, title: describe(item), subtitle: item.userName?.trim() ? `por ${item.userName}` : undefined, when: formatDateTime(item.createdAt) }
    })} />
  )
}
