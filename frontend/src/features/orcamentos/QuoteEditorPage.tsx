import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Alert } from '../../components/ui/Alert'
import { CustomerCard } from '../../components/zbox/CustomerCard'
import { Button } from '../../components/ui/Button'
import { useRequest } from '../../hooks/useRequest'
import { ApiError } from '../auth/types'
import { CardSkeleton, CustomerLoadError } from '../clientes/CustomerLoadStates'
import { ChevronRight, CircleCheck, Lock, Plus, Trash2 } from 'lucide-react'
import { StatusTag } from '../../components/zbox'
import { suggestPieceType } from './pieceKind'
import { QuoteSteps } from './QuoteSteps'
import {
  discountCents, formatMeters, formatMoney, formatPercent,
  itemSubtotalCents, maskMoneyInput, parseDecimalToHundredths, validateDiscount,
  normalizeMeters,
} from './money'
import { getQuote, updateQuote } from './quotesApi'
import type { ChargeType, DiscountType, ItemUnit, Quote, QuoteItemRequest, QuoteRequest } from './types'
import '../../components/ui/ButtonVariants.css'
import '../clientes/Clientes.css'
import './Orcamentos.css'

// HU14 — Criar/editar orçamento (só RASCUNHO).
// A tela calcula ao vivo para ajudar; o back recalcula e é quem vale.

// Decisão da PO (11/10): quem dá o preço é a pessoa, não o sistema.
// Campos do item: Quantidade (começa vazia), Largura e Altura (só a medida), Preço de cada peça e Detalhes.
// Subtotal = quantidade × preço de cada peça (6 box de R$ 1.500 = R$ 9.000). Nada de "por m²".
const NOTES_MAX = 1000
const DETAILS_MAX = 80 // cabe numa linha do PDF

// Item no formulário: tudo texto, do jeito que a pessoa digita
type ItemForm = {
  key: string
  description: string
  details: string
  chargeType: ChargeType
  quantity: string
  unit: ItemUnit
  width: string
  height: string
  price: string
}

type FormState = {
  items: ItemForm[]
  discountType: DiscountType
  discountValue: string
  notes: string
}

type Errors = Record<string, string> // "item-3.price" → mensagem | "discount" | "form"

let keySeq = 0
const newKey = () => `item-${++keySeq}`

function emptyItem(): ItemForm {
  return { key: newKey(), description: '', details: '', chargeType: 'UNIT', quantity: '', unit: 'un', width: '', height: '', price: '' }
}

function toForm(q: Quote): FormState {
  return {
    items: q.items.map((i) => ({
      key: newKey(),
      description: i.description,
      details: i.details ?? '',
      chargeType: 'UNIT',
      quantity: String(i.quantity),
      unit: i.unit ?? 'un',
      width: i.widthCm ? formatMeters(i.widthCm) : '',
      height: i.heightCm ? formatMeters(i.heightCm) : '',
      // Item antigo por m²: abre com o preço de cada peça (subtotal ÷ quantidade), para o total não mudar
      price: maskMoneyInput(String(i.chargeType === 'AREA' ? Math.round(i.subtotalCents / Math.max(1, i.quantity)) : i.unitPriceCents)),
    })),
    discountType: q.discountType ?? 'PERCENT',
    discountValue: q.discountValue ? (q.discountType === 'AMOUNT' ? maskMoneyInput(String(q.discountValue)) : formatPercent(q.discountValue)) : '',
    // Condições viraram Observações (design 31/10): o texto antigo vem para cá, não se perde
    notes: [q.paymentTerms && `Pagamento: ${q.paymentTerms}`, q.notes].filter(Boolean).join('\n'),
  }
}

// Texto → números (null = inválido/vazio)
function parseItem(i: ItemForm) {
  const quantity = /^\d+$/.test(i.quantity.trim()) ? Number(i.quantity.trim()) : null
  return {
    quantity,
    widthCm: parseDecimalToHundredths(normalizeMeters(i.width)),
    heightCm: parseDecimalToHundredths(normalizeMeters(i.height)),
    priceCents: parseDecimalToHundredths(i.price),
  }
}

function liveSubtotal(i: ItemForm): number {
  const p = parseItem(i)
  if (!p.quantity || !p.priceCents) return 0
  return itemSubtotalCents({ chargeType: 'UNIT', quantity: p.quantity, widthCm: null, heightCm: null, unitPriceCents: p.priceCents })
}

function validateItem(i: ItemForm): Errors {
  const e: Errors = {}
  const p = parseItem(i)
  const desc = i.description.trim()
  if (desc.length < 2) e[`${i.key}.description`] = 'Descreva o item.'
  else if (desc.length > 200) e[`${i.key}.description`] = 'Máximo de 200 caracteres.'
  if (i.details.trim().length > DETAILS_MAX) e[`${i.key}.details`] = `Máximo de ${DETAILS_MAX} caracteres.`
  if (p.quantity === null || p.quantity < 1 || p.quantity > 9999) e[`${i.key}.quantity`] = i.quantity.trim() ? 'De 1 a 9.999.' : 'Informe a quantidade.'
  if (p.priceCents === null || p.priceCents <= 0) e[`${i.key}.price`] = 'Informe o preço.'
  // Medidas são opcionais (só aparecem no PDF). Se preencher, tem que ser uma medida válida.
  if (i.width.trim() && (p.widthCm === null || p.widthCm < 1 || p.widthCm > 2000)) e[`${i.key}.width`] = 'De 0,01 a 20,00 m.'
  if (i.height.trim() && (p.heightCm === null || p.heightCm < 1 || p.heightCm > 2000)) e[`${i.key}.height`] = 'De 0,01 a 20,00 m.'
  return e
}

const DISCOUNT_MESSAGES = {
  NEGATIVE: 'O desconto não pode ser negativo.',
  PERCENT_OVER_100: 'O desconto não pode passar de 100%.',
  GREATER_THAN_SUBTOTAL: 'O desconto não pode ser maior que o subtotal.',
}

// ---------- Página ----------
export function QuoteEditorPage() {
  const { id } = useParams()
  return <EditorLoader key={id} id={Number(id)} />
}

function EditorLoader({ id }: { id: number }) {
  const [attempt, setAttempt] = useState(0)
  const fetcher = useCallback(() => getQuote(id), [id])
  const { loading, data, error } = useRequest(`${id}#${attempt}`, fetcher)

  if (data && data.status !== 'DRAFT') return <Navigate to={`/orcamentos/${id}`} replace />
  if (data) return <Editor quote={data} />

  return (
    <>
      <PageHero title="Orçamento" back={{ to: '/orcamentos', label: 'Voltar para orçamentos' }} />
      <main className="page-body">
        {loading ? <CardSkeleton /> : <CustomerLoadError error={error} onRetry={() => setAttempt((n) => n + 1)} />}
      </main>
    </>
  )
}

function Editor({ quote }: { quote: Quote }) {
  const navigate = useNavigate()
  const direct = useSearchParams()[0].get('direta') === '1' // HU32 — Venda direta
  const [saved, setSaved] = useState<FormState>(() => toForm(quote))
  const [form, setForm] = useState<FormState>(saved)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState<'draft' | 'review' | null>(null)
  const [savedAt, setSavedAt] = useState<string>(quote.updatedAt)
  const [focusKey, setFocusKey] = useState<string | null>(null)

  const dirty = JSON.stringify(form) !== JSON.stringify(saved)

  // Avisa antes de fechar a aba com alteração não salva
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // Item novo: leva o foco para a descrição
  useEffect(() => {
    if (focusKey) document.getElementById(`${focusKey}-description`)?.focus()
  }, [focusKey])

  // ----- Cálculo ao vivo -----
  const subtotal = useMemo(() => form.items.reduce((s, i) => s + liveSubtotal(i), 0), [form.items])
  const discountValue = parseDecimalToHundredths(form.discountValue)
  const discountErrorCode = validateDiscount(subtotal, form.discountType, discountValue)
  const discount = discountErrorCode ? 0 : discountCents(subtotal, form.discountType, discountValue)
  const total = subtotal - discount
  const discountTextInvalid = form.discountValue.trim() !== '' && discountValue === null

  function updateItem(key: string, patch: Partial<ItemForm>) {
    setForm((f) => ({ ...f, items: f.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }))
    // Corrigiu o campo? some o erro dele
    setErrors((e) => {
      const next = { ...e }
      for (const field of Object.keys(patch)) delete next[`${key}.${field}`]
      return next
    })
  }

  function addItem() {
    const item = emptyItem()
    setForm((f) => ({ ...f, items: [...f.items, item] }))
    setFocusKey(item.key)
  }

  function removeItem(key: string) {
    setForm((f) => ({ ...f, items: f.items.filter((i) => i.key !== key) }))
  }

  function buildRequest(): QuoteRequest {
    return {
      items: form.items.map((i): QuoteItemRequest => {
        const p = parseItem(i)
        return {
          description: i.description.trim(),
          pieceType: suggestPieceType(i.description),
          details: i.details.trim() || null,
          chargeType: 'UNIT',
          quantity: p.quantity ?? 0,
          unit: i.unit,
          widthCm: p.widthCm,
          heightCm: p.heightCm,
          unitPriceCents: p.priceCents ?? 0,
        }
      }),
      discountType: discountValue ? form.discountType : null,
      discountValue: discountValue || null,
      paymentTerms: null,
      notes: form.notes.trim() || null,
    }
  }

  async function save(mode: 'draft' | 'review') {
    if (saving) return
    // Validação da tela (o back valida de novo)
    const found: Errors = {}
    form.items.forEach((i) => Object.assign(found, validateItem(i)))
    if (discountTextInvalid) found.discount = 'Valor inválido. Use até 2 casas depois da vírgula.'
    else if (discountErrorCode) found.discount = DISCOUNT_MESSAGES[discountErrorCode]
    if (Object.keys(found).length > 0) {
      setErrors({ ...found, form: 'Confira os campos destacados.' })
      const first = Object.keys(found)[0].replace('.', '-')
      document.getElementById(first === 'discount' ? 'desconto-valor' : first)?.focus()
      return
    }

    setSaving(mode)
    setErrors({})
    try {
      const updated = await updateQuote(quote.id, buildRequest())
      const nextForm = toForm(updated)
      setSaved(nextForm)
      setForm(nextForm)
      setSavedAt(updated.updatedAt)
      if (mode === 'review') navigate(`/orcamentos/${quote.id}/revisar${direct ? '?direta=1' : ''}`)
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'VALIDATION_ERROR') {
          // "items[2].unitPriceCents" → erro no campo certo do item 3
          const mapped: Errors = { form: 'Confira os campos destacados.' }
          const fieldName: Record<string, string> = { description: 'description', details: 'details', quantity: 'quantity', unitPriceCents: 'price', widthCm: 'width', heightCm: 'height' }
          for (const fe of e.fieldErrors) {
            const m = fe.field.match(/^items\[(\d+)\]\.(\w+)$/)
            const item = m ? form.items[Number(m[1])] : undefined
            if (m && item) mapped[`${item.key}.${fieldName[m[2]] ?? m[2]}`] = fe.message
          }
          setErrors(mapped)
        } else if (e.code.startsWith('DISCOUNT_')) {
          setErrors({ discount: e.message, form: e.message })
        } else if (e.code === 'QUOTE_NOT_EDITABLE') {
          navigate(`/orcamentos/${quote.id}`, { replace: true })
        } else {
          setErrors({ form: e.message })
        }
      } else {
        setErrors({ form: 'Não foi possível salvar. Verifique sua conexão; o que você digitou continua aqui.' })
      }
    } finally {
      setSaving(null)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void save('review')
  }

  const canReview = form.items.length > 0 && total > 0
  const savedTime = new Date(savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const err = (key: string, field: string) => errors[`${key}.${field}`]

  return (
    <>
      <PageHero
        title={direct ? 'Venda direta' : `Orçamento nº ${quote.number}`}
        back={{ to: '/orcamentos', label: 'Voltar para orçamentos' }}
        badge={<StatusTag tone="neutral">Rascunho · {quote.version}ª proposta</StatusTag>}
        subtitle={dirty ? 'Alterações não salvas' : <span className="zv-saved"><CircleCheck size={18} strokeWidth={1.8} aria-hidden="true" />Rascunho salvo às {savedTime}</span>}
      />

      <QuoteSteps current={2} />
      <main className="page-body">
        <form className="oc-layout" onSubmit={onSubmit} noValidate data-testid="form-orcamento">
          <div className="oc-layout__main">
            {errors.form && <Alert variant="error">{errors.form}</Alert>}
            {quote.versionReason && <Alert variant="info">Versão {quote.version}: {quote.versionReason}</Alert>}

            <CustomerCard customer={quote.customer} />

            <section className="cl-card" aria-labelledby="t-itens">
              <div className="cl-card__header">
                <h2 id="t-itens" className="cl-card__title">Itens</h2>
                </div>
              <p className="zv-sub zv-sub--tight">{form.items.length === 1 ? '1 item' : `${form.items.length} itens`}</p>

              {form.items.length === 0 && <p className="cl-muted">Nenhum item ainda. Clique em "Adicionar item" para começar.</p>}

              {form.items.map((item, index) => {
                const sub = liveSubtotal(item)
                const p = parseItem(item)
                const isNew = item.key === focusKey && item.description === ''
                return (
                  <article key={item.key} className={`zv-item${isNew ? ' is-new' : ''}`} aria-label={`Item ${index + 1}`} data-testid="item-orcamento">
                    <div className="zv-item__head">
                      <b>Item {index + 1}</b>
                      <button type="button" className="zv-btn zv-btn--sm zv-btn--danger" aria-label={`Remover item ${index + 1}`} onClick={() => removeItem(item.key)}>
                        <Trash2 size={20} strokeWidth={1.8} aria-hidden="true" />Remover
                      </button>
                    </div>

                    <div className="cl-field">
                      <label htmlFor={`${item.key}-description`} className="oc-label">Descrição <span className="zv-req">*</span></label>
                      <input autoComplete="off"
                        id={`${item.key}-description`}
                        className="cl-input"
                        value={item.description}
                        maxLength={200}
                        onChange={(e) => updateItem(item.key, { description: e.target.value })}
                        aria-invalid={err(item.key, 'description') ? true : undefined}
                        aria-describedby={err(item.key, 'description') ? `${item.key}-description-erro` : undefined}
                        data-testid="item-descricao"
                      />
                      {err(item.key, 'description') && <p id={`${item.key}-description-erro`} className="field__error">{err(item.key, 'description')}</p>}
                    </div>

                    <div className="cl-field">
                      <label htmlFor={`${item.key}-details`} className="oc-label">Detalhes (opcional)</label>
                      <input autoComplete="off" id={`${item.key}-details`} className="cl-input" value={item.details} maxLength={DETAILS_MAX}
                        placeholder="Ex.: cor preta, vidro 4 mm"
                        onChange={(e) => updateItem(item.key, { details: e.target.value })}
                        aria-invalid={err(item.key, 'details') ? true : undefined}
                        aria-describedby={`${item.key}-details-info`} data-testid="item-detalhes" />
                      {err(item.key, 'details')
                        ? <p id={`${item.key}-details-info`} className="field__error">{err(item.key, 'details')}</p>
                        : <p id={`${item.key}-details-info`} className="zv-counter">{item.details.length}/{DETAILS_MAX}</p>}
                    </div>

                    <div className="zv-item__nums">
                      <NumField id={`${item.key}-quantity`} label="Quantidade" value={item.quantity} inputMode="numeric"
                        onChange={(v) => updateItem(item.key, { quantity: v.replace(/\D/g, '').slice(0, 4) })} error={err(item.key, 'quantity')} />

                      {/* Medida da peça: só informa (sai no PDF). Não entra na conta do preço. */}
                      <NumField id={`${item.key}-width`} label="Largura (m)" value={item.width} inputMode="decimal" placeholder="opcional"
                        onChange={(v) => updateItem(item.key, { width: v.replace(/\./g, ',').replace(/[^\d,]/g, '') })}
                        onBlur={() => updateItem(item.key, { width: normalizeMeters(item.width) })} error={err(item.key, 'width')} />
                      <NumField id={`${item.key}-height`} label="Altura (m)" value={item.height} inputMode="decimal" placeholder="opcional"
                        onChange={(v) => updateItem(item.key, { height: v.replace(/\./g, ',').replace(/[^\d,]/g, '') })}
                        onBlur={() => updateItem(item.key, { height: normalizeMeters(item.height) })} error={err(item.key, 'height')} />

                      <NumField id={`${item.key}-price`} label="Preço de cada" value={item.price} inputMode="numeric" placeholder="0,00" prefix="R$"
                        onChange={(v) => updateItem(item.key, { price: maskMoneyInput(v) })} error={err(item.key, 'price')} />
                    </div>

                    {p.quantity && p.priceCents ? (
                      <p className="zv-item__calc" data-testid="item-conta">
                        {p.widthCm && p.heightCm ? <>Medida {formatMeters(p.widthCm)} × {formatMeters(p.heightCm)} m · </> : null}
                        {p.quantity} {item.unit} × {formatMoney(p.priceCents)} = <strong data-testid="item-subtotal">{formatMoney(sub)}</strong>
                      </p>
                    ) : null}
                  </article>
                )
              })}

              <button type="button" className="oc-add" onClick={addItem} data-testid="adicionar-item">
                <Plus size={20} strokeWidth={1.8} aria-hidden="true" />
                Adicionar item
              </button>
            </section>

            <section className="cl-card" aria-labelledby="t-cond">
              <h2 id="t-cond" className="cl-card__title">Observações</h2>
              <div className="cl-field">
                <label htmlFor="observacoes" className="oc-label">Observações (opcional)</label>
                <textarea autoComplete="off" id="observacoes" className="cl-input cl-textarea" rows={4} maxLength={NOTES_MAX} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Ex.: forma de pagamento, prazo, cor do alumínio, tipo de vidro…" aria-describedby="obs-contador" data-testid="observacoes" />
                <p id="obs-contador" className="zv-counter">Aparece no PDF. Pode escrever a forma de pagamento e o prazo aqui.</p>
              </div>
            </section>
          </div>

          <aside className="zv-card zv-card--side zv-summary" aria-labelledby="t-resumo">
            <h2 id="t-resumo" className="zv-h2">Resumo</h2>
            <div className="oc-summary__row"><span>Subtotal ({form.items.length === 1 ? '1 item' : `${form.items.length} itens`})</span><span data-testid="resumo-subtotal">{formatMoney(subtotal)}</span></div>

            <div className="oc-discount">
              <span className="oc-label" id="desconto-label">Desconto</span>
              <div className="oc-discount__row">
                <div className="oc-seg oc-seg--small" role="radiogroup" aria-labelledby="desconto-label">
                  {(['PERCENT', 'AMOUNT'] as const).map((t) => (
                    <label key={t} className="oc-seg__opt">
                      <input autoComplete="off" type="radio" name="discount-type" value={t} checked={form.discountType === t}
                        onChange={() => { setForm((f) => ({ ...f, discountType: t, discountValue: '' })); setErrors((e) => ({ ...e, discount: '' })) }} />
                      {t === 'PERCENT' ? '%' : 'R$'}
                    </label>
                  ))}
                </div>
                <label htmlFor="desconto-valor" className="sr-only">{form.discountType === 'PERCENT' ? 'Desconto em porcentagem' : 'Desconto em reais'}</label>
                <input autoComplete="off"
                  id="desconto-valor"
                  className="cl-input oc-input-num"
                  inputMode={form.discountType === 'PERCENT' ? 'decimal' : 'numeric'}
                  placeholder="0"
                  value={form.discountValue}
                  onChange={(e) => {
                    const v = form.discountType === 'AMOUNT' ? maskMoneyInput(e.target.value) : e.target.value.replace(/[^\d,]/g, '')
                    setForm((f) => ({ ...f, discountValue: v }))
                    setErrors((er) => ({ ...er, discount: '' }))
                  }}
                  aria-invalid={errors.discount || discountErrorCode || discountTextInvalid ? true : undefined}
                  aria-describedby="desconto-info"
                  data-testid="desconto-valor"
                />
              </div>
              <p id="desconto-info" className={discountErrorCode || discountTextInvalid || errors.discount ? 'field__error' : 'oc-discount__info'} aria-live="polite">
                {discountTextInvalid
                  ? 'Use até 2 casas depois da vírgula.'
                  : discountErrorCode
                    ? DISCOUNT_MESSAGES[discountErrorCode]
                    : errors.discount || (discount > 0 ? <><span>{form.discountType === 'PERCENT' ? `${form.discountValue}% de desconto` : 'Desconto'}</span><span className="oc-minus">− {formatMoney(discount)}</span></> : 'Sem desconto')}
              </p>
            </div>

            <dl className="zv-sum zv-sum--bigger">
              {discount > 0 && <div><dt>Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div>}
              {discount > 0 && <div className="zv-sum__off"><dt>Desconto{form.discountType === 'PERCENT' ? ` (${form.discountValue}%)` : ''}</dt><dd>− {formatMoney(discount)}</dd></div>}
              <div className="zv-sum__total"><dt>Total</dt><dd data-testid="resumo-total">{formatMoney(total)}</dd></div>
            </dl>

            <Button type="submit" fullWidth loading={saving === 'review'} loadingText="Salvando…" disabled={!canReview || saving !== null} data-testid="revisar-orcamento">
              <ChevronRight size={20} strokeWidth={1.8} aria-hidden="true" />Conferir orçamento
            </Button>
            <button type="button" className="zv-btn zv-btn--full" onClick={() => save('draft')} disabled={saving !== null} data-testid="salvar-rascunho">
              {saving === 'draft' ? 'Salvando…' : 'Salvar rascunho'}
            </button>
            <p className="zv-lock"><Lock size={18} strokeWidth={1.8} aria-hidden="true" />{canReview ? 'Os valores são conferidos pelo sistema ao salvar.' : 'Adicione pelo menos 1 item com preço para conferir.'}</p>
          </aside>
        </form>
      </main>
    </>
  )
}

type NumFieldProps = {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  inputMode: 'numeric' | 'decimal'
  error?: string
  placeholder?: string
  prefix?: string
}

function NumField({ id, label, value, onChange, onBlur, inputMode, error, placeholder, prefix }: NumFieldProps) {
  return (
    <div className="cl-field">
      <label htmlFor={id} className="oc-label">{label}</label>
      <div className={prefix ? 'oc-prefixed' : undefined}>
        {prefix && <span className="oc-prefixed__text" aria-hidden="true">{prefix}</span>}
        <input autoComplete="off"
          id={id}
          className="cl-input oc-input-num"
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-erro` : undefined}
        />
      </div>
      {error && <p id={`${id}-erro`} className="field__error">{error}</p>}
    </div>
  )
}

