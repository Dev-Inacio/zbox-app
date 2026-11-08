import { useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { AppIcon } from '../../components/ui/AppIcon'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { NoAutofill } from '../../components/ui/NoAutofill'
import { ApiError } from '../auth/types'
import { onlyDigits } from '../clientes/format'
import { formatMoney, maskMoneyInput, parseDecimalToHundredths } from '../orcamentos/money'
import { addExpense, addRefund, cancelRefund, deleteExpense, updateExpense, convertQuoteToOrder, addPayment, cancelOrder, deliverOrder, getOrder, registerCollection, reversePayment } from './ordersApi'
import { useCustomerWhatsapp } from '../../hooks/useCustomerWhatsapp'
import { formatDay, todayIso } from './dates'
import { collectionMessage } from './messages'
import type { CollectTarget } from './messages'
import { EXPENSE_TYPE_LABEL, METHOD_LABEL, METHODS } from './labels'
import type { ExpenseType, Order, OrderExpense, OrderRefund, Payment, PaymentMethod } from './types'
import type { Quote } from '../orcamentos/types'
import '../orcamentos/Orcamentos.css'
import './Pedidos.css'

// Janelas de Pedidos e Financeiro. Cada uma chama a API sozinha e devolve o pedido atualizado (onDone).
// Assim a mesma janela serve no detalhe do pedido e na lista do Financeiro.
// O back valida tudo de novo (saldo, datas, etapas). Aqui a tela só ajuda a não errar.

type Done = (order: Order, toast: string) => void

const NETWORK = 'Não foi possível salvar. Verifique sua conexão e tente de novo.'

// Separa o erro da API: o que é de um campo vai embaixo do campo; o resto vai no alerta
function readError(e: unknown): { general: string | null; fields: Record<string, string> } {
  if (!(e instanceof ApiError)) return { general: NETWORK, fields: {} }
  const fields: Record<string, string> = {}
  for (const f of e.fieldErrors) fields[f.field.split('.').pop() ?? f.field] = f.message
  return { general: e.fieldErrors.length ? null : e.message, fields }
}

function MethodPills({ value, onChange, name }: { value: PaymentMethod | null; onChange: (m: PaymentMethod) => void; name: string }) {
  return (
    <fieldset className="pd-fieldset">
      <legend className="cl-field__label">Forma de pagamento</legend>
      <div className="oc-pills" role="radiogroup">
        {METHODS.map((m) => (
          <label key={m} className="oc-pill oc-pill--radio">
            <input autoComplete="off" type="radio" name={name} checked={value === m} onChange={() => onChange(m)} />
            {METHOD_LABEL[m]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function MoneyField({ id, label, value, onChange, error, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string }) {
  return (
    <div className="cl-field">
      <label htmlFor={id} className="cl-field__label">{label}</label>
      <div className="pd-money">
        <span className="pd-money__prefix" aria-hidden="true">R$</span>
        <input autoComplete="off" id={id} className="cl-input pd-money__input" inputMode="numeric" placeholder="0,00" value={value} onChange={(e) => onChange(maskMoneyInput(e.target.value))}
          aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-erro` : undefined} data-testid={id} />
      </div>
      {error && <p id={`${id}-erro`} className="field__error">{error}</p>}
      {!error && hint && <p className="cl-field__hint">{hint}</p>}
    </div>
  )
}

function DateField({ id, label, value, onChange, min, max, error, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; min?: string; max?: string; error?: string; hint?: string }) {
  return (
    <div className="cl-field">
      <label htmlFor={id} className="cl-field__label">{label}</label>
      <input autoComplete="off" id={id} type="date" className="cl-input" value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-erro` : hint ? `${id}-dica` : undefined} data-testid={id} />
      {error && <p id={`${id}-erro`} className="field__error">{error}</p>}
      {!error && hint && <p id={`${id}-dica`} className="cl-field__hint">{hint}</p>}
    </div>
  )
}

function Summary({ rows, final }: { rows: [string, string, string?][]; final: [string, string] }) {
  return (
    <div className="pd-sum">
      {rows.map(([a, b, cls]) => <div key={a} className="pd-sum__row"><span>{a}</span><span className={cls}>{b}</span></div>)}
      <div className="pd-sum__final"><span>{final[0]}</span><strong data-testid="resumo-falta">{final[1]}</strong></div>
    </div>
  )
}

// ---------- HU19: transformar orçamento aprovado em pedido ----------
export function ConvertToOrderDialog({ quote, onCancel, onDone }: { quote: Quote; onCancel: () => void; onDone: Done }) {
  const today = todayIso()
  const [hasDown, setHasDown] = useState<boolean | null>(null)
  const half = Math.round(quote.totalCents / 2)
  const [amount, setAmount] = useState(maskMoneyInput(String(half)))
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [paidAt, setPaidAt] = useState(today)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<string | null>(null)

  const amountCents = parseDecimalToHundredths(amount) ?? 0
  const down = hasDown ? amountCents : 0
  const shortcuts: [string, number][] = [['50%', half], ['30%', Math.round(quote.totalCents * 0.3)], ['Valor total', quote.totalCents]]

  async function submit() {
    const e: Record<string, string> = {}
    if (hasDown === null) e.hasDown = 'Responda se o cliente pagou entrada.'
    if (hasDown) {
      if (amountCents <= 0) e.amountCents = 'Informe o valor da entrada.'
      else if (amountCents > quote.totalCents) e.amountCents = 'A entrada não pode ser maior que o total do pedido.'
      if (!method) e.method = 'Escolha a forma de pagamento.'
      if (paidAt > today) e.paidAt = 'A data do pagamento não pode ser no futuro.'
    }
    setErrors(e)
    setGeneral(null)
    if (Object.keys(e).length || busy) return
    setBusy(true)
    try {
      const order = await convertQuoteToOrder(quote.id, { downPayment: hasDown && method ? { amountCents, method, paidAt } : null })
      onDone(order, `Pedido #${order.number} criado.`)
    } catch (err) {
      const r = readError(err)
      setErrors(r.fields)
      setGeneral(r.general)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog open title="Transformar em pedido" confirmLabel="Criar pedido" loading={busy} loadingText="Criando…" onCancel={onCancel} onConfirm={() => void submit()}>
      <div className="oc-dialog-fields">
        <p className="pd-lead">Orçamento #{quote.number} v{quote.version} · {quote.customer.name} · <strong>{formatMoney(quote.totalCents)}</strong></p>
        <fieldset className="pd-fieldset">
          <legend className="cl-field__label">O cliente pagou entrada?</legend>
          <div className="pd-choices">
            <label className="pd-choice">
              <input autoComplete="off" type="radio" name="entrada" checked={hasDown === true} onChange={() => setHasDown(true)} data-testid="entrada-sim" />
              <span><strong>Sim, recebi entrada</strong><span>Registra o pagamento agora</span></span>
            </label>
            <label className="pd-choice">
              <input autoComplete="off" type="radio" name="entrada" checked={hasDown === false} onChange={() => setHasDown(false)} data-testid="entrada-nao" />
              <span><strong>Não recebeu</strong><span>Registra quando ele pagar</span></span>
            </label>
          </div>
          {errors.hasDown && <p className="field__error">{errors.hasDown}</p>}
        </fieldset>

        {hasDown && (
          <div className="pd-box">
            <div className="pd-grid-2">
              <MoneyField id="valor-entrada" label="Valor da entrada" value={amount} onChange={setAmount} error={errors.amountCents} />
              <DateField id="data-entrada" label="Data" value={paidAt} max={today} onChange={setPaidAt} error={errors.paidAt} />
            </div>
            <div className="oc-pills" aria-label="Atalhos de valor">
              {shortcuts.map(([label, cents]) => (
                <button key={label} type="button" className="oc-pill" aria-pressed={amountCents === cents} onClick={() => setAmount(maskMoneyInput(String(cents)))}>
                  {label} · {formatMoney(cents)}
                </button>
              ))}
            </div>
            <MethodPills value={method} onChange={setMethod} name="forma-entrada" />
            {errors.method && !method && <p className="field__error">{errors.method}</p>}
          </div>
        )}

        <Summary
          rows={[['Total do pedido', formatMoney(quote.totalCents)], ...(hasDown ? [['Entrada', `− ${formatMoney(Math.min(down, quote.totalCents))}`, 'pd-green'] as [string, string, string]] : [])]}
          final={['Fica faltando', formatMoney(Math.max(0, quote.totalCents - down))]}
        />
        <p className="oc-small cl-muted">O orçamento continua guardado. O pedido copia os itens e valores dele.</p>
        {general && <Alert variant="error">{general}</Alert>}
      </div>
    </ConfirmDialog>
  )
}

// ---------- HU23: registrar pagamento ----------
export type PaymentTarget = { id: number; number: string; customerName: string; remainingCents: number }

export function PaymentDialog({ target, onCancel, onDone }: { target: PaymentTarget; onCancel: () => void; onDone: Done }) {
  const today = todayIso()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [paidAt, setPaidAt] = useState(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<string | null>(null)
  // Uma chave por janela aberta: se o clique repetir (ou a rede reenviar), o back devolve o MESMO pagamento
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  const cents = parseDecimalToHundredths(amount) ?? 0

  async function submit() {
    const e: Record<string, string> = {}
    if (cents <= 0) e.amountCents = 'Informe um valor maior que R$ 0,00.'
    else if (cents > target.remainingCents) e.amountCents = `O valor não pode ser maior que o que falta receber (${formatMoney(target.remainingCents)}).`
    if (!method) e.method = 'Escolha a forma de pagamento.'
    if (!paidAt) e.paidAt = 'Informe a data.'
    else if (paidAt > today) e.paidAt = 'A data do pagamento não pode ser no futuro.'
    setErrors(e)
    setGeneral(null)
    if (Object.keys(e).length || busy || !method) return
    setBusy(true)
    try {
      const order = await addPayment(target.id, { amountCents: cents, method, paidAt, note: note || null }, idempotencyKey)
      onDone(order, order.remainingCents === 0 ? `Pagamento registrado. Pedido #${order.number} pago!` : `Pagamento de ${formatMoney(cents)} registrado. Falta ${formatMoney(order.remainingCents)}.`)
    } catch (err) {
      const r = readError(err)
      setErrors(r.fields)
      setGeneral(r.general)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog open title="Registrar pagamento" confirmLabel={cents > 0 ? `Registrar ${formatMoney(cents)}` : 'Registrar'} loading={busy} loadingText="Registrando…" onCancel={onCancel} onConfirm={() => void submit()}>
      <div className="oc-dialog-fields">
        <p className="pd-lead">Pedido #{target.number} · {target.customerName}</p>
        <div className="pd-sum pd-sum--one"><div className="pd-sum__row"><span>Falta receber</span><strong>{formatMoney(target.remainingCents)}</strong></div></div>
        <MoneyField id="valor-pagamento" label="Valor recebido" value={amount} onChange={setAmount} error={errors.amountCents} />
        <button type="button" className="zv-btn zv-btn--full" onClick={() => setAmount(maskMoneyInput(String(target.remainingCents)))} data-testid="tudo-que-falta">
          Recebi o valor total ({formatMoney(target.remainingCents)})
        </button>
        <MethodPills value={method} onChange={setMethod} name="forma-pagamento" />
        {errors.method && !method && <p className="field__error">{errors.method}</p>}
        <div className="pd-grid-2">
          <DateField id="data-pagamento" label="Data do pagamento" value={paidAt} max={today} onChange={setPaidAt} error={errors.paidAt} />
          <div className="cl-field">
            <label htmlFor="obs-pagamento" className="cl-field__label">Observação (opcional)</label>
            <input autoComplete="off" id="obs-pagamento" className="cl-input" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: pago na loja" />
          </div>
        </div>
        {!errors.paidAt && paidAt && paidAt <= today && paidAt.slice(0, 7) !== today.slice(0, 7) && (
          <Alert variant="warning" data-testid="aviso-outro-mes">Este pagamento vai contar em {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(`${paidAt}T12:00:00`))}, não neste mês. No Financeiro, ele aparece no período dessa data.</Alert>
        )}
        {general && <Alert variant="error">{general}</Alert>}
      </div>
    </ConfirmDialog>
  )
}

// ---------- HU22: entregar e perguntar se pagou ----------
export function DeliverDialog({ order, onCancel, onDone }: { order: Order; onCancel: () => void; onDone: Done }) {
  const today = todayIso()
  const [deliveredOn, setDeliveredOn] = useState(today)
  const [receivedBy, setReceivedBy] = useState('')
  const [note, setNote] = useState('')
  const [paid, setPaid] = useState<boolean | null>(order.remainingCents === 0 ? false : null)
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<string | null>(null)
  const alreadyPaid = order.remainingCents === 0

  async function submit() {
    const e: Record<string, string> = {}
    if (!deliveredOn) e.deliveredOn = 'Informe a data da entrega.'
    else if (deliveredOn > today) e.deliveredOn = 'A data da entrega não pode ser no futuro.'
    if (receivedBy.trim().length < 2) e.receivedBy = 'Informe quem recebeu o pedido.'
    if (!alreadyPaid && paid === null) e.paid = 'Responda se o cliente pagou o restante.'
    if (paid && !method) e.method = 'Escolha como o cliente pagou.'
    setErrors(e)
    setGeneral(null)
    if (Object.keys(e).length || busy) return
    setBusy(true)
    try {
      const updated = await deliverOrder(order.id, {
        deliveredOn, receivedBy: receivedBy.trim(), note: note || null,
        payment: paid && method ? { amountCents: order.remainingCents, method, paidAt: deliveredOn } : null,
      })
      onDone(updated, updated.paymentStatus === 'OVERDUE'
        ? `Pedido entregue. Falta receber ${formatMoney(updated.remainingCents)}: ele aparece em "Clientes que ainda não pagaram".`
        : 'Pedido entregue e pago!')
    } catch (err) {
      const r = readError(err)
      setErrors(r.fields)
      setGeneral(r.general)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog open title="Marcar como entregue" confirmLabel="Confirmar entrega" loading={busy} loadingText="Salvando…" onCancel={onCancel} onConfirm={() => void submit()}>
      <div className="oc-dialog-fields">
        <p className="pd-lead">Pedido #{order.number} · {order.customer.name}</p>
        <div className="pd-grid-2">
          <DateField id="data-entrega" label="Data da entrega" value={deliveredOn} max={today} onChange={setDeliveredOn} error={errors.deliveredOn} />
          <div className="cl-field">
            <label htmlFor="quem-recebeu" className="cl-field__label">Quem recebeu</label>
            <input autoComplete="off" id="quem-recebeu" className="cl-input" maxLength={120} value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Nome de quem recebeu"
              aria-invalid={errors.receivedBy ? true : undefined} aria-describedby={errors.receivedBy ? 'quem-recebeu-erro' : undefined} data-testid="quem-recebeu" />
            {errors.receivedBy && <p id="quem-recebeu-erro" className="field__error">{errors.receivedBy}</p>}
          </div>
        </div>

        {alreadyPaid ? (
          <Alert variant="success">Este pedido já está pago. É só confirmar a entrega.</Alert>
        ) : (
          <fieldset className="pd-box pd-fieldset">
            <legend className="pd-question">O cliente pagou o restante ({formatMoney(order.remainingCents)})?</legend>
            <div className="pd-choices">
              <label className="pd-choice">
                <input autoComplete="off" type="radio" name="pagou" checked={paid === true} onChange={() => setPaid(true)} data-testid="pagou-sim" />
                <span><strong>Sim, recebi</strong><span>Fica como Pago</span></span>
              </label>
              <label className="pd-choice">
                <input autoComplete="off" type="radio" name="pagou" checked={paid === false} onChange={() => setPaid(false)} data-testid="pagou-nao" />
                <span><strong>Não, ainda vai pagar</strong><span>Fica em Pagamento atrasado</span></span>
              </label>
            </div>
            {errors.paid && <p className="field__error">{errors.paid}</p>}
            {paid === true && (
              <>
                <MethodPills value={method} onChange={setMethod} name="forma-entrega" />
                {errors.method && !method && <p className="field__error">{errors.method}</p>}
              </>
            )}
            {paid === false && (
              <p className="pd-warn" role="note">
                O pedido fica como <strong>Entregue + Pagamento atrasado</strong> e aparece em <strong>Clientes que ainda não pagaram</strong> no Início e no Financeiro até você registrar o pagamento.
              </p>
            )}
          </fieldset>
        )}

        <div className="cl-field">
          <label htmlFor="obs-entrega" className="cl-field__label">Observação (opcional)</label>
          <input autoComplete="off" id="obs-entrega" className="cl-input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: deixado na portaria" />
        </div>
        {general && <Alert variant="error">{general}</Alert>}
      </div>
    </ConfirmDialog>
  )
}

// ---------- HU21: cancelar ----------
export function CancelOrderDialog({ order, onCancel, onDone }: { order: Order; onCancel: () => void; onDone: Done }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (reason.trim().length < 3 || busy) return
    setBusy(true)
    setError(null)
    try {
      const updated = await cancelOrder(order.id, reason)
      onDone(updated, 'Pedido cancelado.')
    } catch (err) {
      const r = readError(err)
      setError(r.general ?? Object.values(r.fields)[0] ?? NETWORK)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog open title="Cancelar este pedido?" confirmLabel="Cancelar pedido" cancelLabel="Voltar" variant="danger" loading={busy} loadingText="Cancelando…"
      confirmDisabled={reason.trim().length < 3} onCancel={onCancel} onConfirm={() => void submit()}>
      <div className="oc-dialog-fields">
        <p>Pedido cancelado não volta. Ele continua no histórico, e o orçamento #{order.quote.number} fica como <strong>Recusado</strong>.</p>
        {order.paidCents > 0 && (
          <Alert variant="warning">Este pedido já recebeu {formatMoney(order.paidCents)}. Os pagamentos continuam registrados; a devolução do dinheiro, se houver, é feita fora do sistema.</Alert>
        )}
        <label className="cl-field">
          <span className="cl-field__label">Motivo do cancelamento</span>
          <textarea autoComplete="off" className="cl-input cl-textarea" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: cliente desistiu da obra" />
        </label>
        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </ConfirmDialog>
  )
}

// ---------- HU23: estornar (ADMIN/MANAGER) ----------
export function ReversePaymentDialog({ order, payment, onCancel, onDone, onRefundInstead }: { order: Order; payment: Payment; onCancel: () => void; onDone: Done; onRefundInstead: () => void }) {
  const [reason, setReason] = useState('')
  const [cause, setCause] = useState<'MISTAKE' | 'RETURNED'>('MISTAKE')
  const returned = cause === 'RETURNED'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (returned) { onRefundInstead(); return }
    if (reason.trim().length < 3 || busy) return
    setBusy(true)
    setError(null)
    try {
      const updated = await reversePayment(order.id, payment.id, reason)
      onDone(updated, `Pagamento de ${formatMoney(payment.amountCents)} estornado.`)
    } catch (err) {
      const r = readError(err)
      setError(r.general ?? Object.values(r.fields)[0] ?? NETWORK)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog open title="Estornar pagamento?" confirmLabel={returned ? 'Continuar para devolução' : 'Estornar'} variant="danger" loading={busy} loadingText="Estornando…"
      confirmDisabled={!returned && reason.trim().length < 3} onCancel={onCancel} onConfirm={() => void submit()}>
      <div className="oc-dialog-fields">
        <p><strong>{formatMoney(payment.amountCents)}</strong> · {METHOD_LABEL[payment.method]} · {formatDay(payment.paidAt)}</p>
        <fieldset className="pd-reverse-causes">
          <legend className="cl-field__label">O que aconteceu?</legend>
          <label className="pd-choice">
            <input type="radio" name="motivo-estorno" checked={!returned} onChange={() => setCause('MISTAKE')} data-testid="estorno-engano" />
            <b>Lancei errado</b>
            <span>Valor errado, pedido errado ou o dinheiro não entrou. O valor volta para "falta receber".</span>
          </label>
          <label className="pd-choice">
            <input type="radio" name="motivo-estorno" checked={returned} onChange={() => setCause('RETURNED')} data-testid="estorno-devolveu" />
            <b>Devolvi o dinheiro ao cliente</b>
            <span>O cliente não gostou ou desistiu. Registra uma devolução, e você escolhe se ainda cobra o restante.</span>
          </label>
        </fieldset>
        {!returned && (
          <label className="cl-field">
            <span className="cl-field__label">Motivo</span>
            <textarea autoComplete="off" className="cl-input cl-textarea" rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: lançado no pedido errado" data-testid="motivo-estorno" />
            <span className="cl-field__hint">O pagamento fica riscado no pedido, com este motivo.</span>
          </label>
        )}
        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </ConfirmDialog>
  )
}

// Devolução: dinheiro que voltou para o cliente. O saldo a receber não muda.
export function RefundDialog({ order, from, onCancel, onDone }: { order: Order; from?: Payment; onCancel: () => void; onDone: Done }) {
  const today = todayIso()
  const available = order.paidCents - order.refundedCents
  // Vindo do estorno de um pagamento, já começa com o valor e a forma dele
  const [amount, setAmount] = useState(from ? maskMoneyInput(String(Math.min(from.amountCents, available))) : '')
  const [method, setMethod] = useState<PaymentMethod | null>(from?.method ?? null)
  const [date, setDate] = useState(today)
  const [reason, setReason] = useState('')
  const [waive, setWaive] = useState(Boolean(from)) // o cliente desistiu: normalmente não se cobra mais
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const cents = parseDecimalToHundredths(amount) ?? 0

  async function submit() {
    const e: Record<string, string> = {}
    if (cents <= 0) e.amountCents = 'Informe um valor maior que R$ 0,00.'
    else if (cents > available) e.amountCents = `O valor não pode ser maior que o recebido (${formatMoney(available)}).`
    if (!method) e.method = 'Escolha a forma da devolução.'
    if (!date) e.refundedAt = 'Informe a data.'
    else if (date > today) e.refundedAt = 'A data da devolução não pode ser no futuro.'
    if (reason.trim().length < 3) e.reason = 'Conte o motivo da devolução.'
    setErrors(e)
    setGeneral(null)
    if (Object.keys(e).length || busy || !method) return
    setBusy(true)
    try {
      onDone(await addRefund(order.id, { amountCents: cents, method, refundedAt: date, reason, waiveRemaining: waive && order.remainingCents > 0 }, idempotencyKey), `Devolução de ${formatMoney(cents)} registrada.${waive && order.remainingCents > 0 ? ' O restante não será cobrado.' : ''}`)
    } catch (err) {
      const r = readError(err)
      setErrors(r.fields)
      setGeneral(r.general)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog open title="Devolver ao cliente" confirmLabel={cents > 0 ? `Devolver ${formatMoney(cents)}` : 'Devolver'} variant="danger" loading={busy} loadingText="Registrando…" onCancel={onCancel} onConfirm={() => void submit()}>
      <div className="oc-dialog-fields">
        <p className="pd-lead">Pedido #{order.number} · {order.customer.name}</p>
        <p className="oc-small cl-muted">Use quando o dinheiro voltou para o cliente, como num abatimento por defeito. O cliente não fica devendo o valor devolvido. Se o pagamento foi lançado errado, use "Estornar".</p>
        <div className="pd-sum pd-sum--one"><div className="pd-sum__row"><span>Pode devolver até</span><strong>{formatMoney(available)}</strong></div></div>
        <MoneyField id="valor-devolucao" label="Valor devolvido" value={amount} onChange={setAmount} error={errors.amountCents} />
        <button type="button" className="zv-btn zv-btn--full" onClick={() => setAmount(maskMoneyInput(String(available)))} data-testid="devolver-tudo">Devolver tudo ({formatMoney(available)})</button>
        <MethodPills value={method} onChange={setMethod} name="forma-devolucao" />
        {errors.method && !method && <p className="field__error">{errors.method}</p>}
        <DateField id="data-devolucao" label="Data da devolução" value={date} max={today} onChange={setDate} error={errors.refundedAt} />
        <label className="cl-field">
          <span className="cl-field__label">Motivo</span>
          <textarea autoComplete="off" className="cl-input cl-textarea" rows={2} maxLength={200} value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Ex.: acabamento com defeito" data-testid="motivo-devolucao" />
          {errors.reason && <span className="field__error">{errors.reason}</span>}
        </label>
        {order.remainingCents > 0 && (
          <label className="pd-waive">
            <input type="checkbox" checked={waive} onChange={(ev) => setWaive(ev.target.checked)} data-testid="nao-cobrar-restante" />
            <span><b>Não cobrar o restante de {formatMoney(order.remainingCents)}</b><small>O cliente não vai pagar mais nada. O pedido sai de "Falta receber" e das cobranças.</small></span>
          </label>
        )}
        {general && <Alert variant="error">{general}</Alert>}
      </div>
    </ConfirmDialog>
  )
}

export function CancelRefundDialog({ order, refund, onCancel, onDone }: { order: Order; refund: OrderRefund; onCancel: () => void; onDone: Done }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      onDone(await cancelRefund(order.id, refund.id), 'Devolução desfeita.')
    } catch (err) {
      const r = readError(err)
      setError(r.general ?? Object.values(r.fields)[0] ?? NETWORK)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog open title="Desfazer devolução?" confirmLabel="Desfazer" variant="danger" loading={busy} loadingText="Desfazendo…" onCancel={onCancel} onConfirm={() => void submit()}>
      <div className="oc-dialog-fields">
        <p><strong>{formatMoney(refund.amountCents)}</strong> · {METHOD_LABEL[refund.method]} · {formatDay(refund.refundedAt)}</p>
        <p className="oc-small cl-muted">Use só se foi lançada por engano. Ela fica riscada no pedido{refund.waivedCents > 0 ? `, e os ${formatMoney(refund.waivedCents)} que não seriam cobrados voltam para "falta receber"` : ''}.</p>
        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </ConfirmDialog>
  )
}

// ---------- HU24: cobrar pelo WhatsApp ----------
export function CollectDialog({ target, onCancel, onDone }: { target: CollectTarget; onCancel: () => void; onDone: Done }) {
  // Número já preenchido com o WhatsApp ATUAL do cliente (a cobrança só sabe o pedido: busca o cliente dele)
  const { phone, setPhone, registered } = useCustomerWhatsapp(() => getOrder(target.id).then((o) => o.customer.id), target.customerWhatsapp)
  const [message, setMessage] = useState(collectionMessage(target))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const digits = onlyDigits(phone)
  const invalid = digits.length !== 10 && digits.length !== 11

  function send() {
    if (invalid || busy) return
    // Abre o WhatsApp JÁ no clique (senão o navegador bloqueia). Quem envia é a pessoa, lá no WhatsApp.
    window.open(`https://wa.me/55${digits}?text=${encodeURIComponent(message)}`, '_blank', 'noopener')
    setBusy(true)
    registerCollection(target.id)
      .then((order) => onDone(order, 'WhatsApp aberto com a cobrança. Confira e envie por lá.'))
      .catch((err: unknown) => {
        setError(readError(err).general ?? NETWORK)
        setBusy(false)
      })
  }

  return (
    <ConfirmDialog open title={`Cobrar ${target.customerName.split(' ')[0]}`} confirmLabel="Abrir WhatsApp" loading={busy} loadingText="Abrindo…"
      confirmDisabled={invalid || message.trim() === ''} onCancel={onCancel} onConfirm={send}>
      <div className="oc-dialog-fields">
        <NoAutofill><label className="cl-field">
          <span className="cl-field__label">WhatsApp</span>
          <input autoComplete="off" className="cl-input" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" aria-invalid={phone && invalid ? true : undefined} />
        </label></NoAutofill>
        {!registered && <p className="oc-small cl-muted">O cliente não tem celular cadastrado. Digite o número para esta cobrança.</p>}
        <label className="cl-field">
          <span className="cl-field__label">Mensagem (pode editar)</span>
          <textarea autoComplete="off" className="cl-input cl-textarea" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} data-testid="mensagem-cobranca" />
        </label>
        <p className="oc-note">O WhatsApp abre com a mensagem pronta. <strong>Você revisa e aperta enviar</strong>; o ZBOX não envia sozinho. Fica registrado "Cobrado em" no pedido.</p>
        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </ConfirmDialog>
  )
}

// ---------- HU27: lançar / corrigir gasto do serviço ----------
export function ExpenseDialog({ order, expense, onCancel, onDone }: { order: Order; expense: OrderExpense | null; onCancel: () => void; onDone: (order: Order) => void }) {
  const today = todayIso()
  // Regra do cliente (11/10): só se lança MATERIAL. A mão de obra é o que sobra (calculada sozinha).
  // Gasto antigo do tipo "mão de obra" continua com o tipo dele ao ser corrigido.
  const type: ExpenseType = expense?.type ?? 'MATERIAL'
  const [amount, setAmount] = useState(expense ? maskMoneyInput(String(expense.amountCents)) : '')
  const [date, setDate] = useState(expense?.date ?? today)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<string | null>(null)
  const amountCents = parseDecimalToHundredths(amount) ?? 0

  async function submit() {
    const e: Record<string, string> = {}
    if (amountCents <= 0) e.amountCents = 'Informe um valor maior que zero.'
    if (!date) e.date = 'Informe a data do gasto.'
    else if (date > today) e.date = 'A data do gasto não pode ser no futuro.'
    setErrors(e)
    setGeneral(null)
    if (Object.keys(e).length || busy) return
    setBusy(true)
    try {
      const body = { type, description: expense?.description ?? null, amountCents, date }
      onDone(expense ? await updateExpense(order.id, expense.id, body) : await addExpense(order.id, body))
    } catch (err) {
      const r = readError(err)
      setErrors(r.fields)
      setGeneral(r.general)
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog open title={expense ? `Corrigir ${type === 'MATERIAL' ? 'material' : 'gasto'}` : 'Lançar material'} confirmLabel={expense ? 'Salvar' : 'Lançar material'} loading={busy} loadingText="Salvando…" onCancel={onCancel} onConfirm={() => void submit()}>
      <div className="oc-dialog-fields">
        <p className="pd-lead">Pedido #{order.number} · {order.customer.name}</p>
        <p className="oc-small cl-muted">
          {type === 'MATERIAL'
            ? 'Quanto gastou de material (alumínio, vidro, ferragens…). O que sobrar do valor do serviço é a sua mão de obra. Isto é o que você gastou: não muda o que o cliente deve.'
            : 'Gasto antigo, lançado antes como mão de obra. Ele desconta do que sobra para você.'}
        </p>
        <div className="pd-grid-2">
          <MoneyField id="gasto-valor" label="Valor" value={amount} onChange={setAmount} error={errors.amountCents} />
          <DateField id="gasto-data" label="Data" value={date} max={today} onChange={setDate} error={errors.date} />
        </div>
        {general && <Alert variant="error">{general}</Alert>}
      </div>
    </ConfirmDialog>
  )
}

// Financeiro → Gastos e lucro: "Editar gastos" de um serviço sem sair da tela.
// Lista os gastos do pedido; cada um abre a mesma janela de corrigir/excluir do pedido.
export function ExpensesListDialog({ order, onCancel, onEdit, onDelete }: {
  order: Order; onCancel: () => void; onEdit: (e: OrderExpense) => void; onDelete: (e: OrderExpense) => void
}) {
  const expenses = [...(order.expenses ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  return (
    <ConfirmDialog open title={`Gastos do pedido #${order.number}`} confirmLabel="Fechar" hideCancel onCancel={onCancel} onConfirm={onCancel}>
      <div className="oc-dialog-fields">
        <p className="pd-lead">{order.customer.name} · serviço de <strong>{formatMoney(order.totalCents)}</strong></p>
        {expenses.length === 0 ? (
          <p className="oc-small cl-muted">Nenhum gasto lançado ainda.</p>
        ) : (
          <ul className="pd-payments pd-expenses" data-testid="lista-gastos-financeiro">
            {expenses.map((e) => (
              <li key={e.id}>
                <span className="pd-payments__main">
                  <span className="pd-payments__value">{formatMoney(e.amountCents)}</span>
                  <span className="cl-muted oc-small"><i className={`pd-dot ${e.type === 'MATERIAL' ? 'is-material' : 'is-labor'}`} />{EXPENSE_TYPE_LABEL[e.type]} · {formatDay(e.date)}</span>
                </span>
                <span className="pd-payments__side">
                  <button type="button" className="btn btn--secondary pd-expense-btn" onClick={() => onEdit(e)} aria-label={`Corrigir gasto de ${EXPENSE_TYPE_LABEL[e.type]} ${formatMoney(e.amountCents)}`}><AppIcon name="edit" size={24} />Corrigir</button>
                  <button type="button" className="btn btn--secondary pd-expense-btn pd-expense-btn--danger" onClick={() => onDelete(e)} aria-label={`Excluir gasto de ${EXPENSE_TYPE_LABEL[e.type]} ${formatMoney(e.amountCents)}`}><AppIcon name="trash" size={24} />Excluir</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ConfirmDialog>
  )
}

export function DeleteExpenseDialog({ order, expense, onCancel, onDone }: { order: Order; expense: OrderExpense; onCancel: () => void; onDone: (order: Order) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit() {
    if (busy) return
    setBusy(true)
    try {
      onDone(await deleteExpense(order.id, expense.id))
    } catch (e) {
      setError(readError(e).general ?? NETWORK)
      setBusy(false)
    }
  }
  return (
    <ConfirmDialog open title="Excluir gasto?" confirmLabel="Excluir" variant="danger" loading={busy} loadingText="Excluindo…" onCancel={onCancel} onConfirm={() => void submit()}>
      <p>{EXPENSE_TYPE_LABEL[expense.type]} · <strong>{formatMoney(expense.amountCents)}</strong> ({formatDay(expense.date)})</p>
      <p className="oc-small cl-muted">Fica registrado quem excluiu e quando.</p>
      {error && <Alert variant="error">{error}</Alert>}
    </ConfirmDialog>
  )
}
