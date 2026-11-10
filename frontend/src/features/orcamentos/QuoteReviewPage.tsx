import { useCallback, useState } from 'react'
import { ChevronLeft, CircleCheck, Info, TriangleAlert, Zap } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { ItemsCard } from '../../components/zbox'
import { useRequest } from '../../hooks/useRequest'
import { ApiError } from '../auth/types'
import { CardSkeleton, CustomerLoadError } from '../clientes/CustomerLoadStates'
import { customerMobile, formatDate, maskPhone } from '../clientes/format'
import { discountLabel, toItemView } from './itemView'
import { formatMoney } from './money'
import { confirmQuote, getQuote } from './quotesApi'
import { directSaleToOrder } from '../pedidos/ordersApi'
import { QuoteSteps } from './QuoteSteps'
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
  const direct = useSearchParams()[0].get('direta') === '1' // HU32 — Venda direta
  const editTo = `/orcamentos/${quote.id}/editar${direct ? '?direta=1' : ''}`
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    if (confirming) return // duplo clique: a 2ª vez nem chega no back (e o back também é idempotente)
    setConfirming(true)
    setError(null)
    try {
      if (direct) {
        // Confirma + aprova + cria o pedido de uma vez (no back: uma transação só)
        const order = await directSaleToOrder(quote.id)
        navigate(`/pedidos/${order.id}`, { replace: true, state: { flash: 'Pedido criado. Agora é só acompanhar a produção e registrar os pagamentos.' } })
        return
      }
      await confirmQuote(quote.id)
      navigate(`/orcamentos/${quote.id}`, { replace: true, state: { flash: 'Orçamento confirmado com sucesso.' } })
    } catch (e) {
      setConfirming(false)
      const fallback = direct ? 'Não foi possível criar o pedido. Nada foi salvo. Verifique sua conexão e tente de novo.' : 'Não foi possível confirmar. Verifique sua conexão e tente de novo.'
      setError(e instanceof ApiError ? e.message : fallback)
    }
  }

  const blocked = quote.items.length === 0 || quote.totalCents <= 0
  const checks = [
    { ok: true, text: `Cliente: ${quote.customer.name}` },
    { ok: quote.items.length > 0, text: quote.items.length === 0 ? 'Nenhum item ainda' : quote.items.length === 1 ? '1 item com preço' : `${quote.items.length} itens com preço` },
    { ok: quote.totalCents > 0, text: `Total de ${formatMoney(quote.totalCents)}` },
  ]

  return (
    <>
      <PageHero
        title={direct ? 'Venda direta · conferir' : 'Confira antes de confirmar'}
        back={{ to: editTo, label: 'Voltar e editar' }}
        subtitle={direct ? 'Confira e crie o pedido. Nada vai ser enviado ao cliente.' : 'É assim que o cliente vai ver.'}
      />
      <QuoteSteps current={3} />
      <main className="page-body oc-layout oc-layout--review">
        <QuotePreview quote={quote} />
        <aside className="zv-card zv-card--side" aria-labelledby="t-tudo-certo">
          <h2 id="t-tudo-certo" className="zv-h2">Está tudo certo?</h2>
          <ul className="oc-checks">
            {checks.map((c) => (
              <li key={c.text} className={c.ok ? undefined : 'oc-checks__todo'}>
                {c.ok ? <CircleCheck size={24} strokeWidth={1.8} aria-hidden="true" /> : <TriangleAlert size={24} strokeWidth={1.8} aria-hidden="true" />}
                <span><span className="sr-only">{c.ok ? 'Ok: ' : 'Falta: '}</span>{c.text}</span>
              </li>
            ))}
          </ul>
          {error && <Alert variant="error">{error}</Alert>}
          {blocked && <Alert variant="warning">Adicione pelo menos 1 item com preço antes de {direct ? 'criar o pedido' : 'confirmar'}.</Alert>}
          {direct ? (
            <Button fullWidth onClick={confirm} loading={confirming} loadingText="Criando pedido…" disabled={blocked} data-testid="criar-pedido-direto">
              <Zap size={20} strokeWidth={1.8} aria-hidden="true" />Criar pedido
            </Button>
          ) : (
            <Button fullWidth onClick={confirm} loading={confirming} loadingText="Confirmando…" disabled={blocked} data-testid="confirmar-orcamento">
              <CircleCheck size={20} strokeWidth={1.8} aria-hidden="true" />Confirmar orçamento
            </Button>
          )}
          <Link to={editTo} className="zv-btn zv-btn--full"><ChevronLeft size={20} strokeWidth={1.8} aria-hidden="true" />Voltar e editar</Link>
          {direct
            ? <p className="zv-obs oc-direct-note"><Info size={22} strokeWidth={1.8} aria-hidden="true" /><span>O cliente <b>já fechou</b>. Não vamos gerar PDF nem abrir WhatsApp. O pedido nasce como <b>Novo</b> e <b>Não pago</b>.</span></p>
            : <p className="zv-obs">Confirmar <b>não envia</b> nada ao cliente. Depois você escolhe: WhatsApp, PDF ou imprimir.</p>}
        </aside>
      </main>
    </>
  )
}

// Prévia do orçamento (como no design "Revisar orçamento"): cabeçalho, itens, valores e condições.
// Os valores vêm do back (já recalculados ao salvar o rascunho).
function QuotePreview({ quote }: { quote: Quote }) {
  const phone = customerMobile(quote.customer)
  const contact = [phone && maskPhone(phone), quote.customer.addressLine].filter(Boolean).join(' · ')
  const notes = [quote.paymentTerms, quote.notes].filter(Boolean).join('\n')
  return (
    <article className="oc-preview" aria-label="Prévia do orçamento" data-testid="previa-orcamento">
      <header className="oc-preview__head">
        <div className="oc-preview__block">
          <span className="oc-preview__number">Orçamento nº {quote.number}</span>
          <span className="oc-preview__muted">{quote.version}ª proposta · {formatDate(quote.updatedAt)}</span>
        </div>
        <div className="oc-preview__block oc-preview__block--right">
          <span className="oc-preview__customer">{quote.customer.name}</span>
          {contact && <span className="oc-preview__muted">{contact}</span>}
        </div>
      </header>

      {quote.items.length > 0
        ? <ItemsCard items={quote.items.map(toItemView)} collapseAfter={Infinity} />
        : <p className="oc-preview__empty">Nenhum item ainda. Volte e adicione os itens do orçamento.</p>}

      <div className="oc-preview__foot">
        <div>
          {notes && <><span className="oc-preview__label">Observações</span><p className="oc-preview__notes">{notes}</p></>}
        </div>
        <dl className="zv-sum zv-sum--bigger">
          {quote.discountCents > 0 && <div><dt>Subtotal</dt><dd>{formatMoney(quote.subtotalCents)}</dd></div>}
          {quote.discountCents > 0 && <div className="zv-sum__off"><dt>Desconto{discountLabel(quote.discountType, quote.discountValue) ? ` (${discountLabel(quote.discountType, quote.discountValue)})` : ''}</dt><dd>− {formatMoney(quote.discountCents)}</dd></div>}
          <div className="zv-sum__total" data-testid="total"><dt>Total</dt><dd>{formatMoney(quote.totalCents)}</dd></div>
        </dl>
      </div>
    </article>
  )
}
