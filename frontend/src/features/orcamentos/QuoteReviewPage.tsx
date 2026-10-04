import { useCallback, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { useRequest } from '../../hooks/useRequest'
import { ApiError } from '../auth/types'
import { CardSkeleton, CustomerLoadError } from '../clientes/CustomerLoadStates'
import { formatDate, maskPhone } from '../clientes/format'
import { formatAreaM2, formatMeters, formatMoney, formatPercent } from './money'
import { confirmQuote, getQuote } from './quotesApi'
import type { Quote } from './types'
import '../../components/ui/ButtonVariants.css'
import '../clientes/Clientes.css'
import './Orcamentos.css'

// HU15 — Revisar e confirmar. Confirmar NÃO envia nada ao cliente.

export function QuoteReviewPage() {
  const { id } = useParams()
  const quoteId = Number(id)
  const [attempt, setAttempt] = useState(0)
  const fetcher = useCallback(() => getQuote(quoteId), [quoteId])
  const { loading, data, error } = useRequest(`${quoteId}#${attempt}`, fetcher)

  if (data && data.status !== 'DRAFT') return <Navigate to={`/orcamentos/${quoteId}`} replace />
  if (data) return <Review quote={data} />
  return (
    <>
      <PageHero title="Revise antes de confirmar" back={{ to: `/orcamentos/${quoteId}/editar`, label: 'Voltar e editar' }} />
      <main className="page-body">{loading ? <CardSkeleton /> : <CustomerLoadError error={error} onRetry={() => setAttempt((n) => n + 1)} />}</main>
    </>
  )
}

function Review({ quote }: { quote: Quote }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    if (confirming) return // duplo clique: a 2ª vez nem chega no back (e o back também é idempotente)
    setConfirming(true)
    setError(null)
    try {
      await confirmQuote(quote.id)
      navigate(`/orcamentos/${quote.id}`, { replace: true, state: { flash: 'Orçamento confirmado com sucesso.' } })
    } catch (e) {
      setConfirming(false)
      setError(e instanceof ApiError ? e.message : 'Não foi possível confirmar. Verifique sua conexão e tente de novo.')
    }
  }

  const blocked = quote.items.length === 0 || quote.totalCents <= 0
  const checks = [
    { ok: true, text: `Cliente: ${quote.customer.name}` },
    { ok: quote.items.length > 0, text: quote.items.length === 0 ? 'Nenhum item ainda' : quote.items.length === 1 ? '1 item com preço' : `${quote.items.length} itens com preço` },
    { ok: quote.totalCents > 0, text: `Valor final ${formatMoney(quote.totalCents)}` },
  ]

  return (
    <>
      <PageHero
        title="Revise antes de confirmar"
        back={{ to: `/orcamentos/${quote.id}/editar`, label: 'Voltar e editar' }}
        subtitle="É assim que o cliente vai ver. Confirmar não envia nada ainda."
      />
      <main className="page-body oc-layout oc-layout--review">
        <QuotePreview quote={quote} />
        <aside className="oc-summary" aria-labelledby="t-tudo-certo">
          <h2 id="t-tudo-certo" className="cl-card__title">Está tudo certo?</h2>
          <ul className="oc-checks">
            {checks.map((c) => (
              <li key={c.text} className={c.ok ? undefined : 'oc-checks__todo'}>
                {c.ok ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D5B33" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A8420D" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.5h.01" /></svg>
                )}
                <span><span className="sr-only">{c.ok ? 'Ok: ' : 'Falta: '}</span>{c.text}</span>
              </li>
            ))}
          </ul>
          {error && <Alert variant="error">{error}</Alert>}
          {blocked && <Alert variant="warning">Adicione pelo menos 1 item com preço antes de confirmar.</Alert>}
          <Button fullWidth onClick={confirm} loading={confirming} loadingText="Confirmando…" disabled={blocked} data-testid="confirmar-orcamento">
            Confirmar orçamento
          </Button>
          <Link to={`/orcamentos/${quote.id}/editar`} className="btn btn--secondary btn--full oc-btn-link">Voltar e editar</Link>
          <p className="oc-small cl-muted">Depois de confirmar, aparecem as opções de enviar pelo WhatsApp, gerar PDF e imprimir.</p>
        </aside>
      </main>
    </>
  )
}

// Prévia do orçamento (como no design "Revisar orçamento"): cabeçalho, itens, valores e condições.
// Os valores vêm do back (já recalculados ao salvar o rascunho).
function QuotePreview({ quote }: { quote: Quote }) {
  const phone = quote.customer.whatsapp ?? quote.customer.phone
  return (
    <article className="oc-preview" aria-label="Prévia do orçamento" data-testid="previa-orcamento">
      <header className="oc-preview__head">
        <div className="oc-preview__block">
          <span className="oc-preview__label">Orçamento</span>
          <span className="oc-preview__number">#{quote.number} <span>v{quote.version}</span></span>
          <span className="oc-preview__muted">{formatDate(quote.updatedAt)}</span>
        </div>
        <div className="oc-preview__block oc-preview__block--right">
          <span className="oc-preview__label">Cliente</span>
          <span className="oc-preview__customer">{quote.customer.name}</span>
          {phone && <span className="oc-preview__muted">{maskPhone(phone)}</span>}
          {quote.customer.addressLine && <span className="oc-preview__muted">{quote.customer.addressLine}</span>}
        </div>
      </header>

      <table className="oc-preview__table">
        <thead>
          <tr><th scope="col">Item</th><th scope="col">Qtd.</th><th scope="col">Preço</th><th scope="col">Subtotal</th></tr>
        </thead>
        <tbody>
          {quote.items.length === 0 && (
            <tr><td colSpan={4} className="oc-preview__empty">Nenhum item ainda. Volte e adicione os itens do orçamento.</td></tr>
          )}
          {quote.items.map((item) => {
            const area = item.chargeType === 'AREA' && item.widthCm && item.heightCm
            const totalArea = (item.areaPerPieceCm2 ?? 0) * item.quantity
            return (
              <tr key={item.id}>
                <td data-label="Item">
                  <span className="oc-preview__item">
                    <strong>{item.description}</strong>
                    {area && <span>{item.quantity} {item.quantity === 1 ? 'peça' : 'peças'} de {formatMeters(item.widthCm ?? 0)} × {formatMeters(item.heightCm ?? 0)} m · {formatAreaM2(totalArea)} m²</span>}
                  </span>
                </td>
                <td data-label="Qtd.">{area ? `${formatAreaM2(totalArea)} m²` : `${item.quantity} ${item.unit ?? 'un'}`}</td>
                <td data-label="Preço">{formatMoney(item.unitPriceCents)}{area ? '/m²' : ''}</td>
                <td data-label="Subtotal"><strong>{formatMoney(item.subtotalCents)}</strong></td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="oc-preview__totals">
        <div><span>Subtotal</span><span>{formatMoney(quote.subtotalCents)}</span></div>
        {quote.discountCents > 0 && (
          <div>
            <span>Desconto{quote.discountType === 'PERCENT' && quote.discountValue ? ` (${formatPercent(quote.discountValue)}%)` : ''}</span>
            <span className="oc-preview__discount">− {formatMoney(quote.discountCents)}</span>
          </div>
        )}
        <div className="oc-preview__final"><span>Valor final</span><span>{formatMoney(quote.totalCents)}</span></div>
      </div>

      {(quote.paymentTerms || quote.notes) && (
        <div className="oc-preview__terms">
          {quote.paymentTerms && <div><span className="oc-preview__label">Pagamento</span><span>{quote.paymentTerms}</span></div>}
          {quote.notes && <div><span className="oc-preview__label">Observações</span><span className="oc-preview__notes">{quote.notes}</span></div>}
        </div>
      )}
    </article>
  )
}
