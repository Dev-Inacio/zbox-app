import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Toast } from '../../components/ui/Toast'
import { useFlashMessage } from '../../hooks/useFlashMessage'
import { useRequest } from '../../hooks/useRequest'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../auth/types'
import { formatDateTime, maskPhone, whatsappLink } from '../clientes/format'
import { CardSkeleton, CustomerLoadError } from '../clientes/CustomerLoadStates'
import { formatAreaM2, formatMeters, formatMoney } from '../orcamentos/money'
import { formatDay, formatDayShort, isoDateTimeToDay, sinceText } from './dates'
import { METHOD_LABEL, NEXT_STEP, ORDER_STATUS_LABEL, ORDER_STEPS, PREVIOUS_STEP } from './labels'
import { AlertIcon, OrderStatusBadge, PaymentStatusBadge } from './OrderBadges'
import { CancelOrderDialog, CollectDialog, DeliverDialog, PaymentDialog, ReversePaymentDialog } from './OrderDialogs'
import { canReversePayment } from './permissions'
import { changeOrderStatus, getOrder } from './ordersApi'
import type { Order, OrderEvent, OrderStatus, Payment } from './types'
import '../../components/ui/ButtonVariants.css'
import '../clientes/Clientes.css'
import '../orcamentos/Orcamentos.css'
import './Pedidos.css'

// HU21 (andamento), HU22 (entregar), HU23 (pagamentos), HU24 (cobrar).
// Regra de ouro: andamento e pagamento são coisas separadas. Entregar não é receber.

type DialogKind = 'pay' | 'deliver' | 'cancel' | 'collect' | 'back' | { reverse: Payment } | null

export function OrderDetailPage() {
  const { id } = useParams()
  return <OrderDetail key={id} id={Number(id)} />
}

function OrderDetail({ id }: { id: number }) {
  const { user } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const fetcher = useCallback(() => getOrder(id), [id])
  const request = useRequest(`${id}|${attempt}`, fetcher)
  const [toast, setToast, clearToast] = useFlashMessage()
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [stepBusy, setStepBusy] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)

  const o = request.data
  if (!o) {
    return (
      <>
        <PageHero title={request.loading ? 'Carregando…' : 'Pedido'} back={{ to: '/pedidos', label: 'Voltar para pedidos' }} />
        <main className="page-body">{request.loading ? <CardSkeleton /> : <CustomerLoadError error={request.error} onRetry={() => setAttempt((n) => n + 1)} />}</main>
      </>
    )
  }
  const order = o

  function done(message: string) {
    return (updated: Order) => {
      request.setData(updated)
      setDialog(null)
      setToast(message)
    }
  }

  async function moveTo(to: OrderStatus, message: string) {
    if (stepBusy) return
    setStepBusy(true)
    setStepError(null)
    try {
      done(message)(await changeOrderStatus(order.id, to))
    } catch (e) {
      if (e instanceof ApiError && e.code === 'INVALID_ORDER_STATUS_TRANSITION') {
        setDialog(null)
        setAttempt((n) => n + 1)
        setToast('O pedido mudou de situação. A tela foi atualizada.')
      } else {
        setStepError(e instanceof ApiError ? e.message : 'Não foi possível salvar. Verifique sua conexão e tente de novo.')
      }
    } finally {
      setStepBusy(false)
    }
  }

  const active = order.status === 'NEW' || order.status === 'IN_PRODUCTION' || order.status === 'READY'
  const canCharge = order.status !== 'CANCELED' && order.remainingCents > 0
  const collectTarget = { id: order.id, number: order.number, customerName: order.customer.name, customerWhatsapp: order.customer.whatsapp, remainingCents: order.remainingCents, deliveredOn: order.deliveredOn }

  return (
    <>
      <PageHero
        title={`Pedido #${order.number}`}
        back={{ to: '/pedidos', label: 'Voltar para pedidos' }}
        badge={<span className="pd-badges"><OrderStatusBadge status={order.status} /><PaymentStatusBadge status={order.paymentStatus} /></span>}
        subtitle={<>{order.customer.name} · do orçamento <Link to={`/orcamentos/${order.quote.id}?versao=${order.quote.version}`} className="pd-hero-link">#{order.quote.number} v{order.quote.version}</Link> · criado em {formatDay(isoDateTimeToDay(order.createdAt))}</>}
      />

      <main className="page-body oc-layout pd-layout">
        <div className="oc-layout__main">
          <section className="cl-card cl-card--elevated" aria-label="Andamento do pedido">
            {order.status !== 'CANCELED' && <Steps status={order.status} />}
            <StepPanel order={order} busy={stepBusy}
              onNext={() => {
                const next = NEXT_STEP[order.status]
                if (!next) return
                if (next.to === 'DELIVERED') setDialog('deliver')
                else void moveTo(next.to, next.to === 'IN_PRODUCTION' ? 'Produção iniciada.' : 'Pedido marcado como pronto.')
              }}
            />
            {stepError && <Alert variant="error">{stepError}</Alert>}
            {active && PREVIOUS_STEP[order.status] && (
              <div className="pd-links">
                {(
                  <button type="button" className="pd-textlink" onClick={() => setDialog('back')}>Voltar para {ORDER_STATUS_LABEL[PREVIOUS_STEP[order.status]!]}</button>
                )}
              </div>
            )}
          </section>

          <section className="cl-card" aria-labelledby="t-itens-ped">
            <h2 id="t-itens-ped" className="cl-card__title">Itens</h2>
            <table className="oc-items-table">
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="oc-items-table__name">{item.description}</span>
                      {item.chargeType === 'AREA' && item.widthCm && item.heightCm && (
                        <span className="cl-muted oc-small">{item.quantity} {item.quantity === 1 ? 'peça' : 'peças'} de {formatMeters(item.widthCm)} × {formatMeters(item.heightCm)} m</span>
                      )}
                    </td>
                    <td className="cl-muted">
                      {item.chargeType === 'AREA'
                        ? `${formatAreaM2((item.areaPerPieceCm2 ?? 0) * item.quantity)} m² × ${formatMoney(item.unitPriceCents)}`
                        : `${item.quantity} ${item.unit ?? 'un'} × ${formatMoney(item.unitPriceCents)}`}
                    </td>
                    <td className="oc-num oc-strong">{formatMoney(item.subtotalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pd-items-total">
              {order.discountCents > 0 && <><span>Subtotal {formatMoney(order.subtotalCents)}</span><span>Desconto − {formatMoney(order.discountCents)}</span></>}
              <strong>Total {formatMoney(order.totalCents)}</strong>
            </div>
          </section>

          <section className="cl-card" aria-labelledby="t-cliente-ped">
            <h2 id="t-cliente-ped" className="cl-card__title">Cliente</h2>
            <div className="pd-customer">
              <span className="pd-customer__text">
                <Link to={`/clientes/${order.customer.id}`} className="pd-customer__name">{order.customer.name}</Link>
                <span className="cl-muted oc-small">{[order.customer.whatsapp ? maskPhone(order.customer.whatsapp) : order.customer.phone ? maskPhone(order.customer.phone) : null, order.customer.addressLine].filter(Boolean).join(' · ') || 'Sem contato cadastrado'}</span>
              </span>
              {order.customer.whatsapp && (
                <a className="btn btn--secondary pd-btn-link" href={whatsappLink(order.customer.whatsapp)} target="_blank" rel="noopener noreferrer"><WhatsIcon />WhatsApp</a>
              )}
            </div>
          </section>

          <section className="cl-card" aria-labelledby="t-hist-ped">
            <h2 id="t-hist-ped" className="cl-card__title">Histórico</h2>
            <ol className="oc-events" data-testid="historico-pedido">
              {order.events.map((ev) => (
                <li key={ev.id} className="oc-event">
                  <span className={`oc-event__icon pd-ev--${ev.type.toLowerCase()}`} aria-hidden="true">{eventIcon(ev)}</span>
                  <span className="oc-event__text">
                    <span className="oc-event__title">{eventText(ev)}</span>
                    <span className="cl-muted oc-small">por {ev.userName}</span>
                  </span>
                  <time className="cl-muted oc-small" dateTime={ev.createdAt}>{formatDateTime(ev.createdAt)}</time>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="oc-aside">
          <PaymentCard order={order} canReverse={canReversePayment(user?.role)}
            onPay={() => setDialog('pay')} onCollect={() => setDialog('collect')} onReverse={(p) => setDialog({ reverse: p })} />
          {active && <Button className="btn--danger-outline" fullWidth onClick={() => setDialog('cancel')} data-testid="cancelar-pedido">Cancelar pedido</Button>}
        </aside>
      </main>

      {dialog === 'pay' && canCharge && (
        <PaymentDialog target={{ id: order.id, number: order.number, customerName: order.customer.name, remainingCents: order.remainingCents }}
          onCancel={() => setDialog(null)} onDone={(u) => done(u.paymentStatus === 'PAID' ? 'Pagamento registrado. Pedido pago!' : `Pagamento registrado. Falta ${formatMoney(u.remainingCents)}.`)(u)} />
      )}
      {dialog === 'deliver' && (
        <DeliverDialog order={order} onCancel={() => setDialog(null)}
          onDone={(u) => done(u.paymentStatus === 'OVERDUE' ? `Entregue. Falta receber ${formatMoney(u.remainingCents)}: ficou em Pagamento atrasado.` : 'Pedido entregue e pago.')(u)} />
      )}
      {dialog === 'cancel' && <CancelOrderDialog order={order} onCancel={() => setDialog(null)} onDone={done('Pedido cancelado.')} />}
      {dialog === 'collect' && canCharge && <CollectDialog target={collectTarget} onCancel={() => setDialog(null)} onDone={done('WhatsApp aberto. Confira a mensagem e envie por lá.')} />}
      {dialog !== null && typeof dialog === 'object' && (
        <ReversePaymentDialog order={order} payment={dialog.reverse} onCancel={() => setDialog(null)} onDone={done('Pagamento estornado.')} />
      )}
      <ConfirmDialog
        open={dialog === 'back'} title={`Voltar para ${ORDER_STATUS_LABEL[PREVIOUS_STEP[order.status] ?? 'NEW']}?`} confirmLabel="Voltar etapa" loading={stepBusy} loadingText="Salvando…"
        onCancel={() => setDialog(null)} onConfirm={() => { const prev = PREVIOUS_STEP[order.status]; if (prev) void moveTo(prev, `Pedido voltou para ${ORDER_STATUS_LABEL[prev]}.`) }}
      >
        <p>Use só para corrigir um engano. A mudança fica registrada no histórico.</p>
      </ConfirmDialog>

      <Toast message={toast} onClose={clearToast} />
    </>
  )
}

// ---------- Etapas ----------
function Steps({ status }: { status: OrderStatus }) {
  const current = ORDER_STEPS.indexOf(status)
  return (
    <ol className="oc-stepper" aria-label="Etapas do pedido">
      {ORDER_STEPS.map((s, i) => {
        const state = i < current || status === 'DELIVERED' ? 'done' : i === current ? 'current' : 'todo'
        return (
          <li key={s} className={`oc-stepper__step is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="oc-stepper__bar" />
            <span className="oc-stepper__label">{state === 'done' ? '✓ ' : ''}{ORDER_STATUS_LABEL[s]}</span>
          </li>
        )
      })}
    </ol>
  )
}

function StepPanel({ order, busy, onNext }: { order: Order; busy: boolean; onNext: () => void }) {
  if (order.status === 'CANCELED') {
    return (
      <div className="oc-banner">
        <div><strong>Pedido cancelado</strong><span>{order.canceledAt ? `Em ${formatDateTime(order.canceledAt)}. ` : ''}Motivo: {order.cancelReason}</span></div>
      </div>
    )
  }
  if (order.status === 'DELIVERED') {
    return (
      <div className="oc-banner oc-banner--ok">
        <div>
          <strong>Entregue em {order.deliveredOn ? formatDay(order.deliveredOn) : '—'}{order.deliveredOn ? ` (${sinceText(order.deliveredOn)})` : ''}</strong>
          <span>Recebido por {order.receivedBy}{order.deliveryNote ? ` · ${order.deliveryNote}` : ''}</span>
        </div>
      </div>
    )
  }
  const next = NEXT_STEP[order.status]!
  const createdDay = isoDateTimeToDay(order.createdAt)
  return (
    <div className={`pd-step-panel pd-step-panel--${order.status.toLowerCase()}`}>
      <div className="oc-panel__text">
        <h2 className="oc-panel__title">{ORDER_STATUS_LABEL[order.status]}</h2>
        <p>
          Pedido feito em <strong>{formatDay(createdDay)}</strong> ({sinceText(createdDay)})
        </p>
      </div>
      <Button onClick={onNext} loading={busy} loadingText="Salvando…" data-testid="proxima-etapa">
        {next.to === 'DELIVERED' ? <TruckIcon /> : next.to === 'IN_PRODUCTION' ? <PlayIcon /> : <CheckIcon />}
        {next.label}
      </Button>
    </div>
  )
}

// ---------- Pagamento ----------
function PaymentCard({ order, canReverse, onPay, onCollect, onReverse }: { order: Order; canReverse: boolean; onPay: () => void; onCollect: () => void; onReverse: (p: Payment) => void }) {
  const pct = order.totalCents > 0 ? Math.min(100, Math.round((order.paidCents / order.totalCents) * 100)) : 0
  const overdue = order.paymentStatus === 'OVERDUE'
  const owes = order.remainingCents > 0 && order.status !== 'CANCELED'
  return (
    <section className={`oc-summary pd-pay${overdue ? ' pd-pay--overdue' : ''}`} aria-labelledby="t-pagamento" data-testid="cartao-pagamento">
      <h2 id="t-pagamento" className="cl-card__title">Pagamento</h2>
      <div className="oc-summary__row"><span>Total do pedido</span><span>{formatMoney(order.totalCents)}</span></div>
      <div className="oc-summary__row"><span>Recebido</span><span className="pd-plus" data-testid="recebido">{formatMoney(order.paidCents)}</span></div>
      <div className="pd-progress" role="img" aria-label={`${pct}% recebido`}><span style={{ width: `${pct}%` }} /></div>
      <div className="oc-summary__total">
        {order.remainingCents > 0 ? (
          <>
            <span className={overdue ? 'pd-overdue-label' : 'cl-muted'}>{overdue && <AlertIcon size={14} />}{overdue ? 'Falta receber · pagamento atrasado' : 'Falta receber'}</span>
            <span className="oc-summary__value" data-testid="falta-receber">{formatMoney(order.remainingCents)}</span>
          </>
        ) : (
          <span className="pd-paid-ok">Tudo recebido.</span>
        )}
      </div>
      {owes && <Button fullWidth onClick={onPay} data-testid="registrar-pagamento"><CashIcon />Registrar pagamento</Button>}
      {owes && (order.status === 'DELIVERED' || order.paidCents > 0) && (
        <Button className="btn--secondary" fullWidth onClick={onCollect} data-testid="cobrar"><WhatsIcon />Cobrar pelo WhatsApp</Button>
      )}
      {order.lastCollectionAt && owes && <p className="oc-small cl-muted">Última cobrança: {formatDayShort(isoDateTimeToDay(order.lastCollectionAt))} ({sinceText(isoDateTimeToDay(order.lastCollectionAt))})</p>}

      <div className="pd-pay__list">
        <span className="pd-overline">Pagamentos</span>
        {order.payments.length === 0 ? (
          <p className="oc-small cl-muted">Nenhum pagamento registrado ainda.</p>
        ) : (
          <ul className="pd-payments">
            {order.payments.map((p) => (
              <li key={p.id} className={p.reversed ? 'is-reversed' : undefined}>
                <span className="pd-payments__main">
                  <span className="pd-payments__value">{formatMoney(p.amountCents)}</span>
                  <span className="cl-muted oc-small">{METHOD_LABEL[p.method]} · {formatDay(p.paidAt)}{p.note ? ` · ${p.note}` : ''}</span>
                  {p.reversed && <span className="oc-small pd-reversed">Estornado: {p.reversedReason}</span>}
                </span>
                <span className="pd-payments__side">
                  <span className="cl-muted oc-small">{p.userName}</span>
                  {canReverse && !p.reversed && <button type="button" className="pd-textlink pd-textlink--small" onClick={() => onReverse(p)}>Estornar</button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {order.paymentTerms && <p className="oc-small cl-muted">Combinado: {order.paymentTerms}</p>}
    </section>
  )
}

// ---------- Histórico ----------
function eventText(ev: OrderEvent): string {
  switch (ev.type) {
    case 'CREATED': return `Pedido criado do orçamento #${ev.detail ?? ''}`
    case 'STATUS_CHANGED': {
      const [from, to] = (ev.detail ?? '').split('→') as [OrderStatus, OrderStatus]
      if (to === 'IN_PRODUCTION' && from === 'NEW') return 'Produção iniciada'
      if (to === 'READY') return 'Pedido pronto'
      return `Voltou para ${ORDER_STATUS_LABEL[to] ?? to}`
    }
    case 'DELIVERED': return `Entregue · recebido por ${ev.detail ?? '—'}`
    case 'PAYMENT': return `Pagamento de ${ev.detail ?? ''}`
    case 'PAYMENT_REVERSED': return `Pagamento estornado · ${ev.detail ?? ''}`
    case 'COLLECTION': return 'Cobrado pelo WhatsApp'
    case 'CANCELED': return `Cancelado · ${ev.detail ?? ''}`
  }
}

function eventIcon(ev: OrderEvent) {
  switch (ev.type) {
    case 'PAYMENT':
    case 'PAYMENT_REVERSED': return <CashIcon />
    case 'DELIVERED': return <TruckIcon />
    case 'COLLECTION': return <WhatsIcon />
    case 'STATUS_CHANGED': return ev.detail?.endsWith('READY') ? <CheckIcon /> : <PlayIcon />
    case 'CANCELED': return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 18L18 6" /></svg>
    default: return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l9-4 9 4-9 4z" /><path d="M3 7v10l9 4 9-4V7" /></svg>
  }
}

// ---------- Ícones ----------
function WhatsIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z" /></svg>
}
function CashIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><path d="M7 15h3" /></svg>
}
function TruckIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h11v10H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>
}
function PlayIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 5l11 7-11 7z" /></svg>
}
function CheckIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
}
