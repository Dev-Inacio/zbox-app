import { useCallback, useState } from 'react'
import { CircleCheck, Info, Plus, Zap } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { AppIcon } from '../../components/ui/AppIcon'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { CustomerCard } from '../../components/zbox/CustomerCard'
import { PagedList } from '../../components/ui/PagedList'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Toast } from '../../components/ui/Toast'
import { ItemsCard } from '../../components/zbox'
import { useFlashMessage } from '../../hooks/useFlashMessage'
import { useRequest } from '../../hooks/useRequest'
import { INVOICE_ENABLED, InvoiceCard, InvoiceDialog, InvoiceFileDialog, InvoiceTag } from './Invoice'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../auth/types'
import { customerMobile, formatDateTime } from '../clientes/format'
import { CardSkeleton, CustomerLoadError } from '../clientes/CustomerLoadStates'
import { discountLabel, toItemView } from '../orcamentos/itemView'
import { formatMoney } from '../orcamentos/money'
import { formatDay, formatDayShort, isoDateTimeToDay, sinceText } from './dates'
import { EXPENSE_TYPE_LABEL, METHOD_LABEL, NEXT_STEP, ORDER_STATUS_LABEL, ORDER_STEPS, PREVIOUS_STEP } from './labels'
import { OrderStatusBadge, PaymentStatusBadge } from './OrderBadges'
import { CancelOrderDialog, CancelRefundDialog, CollectDialog, DeleteExpenseDialog, DeliverDialog, ExpenseDialog, PaymentDialog, RefundDialog, ReversePaymentDialog } from './OrderDialogs'
import { canReversePayment, canEditInvoice, canSeeProfit } from './permissions'
import { formatPercentBR, LABOR_GOOD_PERCENT, LABOR_MIN_PERCENT, profitView } from './profitHealth'
import type { HealthResult, ProfitHealth } from './profitHealth'
import { changeOrderStatus, getOrder } from './ordersApi'
import type { Order, OrderEvent, OrderExpense, OrderRefund, OrderStatus, Payment } from './types'
import '../../components/ui/ButtonVariants.css'
import '../clientes/Clientes.css'
import '../orcamentos/Orcamentos.css'
import './Pedidos.css'

// HU21 (andamento), HU22 (entregar), HU23 (pagamentos), HU24 (cobrar).
// Regra de ouro: andamento e pagamento são coisas separadas. Entregar não é receber.

type DialogKind = 'pay' | 'deliver' | 'cancel' | 'collect' | 'back' | 'expense' | 'invoice' | 'invoiceView' | 'refund' | { refundFrom: Payment } | { cancelRefund: OrderRefund } | { reverse: Payment } | { editExpense: OrderExpense } | { deleteExpense: OrderExpense } | null

export function OrderDetailPage() {
  const { id } = useParams()
  return <OrderDetail key={id} id={Number(id)} />
}

function OrderDetail({ id }: { id: number }) {
  const flash = (useLocation().state as { flash?: string } | null)?.flash ?? null
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
  const collectTarget = { id: order.id, number: order.number, customerName: order.customer.name, customerWhatsapp: customerMobile(order.customer), remainingCents: order.remainingCents, deliveredOn: order.deliveredOn }

  return (
    <>
      <PageHero
        title={`Pedido nº ${order.number}`}
        back={{ to: '/pedidos', label: 'Voltar para pedidos' }}
        badge={<span className="zv-tags"><OrderStatusBadge status={order.status} /><PaymentStatusBadge status={order.paymentStatus} />{order.invoice && <InvoiceTag number={order.invoice.number} />}</span>}
        subtitle={order.directSale
          ? <span className="pd-direct"><Zap size={18} strokeWidth={1.8} aria-hidden="true" /><span>{order.customer.name} · <b>Venda direta</b> · sem orçamento enviado · <Link to={`/orcamentos/${order.quote.id}`} className="pd-hero-link">ver orçamento guardado</Link> · criado em {formatDay(isoDateTimeToDay(order.createdAt))}</span></span>
          : <>{order.customer.name} · do orçamento <Link to={`/orcamentos/${order.quote.id}?versao=${order.quote.version}`} className="pd-hero-link">#{order.quote.number} v{order.quote.version}</Link> · criado em {formatDay(isoDateTimeToDay(order.createdAt))}</>}
      />

      {flash && <div role="status" className="pd-flash"><CircleCheck size={24} strokeWidth={1.8} aria-hidden="true" /><span>{flash}</span></div>}
      <main className="page-body oc-layout pd-layout">
        <div className="oc-layout__main">
          <section className="zv-card zv-card--steps" aria-labelledby="t-andamento">
            <h2 id="t-andamento" className="zv-h2">Andamento</h2>
            {order.status !== 'CANCELED' && <Steps order={order} />}
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

          <ItemsCard items={order.items.map(toItemView)} versionLabel={`Do orçamento nº ${order.quote.number} · ${order.quote.version}ª proposta`} />

          <CustomerCard customer={order.customer} />

          <section className="cl-card" aria-labelledby="t-hist-ped">
            <h2 id="t-hist-ped" className="cl-card__title">Histórico</h2>
            <PagedList items={order.events} noun="registros" render={(events) => (
            <ol className="oc-events" data-testid="historico-pedido">
              {events.map((ev) => (
                <li key={ev.id} className="oc-event">
                  <span className="oc-event__icon" aria-hidden="true">{eventIcon(ev)}</span>
                  <span className="oc-event__text">
                    <span className="oc-event__title">{eventText(ev)}</span>
                    <span className="cl-muted oc-small">por {ev.userName}</span>
                  </span>
                  <time className="cl-muted oc-small" dateTime={ev.createdAt}>{formatDateTime(ev.createdAt)}</time>
                </li>
              ))}
            </ol>
            )} />
          </section>
        </div>

        <aside className="oc-aside">
          <PaymentCard order={order} canReverse={canReversePayment(user?.role)}
            onPay={() => setDialog('pay')} onCollect={() => setDialog('collect')} onReverse={(p) => setDialog({ reverse: p })} onRefund={() => setDialog('refund')} onCancelRefund={(r) => setDialog({ cancelRefund: r })} />
          {INVOICE_ENABLED && <InvoiceCard order={order} canEdit={canEditInvoice(user?.role)} onEdit={() => setDialog('invoice')} onView={() => setDialog('invoiceView')} />}
          {canSeeProfit(user?.role) && order.profit && order.expenses && (
            <ProfitCard order={order} onAdd={() => setDialog('expense')} onEdit={(e) => setDialog({ editExpense: e })} onDelete={(e) => setDialog({ deleteExpense: e })} />
          )}
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
      {dialog === 'invoice' && <InvoiceDialog order={order} onCancel={() => setDialog(null)} onDone={(u, n) => done(`Nota fiscal ${n} anotada no pedido.`)(u)} />}
      {dialog === 'invoiceView' && <InvoiceFileDialog order={order} onClose={() => setDialog(null)} />}
      {dialog === 'expense' && <ExpenseDialog order={order} expense={null} onCancel={() => setDialog(null)} onDone={(u) => done('Material lançado.')(u)} />}
      {dialog !== null && typeof dialog === 'object' && 'editExpense' in dialog && (
        <ExpenseDialog order={order} expense={dialog.editExpense} onCancel={() => setDialog(null)} onDone={(u) => done('Gasto corrigido.')(u)} />
      )}
      {dialog !== null && typeof dialog === 'object' && 'deleteExpense' in dialog && (
        <DeleteExpenseDialog order={order} expense={dialog.deleteExpense} onCancel={() => setDialog(null)} onDone={(u) => done('Gasto excluído.')(u)} />
      )}
      {dialog === 'refund' && <RefundDialog order={order} onCancel={() => setDialog(null)} onDone={(u, message) => done(message ?? 'Devolução registrada.')(u)} />}
      {dialog !== null && typeof dialog === 'object' && 'refundFrom' in dialog && <RefundDialog order={order} from={dialog.refundFrom} onCancel={() => setDialog(null)} onDone={(u, message) => done(message ?? 'Devolução registrada.')(u)} />}
      {dialog !== null && typeof dialog === 'object' && 'cancelRefund' in dialog && (
        <CancelRefundDialog order={order} refund={dialog.cancelRefund} onCancel={() => setDialog(null)} onDone={done('Devolução desfeita.')} />
      )}
      {dialog !== null && typeof dialog === 'object' && 'reverse' in dialog && (
        <ReversePaymentDialog order={order} payment={dialog.reverse} onCancel={() => setDialog(null)} onDone={done('Pagamento estornado.')} onRefundInstead={() => setDialog({ refundFrom: dialog.reverse })} />
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
function Steps({ order }: { order: Order }) {
  const status = order.status
  const current = ORDER_STEPS.indexOf(status)
  const created = formatDayShort(isoDateTimeToDay(order.createdAt))
  return (
    <ol className="zv-steps" aria-label="Etapas do pedido">
      {ORDER_STEPS.map((s, i) => {
        const state = i < current || status === 'DELIVERED' ? 'done' : i === current ? 'current' : 'todo'
        const when = s === 'NEW' ? created : s === 'DELIVERED' && order.deliveredOn ? formatDayShort(order.deliveredOn) : null
        return (
          <li key={s} className={`is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="zv-steps__bar" />
            <span className="zv-steps__label">{state === 'done' ? '✓ ' : ''}{ORDER_STATUS_LABEL[s]}</span>
            {when && <span className="zv-steps__when">{when}</span>}
          </li>
        )
      })}
    </ol>
  )
}

const NEXT_TEXT: Partial<Record<OrderStatus, string>> = {
  NEW: 'Próximo passo: quando começar a fazer, inicie a produção.',
  IN_PRODUCTION: 'Próximo passo: quando a produção terminar, marque como pronto.',
  READY: 'Próximo passo: quando entregar ao cliente, marque como entregue.',
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
  return (
    <div className="zv-next">
      <span>{NEXT_TEXT[order.status]}</span>
      <Button className="btn--secondary" onClick={onNext} loading={busy} loadingText="Salvando…" data-testid="proxima-etapa">
        {next.to === 'DELIVERED' ? <TruckIcon /> : next.to === 'IN_PRODUCTION' ? <PlayIcon /> : <CheckIcon />}
        {next.label}
      </Button>
    </div>
  )
}

// ---------- Pagamento ----------
function PaymentCard({ order, canReverse, onPay, onCollect, onReverse, onRefund, onCancelRefund }: { order: Order; canReverse: boolean; onPay: () => void; onCollect: () => void; onReverse: (p: Payment) => void; onRefund: () => void; onCancelRefund: (r: OrderRefund) => void }) {
  const pct = order.totalCents > 0 ? Math.min(100, Math.round((order.paidCents / order.totalCents) * 100)) : 0
  const overdue = order.paymentStatus === 'OVERDUE'
  const owes = order.remainingCents > 0 && order.status !== 'CANCELED'
  return (
    <section className="zv-card zv-card--side" aria-labelledby="t-pagamento" data-testid="cartao-pagamento">
      <div>
        <h2 id="t-pagamento" className="zv-h2">Pagamento</h2>
        <div className="zv-card__tag"><PaymentStatusBadge status={order.paymentStatus} /></div>
      </div>
      <dl className="zv-sum">
        {order.discountCents > 0 && <div><dt>Subtotal</dt><dd>{formatMoney(order.subtotalCents)}</dd></div>}
        {order.discountCents > 0 && <div className="zv-sum__off"><dt>Desconto{discountLabel(order.discountType, order.discountValue) ? ` (${discountLabel(order.discountType, order.discountValue)})` : ''}</dt><dd>− {formatMoney(order.discountCents)}</dd></div>}
        <div className="zv-sum__total" data-testid="total"><dt>Total do pedido</dt><dd>{formatMoney(order.totalCents)}</dd></div>
        <div><dt>Já recebido</dt><dd className="zv-sum__in" data-testid="recebido">{formatMoney(order.paidCents)}</dd></div>
        {order.refundedCents > 0 && <div className="zv-sum__refund"><dt>Devolvido ao cliente</dt><dd data-testid="devolvido">− {formatMoney(order.refundedCents)}</dd></div>}
        {order.waivedCents > 0 && <div className="zv-sum__refund"><dt>Não será cobrado</dt><dd data-testid="nao-cobrado">− {formatMoney(order.waivedCents)}</dd></div>}
      </dl>
      <div className="zv-bar" role="img" aria-label={`${pct}% recebido`}><span style={{ width: `${pct}%` }} /></div>
      {order.remainingCents > 0 ? (
        <div className={`zv-left${overdue ? ' is-late' : ''}`}>
          <span>{overdue ? 'Falta receber · atrasado' : 'Falta receber'}</span>
          <b data-testid="falta-receber">{formatMoney(order.remainingCents)}</b>
        </div>
      ) : (
        <div className="zv-note zv-note--success"><span><b>{order.waivedCents > 0 || order.refundedCents > 0 ? 'Nada a receber' : 'Tudo recebido'}</b></span></div>
      )}
      {owes && <button type="button" className="zv-btn zv-btn--primary zv-btn--big zv-btn--full" onClick={onPay} data-testid="registrar-pagamento"><CashIcon />Registrar pagamento</button>}
      {owes && (order.status === 'DELIVERED' || order.paidCents > 0) && (
        <button type="button" className="zv-btn zv-btn--full" onClick={onCollect} data-testid="cobrar"><WhatsIcon />Cobrar pelo WhatsApp</button>
      )}
      {order.lastCollectionAt && owes && <span className="zv-small">Última cobrança: {formatDayShort(isoDateTimeToDay(order.lastCollectionAt))}</span>}

      <b className="zv-side-title">Pagamentos</b>
      {order.payments.length === 0 ? (
        <span className="zv-small">Nenhum pagamento registrado ainda.</span>
      ) : (
        <PagedList items={order.payments} noun="pagamentos" render={(payments) => (
        <ul className="zv-pays">
          {payments.map((p) => (
            <li key={p.id} className={p.reversed ? 'is-reversed' : undefined}>
              <span className="zv-two">
                <span>{p.note === 'Entrada' ? 'Entrada' : 'Pagamento'} · {METHOD_LABEL[p.method]}</span>
                <span>{formatDay(p.paidAt)} · por {p.userName}</span>
                {p.reversed && <span className="zv-pays__rev">Estornado: {p.reversedReason}</span>}
              </span>
              <span className="zv-pays__side">
                <b>+ {formatMoney(p.amountCents)}</b>
                {canReverse && !p.reversed && <button type="button" className="zv-textbtn" onClick={() => onReverse(p)} aria-label={`Estornar pagamento de ${formatMoney(p.amountCents)}`}>Estornar</button>}
              </span>
            </li>
          ))}
        </ul>
        )} />
      )}
      {order.refunds.length > 0 && (
        <>
          <b className="zv-side-title">Devoluções</b>
          <ul className="zv-pays" data-testid="lista-devolucoes">
            {order.refunds.map((r) => (
              <li key={r.id} className={r.canceled ? 'is-reversed' : undefined}>
                <span className="zv-two">
                  <span>Devolvido · {METHOD_LABEL[r.method]}</span>
                  <span>{formatDay(r.refundedAt)} · por {r.userName} · {r.reason}{r.waivedCents > 0 ? ` · restante de ${formatMoney(r.waivedCents)} não será cobrado` : ''}</span>
                  {r.canceled && <span className="zv-pays__rev">Desfeita</span>}
                </span>
                <span className="zv-pays__side">
                  <b className="zv-pays__minus">− {formatMoney(r.amountCents)}</b>
                  {canReverse && !r.canceled && <button type="button" className="zv-textbtn" onClick={() => onCancelRefund(r)} aria-label={`Desfazer devolução de ${formatMoney(r.amountCents)}`}>Desfazer</button>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {canReverse && order.paidCents - order.refundedCents > 0 && (
        <button type="button" className="zv-btn zv-btn--full zv-btn--danger" onClick={onRefund} data-testid="devolver-cliente">Devolver ao cliente</button>
      )}
      {order.paymentTerms && <span className="zv-small">Combinado: {order.paymentTerms}</span>}
    </section>
  )
}

// ---------- HU27: gastos e lucro (só ADMIN e MANAGER) ----------
function ProfitCard({ order, onAdd, onEdit, onDelete }: { order: Order; onAdd: () => void; onEdit: (e: OrderExpense) => void; onDelete: (e: OrderExpense) => void }) {
  const p = order.profit!
  const expenses = order.expenses!
  // Mesmas regras e frases do Financeiro (profitView)
  const view = profitView({
    totalCents: order.totalCents - order.refundedCents - order.waivedCents, materialCents: p.materialCents, expectedProfitCents: p.expectedProfitCents,
  })
  const { rate } = view
  const loss = view.tone === 'loss'

  return (
    <section className="zv-card zv-card--side zv-card--tight" aria-labelledby="t-lucro" data-testid="cartao-lucro">
      <div>
        <h2 id="t-lucro" className="zv-h2">Gastos e lucro</h2>
        <p className="zv-sub">Só Administrador e Gerente veem.</p>
      </div>

      {/* Sem nenhum gasto: só o aviso. Gasto antigo sem material continua no quadro completo, para poder corrigir */}
      {expenses.length === 0 ? <>
        <div className="zv-note zv-note--info" role="status" data-testid="falta-lancar-material">
          <Info size={24} strokeWidth={1.8} aria-hidden="true" />
          <span><b>Falta lançar o material</b><span>Lance quanto gastou de material para ver quanto sobrou para você.</span></span>
        </div>
        <div className="zv-line"><span>Valor do serviço</span><b>{formatMoney(order.totalCents - order.refundedCents - order.waivedCents)}</b></div>
        <button type="button" className="zv-btn zv-btn--full" onClick={onAdd} data-testid="lancar-material"><Plus size={20} strokeWidth={1.8} aria-hidden="true" />Lançar material</button>
      </> : <>
      <div className={`pd-profit__big${loss ? ' is-loss' : view.tone === 'pending' ? ' is-pending' : ''}`}>
        <span className="pd-profit__top">
          <span className="pd-profit__title"><AppIcon name={loss ? 'alert' : 'profit'} size={36} />{view.title}</span>
          {rate && !loss && <span className={`pd-health__tag pd-profit__tag pd-health--${rate.health.toLowerCase()}`}><AppIcon name="check" size={20} />{HEALTH_LABEL[rate.health]}</span>}
        </span>
        <strong data-testid="lucro">{formatMoney(view.valueCents)}</strong>
        <span className="pd-profit__margin">{view.note}</span>
      </div>

      {/* A conta, curta: serviço − material = sua mão de obra (o recebido já está no quadro Pagamento) */}
      <dl className="pd-calc">
        <div><dt>Valor do serviço</dt><dd>{formatMoney(order.totalCents - order.refundedCents - order.waivedCents)}</dd></div>
        <div><dt className="pd-calc__icon"><AppIcon name="material" size={24} />− Material</dt><dd data-testid="total-material">− {formatMoney(p.materialCents)}</dd></div>
        {/* Gasto antigo lançado como "mão de obra" (antes de 11/10) ainda desconta */}
        {p.laborCents > 0 && <div><dt>Outros gastos</dt><dd>− {formatMoney(p.laborCents)}</dd></div>}
        <div className={`pd-calc__total${p.expectedProfitCents < 0 ? ' is-neg' : ''}`}>
          <dt className="pd-calc__icon"><AppIcon name={p.expectedProfitCents < 0 ? 'alert' : 'labor'} size={24} />{p.expectedProfitCents < 0 ? 'Prejuízo' : '= Sua mão de obra'}</dt>
          <dd data-testid="total-mao-de-obra">{formatMoney(p.expectedProfitCents)}{rate && p.expectedProfitCents >= 0 && ` (${formatPercentBR(rate.percent)})`}</dd>
        </div>
      </dl>

      {rate && <HealthGauge rate={rate} />}

      {/* Um valor de material por pedido: depois de lançado, só editar (botão "Editar" na lista abaixo) */}
      {p.materialCents === 0 && <Button className="btn--secondary" fullWidth onClick={onAdd} data-testid="lancar-gasto"><PlusIcon />Lançar material</Button>}

      <ul className="pd-payments pd-expenses" data-testid="lista-gastos">
        {expenses.map((e) => (
          <li key={e.id}>
            <span className="pd-payments__main">
              <span className="pd-payments__value">{formatMoney(e.amountCents)}</span>
              <span className="cl-muted oc-small"><i className={`pd-dot ${e.type === 'MATERIAL' ? 'is-material' : 'is-labor'}`} />{EXPENSE_TYPE_LABEL[e.type]}{e.description ? ` · ${e.description}` : ''} · {formatDayShort(e.date)}</span>
            </span>
            <span className="pd-payments__side">
              <button type="button" className="btn btn--secondary pd-expense-btn" onClick={() => onEdit(e)} aria-label={`Corrigir gasto de ${EXPENSE_TYPE_LABEL[e.type]} ${formatMoney(e.amountCents)}`}><AppIcon name="edit" size={24} />Corrigir</button>
              <button type="button" className="btn btn--secondary pd-expense-btn pd-expense-btn--danger" onClick={() => onDelete(e)} aria-label={`Excluir gasto de ${EXPENSE_TYPE_LABEL[e.type]} ${formatMoney(e.amountCents)}`}><AppIcon name="trash" size={24} />Excluir</button>
            </span>
          </li>
        ))}
      </ul>
      </>}
    </section>
  )
}

// Régua da mão de obra: 0% a 60% do valor do serviço, com a faixa normal (30% a 45%) marcada
const HEALTH_LABEL: Record<ProfitHealth, string> = { OUT_OF_POCKET: 'Prejuízo', LOW: 'Prejuízo', NORMAL: 'Normal', GREAT: 'Ótimo' }

function HealthGauge({ rate }: { rate: HealthResult }) {
  const scale = 60
  const pos = (n: number) => `${Math.min(100, Math.max(0, (n / scale) * 100))}%`
  return (
    <div className={`pd-health pd-health--${rate.health.toLowerCase()}`} data-testid="regua-mao-de-obra">
      <div className="pd-health__track" role="img" aria-label={`${formatPercentBR(rate.percent)} do valor do serviço. Normal de ${LABOR_MIN_PERCENT}% a ${LABOR_GOOD_PERCENT}%.`}>
        <span className="pd-health__ok" style={{ left: pos(LABOR_MIN_PERCENT), width: `calc(${pos(LABOR_GOOD_PERCENT)} - ${pos(LABOR_MIN_PERCENT)})` }} />
        <span className="pd-health__great" style={{ left: pos(LABOR_GOOD_PERCENT), right: 0 }} />
        <span className="pd-health__mark" style={{ left: pos(rate.percent) }} />
      </div>
      <div className="pd-health__scale" aria-hidden="true">
        <span>0%</span><span style={{ left: pos(LABOR_MIN_PERCENT) }}>{LABOR_MIN_PERCENT}%</span><span style={{ left: pos(LABOR_GOOD_PERCENT) }}>{LABOR_GOOD_PERCENT}%</span><span>{scale}%</span>
      </div>
      <p className="pd-health__legend">Verde claro: normal ({LABOR_MIN_PERCENT}% a {LABOR_GOOD_PERCENT}%) · Verde escuro: ótimo (acima de {LABOR_GOOD_PERCENT}%)</p>
    </div>
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
    case 'REFUND': return `Devolvido ao cliente · ${ev.detail ?? ''}`
    case 'REFUND_CANCELED': return `Devolução desfeita · ${ev.detail ?? ''}`
    case 'COLLECTION': return 'Cobrado pelo WhatsApp'
    case 'CANCELED': return `Cancelado · ${ev.detail ?? ''}`
  }
}

function eventIcon(ev: OrderEvent) {
  switch (ev.type) {
    case 'PAYMENT':
    case 'PAYMENT_REVERSED':
    case 'REFUND':
    case 'REFUND_CANCELED': return <CashIcon />
    case 'DELIVERED': return <TruckIcon />
    case 'COLLECTION': return <WhatsIcon />
    case 'STATUS_CHANGED': return ev.detail?.endsWith('READY') ? <CheckIcon /> : <PlayIcon />
    case 'CANCELED': return <AppIcon name="cancel" size={24} />
    default: return <AppIcon name="order" size={24} />
  }
}

// ---------- Ícones ----------
function WhatsIcon({ onAccent = false }: { onAccent?: boolean }) {
  return <AppIcon name="chat" size={24} onAccent={onAccent} />
}
function CashIcon({ onAccent = false }: { onAccent?: boolean }) {
  return <AppIcon name="payment" size={24} onAccent={onAccent} />
}
function TruckIcon({ onAccent = false }: { onAccent?: boolean }) {
  return <AppIcon name="truck" size={24} onAccent={onAccent} />
}
function PlayIcon({ onAccent = false }: { onAccent?: boolean }) {
  return <AppIcon name="play" size={24} onAccent={onAccent} />
}
function CheckIcon({ onAccent = false }: { onAccent?: boolean }) {
  return <AppIcon name="check" size={24} onAccent={onAccent} />
}
function PlusIcon({ onAccent = false }: { onAccent?: boolean }) {
  return <AppIcon name="plus" size={24} onAccent={onAccent} />
}
