import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { useRequest } from '../../hooks/useRequest'
import { ApiError } from '../auth/types'
import { maskPhone } from '../clientes/format'
import { CardSkeleton, CustomerLoadError } from '../clientes/CustomerLoadStates'
import { PAYMENT_SHORTCUTS } from './labels'
import { PieceDrawing } from './PieceDrawing'
import { PIECE_LABEL, detectLeaves, detectPiece, isSliding } from './pieceKind'
import {
  areaCm2, discountCents, formatAreaM2, formatMeters, formatMoney, formatPercent,
  itemSubtotalCents, maskMoneyInput, parseDecimalToHundredths, validateDiscount,
} from './money'
import { getQuote, updateQuote } from './quotesApi'
import type { ChargeType, DiscountType, ItemUnit, Quote, QuoteItemRequest, QuoteRequest } from './types'
import '../../components/ui/ButtonVariants.css'
import '../clientes/Clientes.css'
import './Orcamentos.css'

// HU14 — Criar/editar orçamento (só RASCUNHO).
// A tela calcula ao vivo para ajudar; o back recalcula e é quem vale.

// Todo item é cobrado por m²: os campos são sempre Qtd. (peças), Unid. (m²), Largura, Altura e Preço por m²
const AREA_OPTION = 'm2'
const NOTES_MAX = 1000
const TERMS_MAX = 300

// Item no formulário: tudo texto, do jeito que a pessoa digita
type ItemForm = {
  key: string
  description: string
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
  paymentTerms: string
  notes: string
}

type Errors = Record<string, string> // "item-3.price" → mensagem | "discount" | "form"

let keySeq = 0
const newKey = () => `item-${++keySeq}`

function emptyItem(): ItemForm {
  return { key: newKey(), description: '', chargeType: 'AREA', quantity: '1', unit: 'un', width: '', height: '', price: '' }
}

function toForm(q: Quote): FormState {
  return {
    items: q.items.map((i) => ({
      key: newKey(),
      description: i.description,
      chargeType: 'AREA', // item antigo cobrado por unidade também abre como m² (preencher largura e altura)
      quantity: String(i.quantity),
      unit: i.unit ?? 'un',
      width: i.widthCm ? formatMeters(i.widthCm) : '',
      height: i.heightCm ? formatMeters(i.heightCm) : '',
      price: maskMoneyInput(String(i.unitPriceCents)),
    })),
    discountType: q.discountType ?? 'PERCENT',
    discountValue: q.discountValue ? (q.discountType === 'AMOUNT' ? maskMoneyInput(String(q.discountValue)) : formatPercent(q.discountValue)) : '',
    paymentTerms: q.paymentTerms ?? '',
    notes: q.notes ?? '',
  }
}

// Texto → números (null = inválido/vazio)
function parseItem(i: ItemForm) {
  const quantity = /^\d+$/.test(i.quantity.trim()) ? Number(i.quantity.trim()) : null
  return {
    quantity,
    widthCm: parseDecimalToHundredths(i.width),
    heightCm: parseDecimalToHundredths(i.height),
    priceCents: parseDecimalToHundredths(i.price),
  }
}

function liveSubtotal(i: ItemForm): number {
  const p = parseItem(i)
  if (!p.quantity || !p.priceCents) return 0
  if (i.chargeType === 'AREA' && (!p.widthCm || !p.heightCm)) return 0
  return itemSubtotalCents({ chargeType: i.chargeType, quantity: p.quantity, widthCm: p.widthCm, heightCm: p.heightCm, unitPriceCents: p.priceCents })
}

function validateItem(i: ItemForm): Errors {
  const e: Errors = {}
  const p = parseItem(i)
  const desc = i.description.trim()
  if (desc.length < 2) e[`${i.key}.description`] = 'Descreva o item.'
  else if (desc.length > 200) e[`${i.key}.description`] = 'Máximo de 200 caracteres.'
  if (p.quantity === null || p.quantity < 1 || p.quantity > 9999) e[`${i.key}.quantity`] = 'De 1 a 9.999.'
  if (p.priceCents === null || p.priceCents <= 0) e[`${i.key}.price`] = 'Informe o preço.'
  if (i.chargeType === 'AREA') {
    if (p.widthCm === null || p.widthCm < 1 || p.widthCm > 2000) e[`${i.key}.width`] = 'De 0,01 a 20,00 m.'
    if (p.heightCm === null || p.heightCm < 1 || p.heightCm > 2000) e[`${i.key}.height`] = 'De 0,01 a 20,00 m.'
  }
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
          chargeType: i.chargeType,
          quantity: p.quantity ?? 0,
          unit: i.chargeType === 'UNIT' ? i.unit : null,
          widthCm: i.chargeType === 'AREA' ? p.widthCm : null,
          heightCm: i.chargeType === 'AREA' ? p.heightCm : null,
          unitPriceCents: p.priceCents ?? 0,
        }
      }),
      discountType: discountValue ? form.discountType : null,
      discountValue: discountValue || null,
      paymentTerms: form.paymentTerms.trim() || null,
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
      if (mode === 'review') navigate(`/orcamentos/${quote.id}/revisar`)
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'VALIDATION_ERROR') {
          // "items[2].unitPriceCents" → erro no campo certo do item 3
          const mapped: Errors = { form: 'Confira os campos destacados.' }
          const fieldName: Record<string, string> = { description: 'description', quantity: 'quantity', unitPriceCents: 'price', widthCm: 'width', heightCm: 'height' }
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
        title={`Orçamento #${quote.number}`}
        back={{ to: '/orcamentos', label: 'Voltar para orçamentos' }}
        badge={<span className="oc-hero-badge">Rascunho · v{quote.version}</span>}
        subtitle={dirty ? 'Alterações não salvas' : `Rascunho salvo às ${savedTime}`}
        actions={
          <button type="button" className="cl-hero-btn" onClick={() => save('draft')} disabled={saving !== null} data-testid="salvar-rascunho">
            {saving === 'draft' ? 'Salvando…' : 'Salvar rascunho'}
          </button>
        }
      />

      <main className="page-body">
        <form className="oc-layout" onSubmit={onSubmit} noValidate data-testid="form-orcamento">
          <div className="oc-layout__main">
            {errors.form && <Alert variant="error">{errors.form}</Alert>}
            {quote.versionReason && <Alert variant="info">Versão {quote.version}: {quote.versionReason}</Alert>}

            <section className="cl-card cl-card--elevated" aria-labelledby="t-cliente">
              <h2 id="t-cliente" className="cl-card__title">Cliente</h2>
              <div className="oc-customer">
                <span className="oc-avatar" aria-hidden="true">{quote.customer.name.split(' ').slice(0, 2).map((p) => p[0]).join('')}</span>
                <span className="oc-customer__text">
                  <span className="oc-customer__name">{quote.customer.name}</span>
                  <span className="cl-muted">{[quote.customer.whatsapp ? `WhatsApp ${maskPhone(quote.customer.whatsapp)}` : null, quote.customer.addressLine].filter(Boolean).join(' · ') || 'Sem contato cadastrado'}</span>
                </span>
              </div>
            </section>

            <section className="cl-card" aria-labelledby="t-itens">
              <div className="cl-card__header">
                <h2 id="t-itens" className="cl-card__title">Itens</h2>
                <span className="cl-card__action cl-muted">{form.items.length === 1 ? '1 item' : `${form.items.length} itens`}</span>
              </div>

              {form.items.length === 0 && <p className="cl-muted">Nenhum item ainda. Clique em "Adicionar item" para começar.</p>}

              {form.items.map((item, index) => {
                const sub = liveSubtotal(item)
                const p = parseItem(item)
                const isNew = item.key === focusKey && item.description === ''
                return (
                  <article key={item.key} className={`oc-item${isNew ? ' oc-item--new' : ''}`} aria-label={`Item ${index + 1}`} data-testid="item-orcamento">
                    <div className="oc-item__head">
                      <span className="oc-item__num">{index + 1}</span>
                      <div className="oc-item__desc">
                        <label htmlFor={`${item.key}-description`} className="sr-only">Descrição do item {index + 1}</label>
                        <input autoComplete="off"
                          id={`${item.key}-description`}
                          className="cl-input oc-input-strong"
                          placeholder="Descreva o item. Ex.: Box de vidro temperado 8 mm"
                          value={item.description}
                          maxLength={200}
                          onChange={(e) => updateItem(item.key, { description: e.target.value })}
                          aria-invalid={err(item.key, 'description') ? true : undefined}
                          aria-describedby={err(item.key, 'description') ? `${item.key}-description-erro` : undefined}
                          data-testid="item-descricao"
                        />
                        {err(item.key, 'description') && <p id={`${item.key}-description-erro`} className="field__error">{err(item.key, 'description')}</p>}
                        {/* Sem medidas: a miniatura fica no formato padrão da peça, não muda ao digitar largura/altura */}
                        {item.description.trim().length >= 3 && <PieceHint description={item.description} chargeType={item.chargeType} />}
                      </div>
                      <span className="oc-item__subtotal">
                        <span className="oc-item__subtotal-label">Subtotal</span>
                        <span className={`oc-item__subtotal-value${sub === 0 ? ' is-zero' : ''}`} data-testid="item-subtotal">{formatMoney(sub)}</span>
                      </span>
                      <button type="button" className="oc-icon-btn" aria-label={`Remover item ${index + 1}`} onClick={() => removeItem(item.key)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></svg>
                      </button>
                    </div>

                    <div className="oc-item__fields oc-item__fields--area">
                      <NumField id={`${item.key}-quantity`} label="Qtd. (peças)" value={item.quantity} inputMode="numeric"
                        onChange={(v) => updateItem(item.key, { quantity: v.replace(/\D/g, '').slice(0, 4) })} error={err(item.key, 'quantity')} />

                      {/* Sempre m² (única opção) */}
                      <div className="cl-field">
                        <label htmlFor={`${item.key}-unit`} className="oc-label">Unid.</label>
                        <select autoComplete="off" id={`${item.key}-unit`} className="cl-input oc-input-sm" value={AREA_OPTION} onChange={() => {}} data-testid="item-unidade">
                          <option value={AREA_OPTION}>m²</option>
                        </select>
                      </div>

                      <NumField id={`${item.key}-width`} label="Largura (m)" value={item.width} inputMode="decimal" placeholder="0,00"
                        onChange={(v) => updateItem(item.key, { width: v.replace(/[^\d,]/g, '') })} error={err(item.key, 'width')} />
                      <NumField id={`${item.key}-height`} label="Altura (m)" value={item.height} inputMode="decimal" placeholder="0,00"
                        onChange={(v) => updateItem(item.key, { height: v.replace(/[^\d,]/g, '') })} error={err(item.key, 'height')} />

                      <NumField id={`${item.key}-price`} label="Preço por m²" value={item.price} inputMode="numeric" placeholder="0,00" prefix="R$"
                        onChange={(v) => updateItem(item.key, { price: maskMoneyInput(v) })} error={err(item.key, 'price')} />
                    </div>

                    {item.chargeType === 'AREA' && p.widthCm && p.heightCm && p.quantity ? (
                      <p className="oc-item__calc" data-testid="item-area">
                        {formatMeters(p.widthCm)} m × {formatMeters(p.heightCm)} m = <strong>{formatAreaM2(areaCm2(p.widthCm, p.heightCm))} m² por peça</strong>
                        {' · '}{p.quantity} {p.quantity === 1 ? 'peça' : 'peças'} = <strong>{formatAreaM2(areaCm2(p.widthCm, p.heightCm) * p.quantity)} m²</strong>
                      </p>
                    ) : null}
                  </article>
                )
              })}

              <button type="button" className="oc-add" onClick={addItem} data-testid="adicionar-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                Adicionar item
              </button>
            </section>

            <section className="cl-card" aria-labelledby="t-cond">
              <h2 id="t-cond" className="cl-card__title">Condições</h2>
              <div className="cl-field">
                <label htmlFor="pagamento" className="cl-field__label">Condições de pagamento</label>
                <input autoComplete="off" id="pagamento" className="cl-input" value={form.paymentTerms} maxLength={TERMS_MAX} onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))} placeholder="Ex.: 50% de entrada e 50% na entrega" />
                <div className="oc-pills">
                  {PAYMENT_SHORTCUTS.map((s) => (
                    <button key={s} type="button" className="oc-pill" aria-pressed={form.paymentTerms === s} onClick={() => setForm((f) => ({ ...f, paymentTerms: s }))}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="cl-field">
                <label htmlFor="observacoes" className="cl-field__label">Observações (aparecem no PDF)</label>
                <textarea autoComplete="off" id="observacoes" className="cl-input cl-textarea" rows={3} maxLength={NOTES_MAX} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Ex.: Prazo de fabricação de 15 dias úteis após a aprovação." aria-describedby="obs-contador" />
                <p id="obs-contador" className="cl-counter">{form.notes.length}/{NOTES_MAX}</p>
              </div>
            </section>
          </div>

          <aside className="oc-summary" aria-labelledby="t-resumo">
            <h2 id="t-resumo" className="cl-card__title">Resumo</h2>
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

            <div className="oc-summary__total">
              <span className="cl-muted">Valor final</span>
              <span className="oc-summary__value" data-testid="resumo-total">{formatMoney(total)}</span>
            </div>

            <Button type="submit" fullWidth loading={saving === 'review'} loadingText="Salvando…" disabled={!canReview || saving !== null} data-testid="revisar-orcamento">
              Revisar orçamento
            </Button>
            <p className="oc-small cl-muted">
              {canReview ? 'Os valores são conferidos pelo sistema ao salvar.' : 'Adicione pelo menos 1 item com preço para revisar.'}
            </p>
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
  inputMode: 'numeric' | 'decimal'
  error?: string
  placeholder?: string
  prefix?: string
}

function NumField({ id, label, value, onChange, inputMode, error, placeholder, prefix }: NumFieldProps) {
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
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-erro` : undefined}
        />
      </div>
      {error && <p id={`${id}-erro`} className="field__error">{error}</p>}
    </div>
  )
}

// Dica: mostra qual desenho vai sair no PDF, a partir da descrição digitada
function PieceHint({ description, chargeType, widthCm, heightCm }: { description: string; chargeType: ChargeType; widthCm?: number | null; heightCm?: number | null }) {
  const kind = detectPiece(description)
  const sliding = isSliding(kind)
  return (
    <p className="oc-piece-hint" data-testid="item-desenho">
      <PieceDrawing className="oc-piece-hint__img" item={{ description, chargeType, widthCm: widthCm ?? null, heightCm: heightCm ?? null, unit: null }} />
      {kind === 'GENERIC'
        ? <span>No PDF sai um contorno simples. Comece pelo nome da peça (ex.: <em>janela de correr</em>, <em>porta</em>, <em>portão</em>, <em>box</em>, <em>grade</em>, <em>guarda-corpo</em>, <em>veneziana</em>, <em>cobertura</em>) para sair o desenho.</span>
        : <span>Desenho no PDF: <strong>{PIECE_LABEL[kind]}{sliding ? ` · ${detectLeaves(description)} folhas` : ''}</strong></span>}
    </p>
  )
}
