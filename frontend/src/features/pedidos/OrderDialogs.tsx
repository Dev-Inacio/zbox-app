import { useState } from 'react'
import { Alert } from '../../components/ui/Alert'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ApiError } from '../auth/types'
import { maskPhone, onlyDigits } from '../clientes/format'
import { formatMoney, maskMoneyInput, parseDecimalToHundredths } from '../orcamentos/money'
import { convertQuoteToOrder, addPayment, cancelOrder, deliverOrder, registerCollection, reversePayment } from './ordersApi'
import { formatDay, todayIso } from './dates'
import { collectionMessage } from './messages'
import type { CollectTarget } from './messages'
import { METHOD_LABEL, METHODS } from './labels'
import type { Order, Payment, PaymentMethod } from './types'
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
            {errors.method && <p className="field__error">{errors.method}</p>}
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
    <ConfirmDialog open title="Registrar pagamento" confirmLabel="Registrar" loading={busy} loadingText="Registrando…" onCancel={onCancel} onConfirm={() => void submit()}>
      <div className="oc-dialog-fields">
        <p className="pd-lead">Pedido #{target.number} · {target.customerName}</p>
        <div className="pd-sum pd-sum--one"><div className="pd-sum__row"><span>Falta receber</span><strong>{formatMoney(target.remainingCents)}</strong></div></div>
        <MoneyField id="valor-pagamento" label="Valor recebido" value={amount} onChange={setAmount} error={errors.amountCents} />
        <button type="button" className="oc-pill pd-self-start" onClick={() => setAmount(maskMoneyInput(String(target.remainingCents)))} data-testid="tudo-que-falta">
          Tudo que falta · {formatMoney(target.remainingCents)}
        </button>
        <MethodPills value={method} onChange={setMethod} name="forma-pagamento" />
        {errors.method && <p className="field__error">{errors.method}</p>}
        <div className="pd-grid-2">
          <DateField id="data-pagamento" label="Data" value={paidAt} max={today} onChange={setPaidAt} error={errors.paidAt} />
          <div className="cl-field">
            <label htmlFor="obs-pagamento" className="cl-field__label">Observação (opcional)</label>
            <input autoComplete="off" id="obs-pagamento" className="cl-input" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: pago na loja" />
          </div>
        </div>
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
                {errors.method && <p className="field__error">{errors.method}</p>}
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
        <p>Pedido cancelado não volta. Ele continua no histórico.</p>
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
export function ReversePaymentDialog({ order, payment, onCancel, onDone }: { order: Order; payment: Payment; onCancel: () => void; onDone: Done }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
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
    <ConfirmDialog open title="Estornar pagamento?" confirmLabel="Estornar" variant="danger" loading={busy} loadingText="Estornando…"
      confirmDisabled={reason.trim().length < 3} onCancel={onCancel} onConfirm={() => void submit()}>
      <div className="oc-dialog-fields">
        <p><strong>{formatMoney(payment.amountCents)}</strong> · {METHOD_LABEL[payment.method]} · {formatDay(payment.paidAt)}</p>
        <p className="oc-small cl-muted">O pagamento não é apagado: fica riscado no histórico, e o valor volta para "falta receber".</p>
        <label className="cl-field">
          <span className="cl-field__label">Motivo</span>
          <textarea autoComplete="off" className="cl-input cl-textarea" rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: lançado no pedido errado" />
        </label>
        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </ConfirmDialog>
  )
}

// ---------- HU24: cobrar pelo WhatsApp ----------
export function CollectDialog({ target, onCancel, onDone }: { target: CollectTarget; onCancel: () => void; onDone: Done }) {
  const [phone, setPhone] = useState(maskPhone(target.customerWhatsapp ?? ''))
  const [message, setMessage] = useState(collectionMessage(target))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const digits = onlyDigits(phone)
  const invalid = digits.length !== 11

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
        <label className="cl-field">
          <span className="cl-field__label">WhatsApp</span>
          <input autoComplete="off" className="cl-input" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" aria-invalid={phone && invalid ? true : undefined} />
        </label>
        {!target.customerWhatsapp && <p className="oc-small cl-muted">O cliente não tem WhatsApp cadastrado. Digite o número para esta cobrança.</p>}
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
