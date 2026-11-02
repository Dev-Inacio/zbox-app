import { useCallback, useState } from 'react'
import { CircleCheck, Copy, FileDown, Printer, Trash2, X } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { PagedList } from '../../components/ui/PagedList'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { NoAutofill } from '../../components/ui/NoAutofill'
import { Toast } from '../../components/ui/Toast'
import { ItemsCard } from '../../components/zbox'
import { useFlashMessage } from '../../hooks/useFlashMessage'
import { useRequest } from '../../hooks/useRequest'
import { useCustomerWhatsapp } from '../../hooks/useCustomerWhatsapp'
import { ApiError } from '../auth/types'
import { customerMobile, formatDateTime, onlyDigits } from '../clientes/format'
import { CardSkeleton, CustomerLoadError } from '../clientes/CustomerLoadStates'
import { APPROVAL_LABEL, REJECTION_LABEL, STATUS_LABEL } from './labels'
import { discountLabel, toItemView } from './itemView'
import { formatMoney } from './money'
import {
  approveQuote, backToDraft, cancelQuote, createVersion, getQuote, registerDispatch, rejectQuote,
} from './quotesApi'
import { canShareFiles, canSharePdf, downloadFile, generateQuotePdf } from './quotePdf'
import { QuoteStatusBadge } from './QuoteStatusBadge'
import { ConvertToOrderDialog } from '../pedidos/OrderDialogs'
import type { ApprovalMethod, Quote, QuoteEvent, RejectionReason } from './types'
import { AppIcon } from '../../components/ui/AppIcon'
import type { AppIconName } from '../../components/ui/AppIcon'
import '../../components/ui/ButtonVariants.css'
import '../clientes/Clientes.css'
import './Orcamentos.css'

// HU16 (enviar), HU17 (nova versão), HU18 (aprovar/recusar/cancelar).
// Regra de ouro: quem decide se a ação vale é o back (transições de status). A tela só mostra o que faz sentido.

type DialogKind = 'whatsapp' | 'approve' | 'reject' | 'cancel' | 'version' | 'draft' | 'convert' | null

export function QuoteDetailPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const version = Number(params.get('versao')) || undefined
  return <QuoteDetail key={`${id}|${version ?? ''}`} id={Number(id)} version={version} />
}

function QuoteDetail({ id, version }: { id: number; version?: number }) {
  const navigate = useNavigate()
  const [attempt, setAttempt] = useState(0)
  const fetcher = useCallback(() => getQuote(id, version), [id, version])
  const request = useRequest(`${id}|${version}|${attempt}`, fetcher)
  const [toast, setToast, clearToast] = useFlashMessage()
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  const q = request.data

  if (!q) {
    return (
      <>
        <PageHero title={request.loading ? 'Carregando…' : 'Orçamento'} back={{ to: '/orcamentos', label: 'Voltar para orçamentos' }} />
        <main className="page-body">{request.loading ? <CardSkeleton /> : <CustomerLoadError error={request.error} onRetry={() => setAttempt((n) => n + 1)} />}</main>
      </>
    )
  }

  const quote = q
  const isLatest = quote.version === quote.latestVersion
  // Depois de aprovado (e do pedido entregue) o orçamento continua podendo ser reenviado e impresso
  const canResend = isLatest && (quote.status === 'SENT' || quote.status === 'APPROVED')

  function open(kind: DialogKind) {
    setDialogError(null)
    setDialog(kind)
  }

  // Executa uma ação no back, atualiza a tela e mostra o recado
  async function run(action: () => Promise<Quote>, success: string) {
    setBusy(true)
    setDialogError(null)
    try {
      const updated = await action()
      request.setData(updated)
      setDialog(null)
      setToast(success)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'INVALID_QUOTE_STATUS_TRANSITION') {
        // Alguém mudou o orçamento em outra tela: recarrega para mostrar a situação real
        setDialog(null)
        setAttempt((n) => n + 1)
        setToast('O orçamento mudou de situação. A tela foi atualizada.')
      } else {
        setDialogError(e instanceof ApiError ? e.message : 'Não foi possível concluir. Verifique sua conexão e tente de novo.')
      }
    } finally {
      setBusy(false)
    }
  }

  // Impressão: abre a página de impressão NESTA aba e a janela de imprimir já aparece.
  // (Em aba nova, o orçamento não aparecia: a aba nova começa do zero, sem os dados desta.)
  async function openPrint() {
    if (busy) return
    await run(() => registerDispatch(quote.id, 'PRINT'), 'Impressão aberta.')
    navigate(`/orcamentos/${quote.id}/imprimir?versao=${quote.version}&imprimir=1`)
  }

  // Baixar PDF: gera o arquivo e baixa direto (sem passar pela tela de impressão)
  async function downloadPdf() {
    if (pdfBusy) return
    setPdfBusy(true)
    try {
      const file = await generateQuotePdf(quote)
      downloadFile(file)
      await run(() => registerDispatch(quote.id, 'PDF'), `PDF baixado: ${file.name}`)
    } catch {
      setToast('Não foi possível gerar o PDF. Tente de novo ou use Imprimir → "Salvar como PDF".')
    } finally {
      setPdfBusy(false)
    }
  }

  async function newVersion(reason: string) {
    setBusy(true)
    setDialogError(null)
    try {
      await createVersion(quote.id, reason)
      navigate(`/orcamentos/${quote.id}/editar`, { replace: false })
    } catch (e) {
      setBusy(false)
      setDialogError(e instanceof ApiError ? e.message : 'Não foi possível criar a nova versão.')
    }
  }

  return (
    <>
      <PageHero
        title={`Orçamento nº ${quote.number}`}
        back={{ to: '/orcamentos', label: 'Voltar para orçamentos' }}
        badge={<QuoteStatusBadge status={quote.status} />}
        subtitle={subtitleFor(quote)}
        actions={
          // Confirmado: os botões de envio ficam no painel. Enviado ou aprovado: ficam no topo para reenviar.
          canResend ? (
            <>
              <button type="button" className="cl-hero-btn" onClick={() => open('whatsapp')} data-testid="acao-whatsapp">
                <WhatsIcon />WhatsApp
              </button>
              <button type="button" className="cl-hero-btn" onClick={() => void downloadPdf()} disabled={pdfBusy} aria-busy={pdfBusy} data-testid="acao-pdf"><FileDown size={20} strokeWidth={1.8} aria-hidden="true" />{pdfBusy ? 'Gerando PDF…' : 'Baixar PDF'}</button>
              <button type="button" className="cl-hero-btn" onClick={openPrint} data-testid="acao-imprimir"><Printer size={20} strokeWidth={1.8} aria-hidden="true" />Imprimir</button>
            </>
          ) : quote.status === 'DRAFT' && isLatest ? (
            <Link to={`/orcamentos/${quote.id}/editar`} className="cl-cta">Continuar editando</Link>
          ) : undefined
        }
      />

      <main className="page-body oc-layout oc-layout--detail">
        <div className="oc-layout__main">
          {!isLatest && (
            <Alert variant="info">
              Você está vendo a versão {quote.version}, que foi substituída. <Link to={`/orcamentos/${quote.id}`}>Ver a versão atual (v{quote.latestVersion})</Link>
            </Alert>
          )}

          <section className="zv-card" aria-label="Situação do orçamento">
            {isLatest && <Stepper quote={quote} />}
            <StatusPanel
              quote={quote}
              isLatest={isLatest}
              onWhatsapp={() => open('whatsapp')}
              onPdf={() => void downloadPdf()}
              pdfBusy={pdfBusy}
              onPrint={openPrint}
              onApprove={() => open('approve')}
              onReject={() => open('reject')}
              onBackToDraft={() => open('draft')}
              onNewVersion={() => open('version')}
              onConvert={() => open('convert')}
            />
          </section>

          {quote.items.length > 0
            ? <ItemsCard items={quote.items.map(toItemView)} versionLabel={`${quote.version}ª proposta`} />
            : <section className="cl-card" aria-label="Itens"><p className="cl-muted">Nenhum item.</p></section>}

          <section className="cl-card" aria-labelledby="t-hist-orc">
            <h2 id="t-hist-orc" className="cl-card__title">Histórico</h2>
            <PagedList items={quote.events} noun="registros" render={(events) => (
            <ol className="oc-events">
              {events.map((ev) => (
                <li key={ev.id} className="oc-event">
                  <span className="oc-event__icon" aria-hidden="true">{eventIcon(ev)}</span>
                  <span className="oc-event__text">
                    <span className="oc-event__title">{eventText(ev)}</span>
                    <span className="cl-muted oc-small">por {ev.userName} · {ev.version}ª proposta</span>
                  </span>
                  <time className="cl-muted oc-small" dateTime={ev.createdAt}>{formatDateTime(ev.createdAt)}</time>
                </li>
              ))}
            </ol>
            )} />
          </section>
        </div>

        <aside className="oc-aside">
          <section className="zv-card" aria-labelledby="t-valores">
            <h2 id="t-valores" className="zv-h2">Valores</h2>
            <dl className="zv-sum zv-sum--big">
              {quote.discountCents > 0 && <div><dt>Subtotal</dt><dd>{formatMoney(quote.subtotalCents)}</dd></div>}
              {quote.discountCents > 0 && <div className="zv-sum__off"><dt>Desconto{discountLabel(quote.discountType, quote.discountValue) ? ` (${discountLabel(quote.discountType, quote.discountValue)})` : ''}</dt><dd>− {formatMoney(quote.discountCents)}</dd></div>}
              <div className="zv-sum__total" data-testid="total"><dt>Total</dt><dd>{formatMoney(quote.totalCents)}</dd></div>
            </dl>
            {(quote.paymentTerms || quote.notes) && <p className="zv-obs"><b>Observações:</b> {[quote.paymentTerms, quote.notes].filter(Boolean).join(' ')}</p>}
          </section>

          {quote.latestVersion > 1 && (
            <section className="cl-card oc-card-sm" aria-labelledby="t-versoes">
              <h2 id="t-versoes" className="cl-card__title">Versões</h2>
              <ul className="oc-versions">
                {Array.from({ length: quote.latestVersion }, (_, i) => quote.latestVersion - i).map((v) => (
                  <li key={v}>
                    {v === quote.version ? (
                      <span className="oc-versions__current" aria-current="page">v{v}{v === quote.latestVersion ? ' · atual' : ''}</span>
                    ) : (
                      <Link to={v === quote.latestVersion ? `/orcamentos/${quote.id}` : `/orcamentos/${quote.id}?versao=${v}`}>v{v}{v === quote.latestVersion ? ' · atual' : ''}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {isLatest && (quote.status === 'SENT' || quote.status === 'REJECTED') && (
            <section className="cl-card oc-card-sm" aria-labelledby="t-mudanca">
              <h2 id="t-mudanca" className="cl-card__title">O cliente pediu mudança?</h2>
              <p className="zv-obs">A proposta enviada fica guardada como está. A mudança vira a <b>{quote.version + 1}ª proposta</b>.</p>
              <Button className="btn--secondary" fullWidth onClick={() => open('version')} data-testid="nova-versao"><Copy size={20} strokeWidth={1.8} aria-hidden="true" />Mudar o orçamento</Button>
            </section>
          )}

          {isLatest && ['DRAFT', 'CONFIRMED', 'SENT'].includes(quote.status) && (
            <Button className="btn--danger-outline" fullWidth onClick={() => open('cancel')} data-testid="cancelar-orcamento"><Trash2 size={20} strokeWidth={1.8} aria-hidden="true" />Cancelar orçamento</Button>
          )}
        </aside>
      </main>

      <WhatsAppDialog
        open={dialog === 'whatsapp'}
        quote={quote}
        busy={busy}
        error={dialogError}
        onCancel={() => setDialog(null)}
        onSent={(toastMessage) => void run(() => registerDispatch(quote.id, 'WHATSAPP'), toastMessage)}
      />
      {dialog === 'approve' && <ApproveDialog open quote={quote} busy={busy} error={dialogError} onCancel={() => setDialog(null)}
        onConfirm={(method) => run(() => approveQuote(quote.id, method), 'Orçamento marcado como aprovado.')} />}
      {dialog === 'reject' && <RejectDialog open busy={busy} error={dialogError} onCancel={() => setDialog(null)}
        onConfirm={(reason, note) => run(() => rejectQuote(quote.id, reason, note), 'Orçamento marcado como recusado.')} />}
      {dialog === 'cancel' && <TextReasonDialog
        open busy={busy} error={dialogError} onCancel={() => setDialog(null)}
        title="Cancelar este orçamento?" label="Motivo do cancelamento" required confirmLabel="Cancelar orçamento" cancelLabel="Voltar" danger
        help="Orçamento cancelado não volta. Ele continua no histórico."
        onConfirm={(reason) => run(() => cancelQuote(quote.id, reason), 'Orçamento cancelado.')}
      />}
      {dialog === 'version' && <TextReasonDialog
        open busy={busy} error={dialogError} onCancel={() => setDialog(null)}
        title={`Criar a versão ${quote.version + 1}?`} label="O que mudou? (opcional)" confirmLabel="Criar nova versão"
        help={`A v${quote.version} continua guardada do jeito que foi enviada. A nova versão abre como rascunho e passa de novo por revisar e confirmar.`}
        placeholder="Ex.: Cliente pediu porta maior"
        onConfirm={(reason) => newVersion(reason)}
      />}
      <ConfirmDialog
        open={dialog === 'draft'} title="Voltar para rascunho?" confirmLabel="Voltar para rascunho" loading={busy} loadingText="Voltando…"
        onCancel={() => setDialog(null)}
        onConfirm={() => run(async () => { const r = await backToDraft(quote.id); navigate(`/orcamentos/${quote.id}/editar`); return r }, 'Orçamento voltou para rascunho.')}
      >
        <p>O orçamento ainda não foi enviado, então dá para corrigir na mesma versão. Depois é só revisar e confirmar de novo.</p>
        {dialogError && <Alert variant="error">{dialogError}</Alert>}
      </ConfirmDialog>

      {dialog === 'convert' && (
        <ConvertToOrderDialog quote={quote} onCancel={() => setDialog(null)}
          onDone={(order) => navigate(`/pedidos/${order.id}`, { state: { flash: `Pedido #${order.number} criado.` } })} />
      )}

      <Toast message={toast} onClose={clearToast} />
    </>
  )
}

function subtitleFor(q: Quote): string {
  const who = q.customer.name
  switch (q.status) {
    case 'DRAFT': return `${who} · em rascunho`
    case 'CONFIRMED': return `${who} · confirmado, pronto para enviar`
    case 'SENT': return `${who} · enviado em ${formatDateTime(q.sentAt ?? q.updatedAt)}`
    case 'APPROVED': return `${who} · aprovado em ${formatDateTime(q.decidedAt ?? q.updatedAt)}`
    case 'REJECTED': return `${who} · recusado em ${formatDateTime(q.decidedAt ?? q.updatedAt)}`
    case 'CANCELED': return `${who} · cancelado em ${formatDateTime(q.decidedAt ?? q.updatedAt)}`
    case 'SUPERSEDED': return `${who} · versão substituída`
  }
}

// ---------- Etapas ----------
function Stepper({ quote }: { quote: Quote }) {
  if (quote.status === 'CANCELED' || quote.status === 'SUPERSEDED') return null
  const order = ['DRAFT', 'CONFIRMED', 'SENT', 'ANSWER'] as const
  const current = quote.status === 'APPROVED' || quote.status === 'REJECTED' ? 4 : order.indexOf(quote.status as 'DRAFT' | 'CONFIRMED' | 'SENT')
  const labels = ['Rascunho', 'Confirmado', 'Enviado', quote.status === 'APPROVED' ? 'Aprovado' : quote.status === 'REJECTED' ? 'Recusado' : 'Resposta do cliente']
  return (
    <ol className="oc-stepper" aria-label="Etapas do orçamento">
      {labels.map((label, i) => {
        const state = i < current || current === 4 ? 'done' : i === current ? 'current' : 'todo'
        return (
          <li key={label} className={`oc-stepper__step is-${state}${i === 3 && quote.status === 'REJECTED' ? ' is-rejected' : ''}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="oc-stepper__bar" />
            <span className="oc-stepper__label">{state === 'done' ? '✓ ' : ''}{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

type PanelProps = {
  quote: Quote
  isLatest: boolean
  onWhatsapp: () => void
  onPdf: () => void
  pdfBusy: boolean
  onPrint: () => void
  onApprove: () => void
  onReject: () => void
  onBackToDraft: () => void
  onNewVersion: () => void
  onConvert: () => void
}

function StatusPanel({ quote, isLatest, onWhatsapp, onPdf, pdfBusy, onPrint, onApprove, onReject, onBackToDraft, onNewVersion, onConvert }: PanelProps) {
  if (!isLatest || quote.status === 'SUPERSEDED') {
    return <p className="cl-muted">Versão {quote.version} · {STATUS_LABEL[quote.status]}. Só para consulta.</p>
  }
  switch (quote.status) {
    case 'DRAFT':
      return (
        <div className="oc-panel">
          <div className="oc-panel__text"><h2 className="oc-panel__title">Em rascunho</h2><p>Termine os itens e revise para confirmar.</p></div>
          <Link to={`/orcamentos/${quote.id}/editar`} className="cl-cta">Continuar editando</Link>
        </div>
      )
    case 'CONFIRMED':
      return (
        <div className="oc-send">
          <p className="oc-send__lead">Conferido e pronto. Escolha como mandar para o cliente:</p>
          <Button onClick={onWhatsapp} data-testid="enviar-whatsapp"><WhatsIcon onAccent />Enviar pelo WhatsApp</Button>
          <div className="oc-send__row">
            <Button className="btn--secondary" onClick={onPdf} loading={pdfBusy} loadingText="Gerando PDF…">Baixar PDF</Button>
            <Button className="btn--secondary" onClick={onPrint}>Imprimir</Button>
          </div>
          <button type="button" className="oc-textlink" onClick={onBackToDraft}>Precisa corrigir? Voltar para rascunho</button>
        </div>
      )
    case 'SENT':
      return (
        <div className="oc-panel oc-panel--answer">
          <div className="oc-panel__text">
            <h2 className="oc-panel__title">O cliente respondeu?</h2>
            <p>Quando {quote.customer.name.split(' ')[0]} responder pelo WhatsApp ou pessoalmente, registre aqui.</p>
          </div>
          <div className="oc-panel__actions">
            <Button className="btn--secondary" onClick={onReject} data-testid="recusou"><X size={20} strokeWidth={1.8} aria-hidden="true" />Recusou</Button>
            <Button className="zv-approve" onClick={onApprove} data-testid="aprovou"><CircleCheck size={20} strokeWidth={1.8} aria-hidden="true" />Aprovou</Button>
          </div>
        </div>
      )
    case 'APPROVED':
      return (
        <div className="oc-banner oc-banner--ok">
          <div>
            <strong>Aprovado{quote.approvalMethod ? ` ${APPROVAL_LABEL[quote.approvalMethod].charAt(0).toLowerCase()}${APPROVAL_LABEL[quote.approvalMethod].slice(1)}` : ''}</strong>
            <span>Registrado em {formatDateTime(quote.decidedAt ?? quote.updatedAt)}. Aprovar não registra pagamento.</span>
          </div>
          {quote.order ? (
            <Link to={`/pedidos/${quote.order.id}`} className="btn btn--secondary oc-btn-link" data-testid="ver-pedido">Ver pedido #{quote.order.number}</Link>
          ) : (
            <Button onClick={onConvert} data-testid="transformar-em-pedido">Transformar em pedido</Button>
          )}
        </div>
      )
    case 'REJECTED':
      return (
        <div className="oc-banner oc-banner--bad">
          <div>
            <strong>Recusado{quote.rejectionReason ? `: ${REJECTION_LABEL[quote.rejectionReason]}` : ''}</strong>
            {quote.decisionNote && <span>{quote.decisionNote}</span>}
          </div>
          {quote.order
            ? <Link to={`/pedidos/${quote.order.id}`} className="btn btn--secondary oc-btn-link">Ver pedido cancelado #{quote.order.number}</Link>
            : <Button className="btn--secondary" onClick={onNewVersion}>Fazer nova proposta</Button>}
        </div>
      )
    case 'CANCELED':
      return (
        <div className="oc-banner">
          <div><strong>Orçamento cancelado</strong>{quote.decisionNote && <span>Motivo: {quote.decisionNote}</span>}</div>
        </div>
      )
  }
}

// ---------- Janelas ----------
function WhatsAppDialog({ open, quote, busy, error, onCancel, onSent }: {
  open: boolean; quote: Quote; busy: boolean; error: string | null; onCancel: () => void; onSent: (toast: string) => void
}) {
  // A janela é recriada a cada abertura (key), então o texto começa sempre do padrão
  return open ? <WhatsAppForm key={quote.updatedAt} quote={quote} busy={busy} error={error} onCancel={onCancel} onSent={onSent} /> : null
}

function defaultWhatsAppMessage(quote: Quote): string {
  const firstName = quote.customer.name.split(' ')[0]
  return `Olá, ${firstName}! Aqui está o seu orçamento nº ${quote.number} da ZBOX.\nCaso tenha alguma dúvida, estamos à disposição.`
}

// Como o PDF chega no WhatsApp:
// - Celular/tablet: abre o "Compartilhar" do aparelho com o PDF + a mensagem. A pessoa escolhe WhatsApp e a conversa.
// - Computador com Chrome/Edge: o botão principal "Enviar com o PDF" abre o Compartilhar do sistema, e a pessoa
//   escolhe o APLICATIVO do WhatsApp (PDF + mensagem juntos). O site não sabe se o app está instalado,
//   por isso "Usar WhatsApp Web" fica como alternativa logo abaixo.
// - WhatsApp Web (ou navegador sem Compartilhar, ex.: Firefox): o link wa.me só aceita TEXTO. Abrimos a conversa com a mensagem e baixamos o PDF
//   para a pessoa anexar (clipe ou arrastar). Não existe jeito de anexar sozinho sem a API paga do WhatsApp Business,
//   que enviaria sem a pessoa revisar (contra a regra do produto).
function WhatsAppForm({ quote, busy, error, onCancel, onSent }: {
  quote: Quote; busy: boolean; error: string | null; onCancel: () => void; onSent: (toast: string) => void
}) {
  const firstName = quote.customer.name.split(' ')[0]
  // Número já preenchido com o WhatsApp ATUAL do cadastro do cliente
  const { phone, setPhone, registered } = useCustomerWhatsapp(quote.customer.id, customerMobile(quote.customer))
  const [message, setMessage] = useState(defaultWhatsAppMessage(quote))
  const [shareError, setShareError] = useState<string | null>(null)

  // O PDF começa a ser gerado assim que a janela abre: no clique ele já está pronto
  // (o navegador só deixa abrir o WhatsApp/compartilhar se for logo no clique)
  const pdfFetcher = useCallback(() => generateQuotePdf(quote), [quote])
  const pdf = useRequest(`pdf|${quote.id}|${quote.version}|${quote.updatedAt}`, pdfFetcher)
  const file = pdf.data
  const share = file ? canSharePdf(file) : false

  const digits = onlyDigits(phone)
  const phoneInvalid = digits.length !== 10 && digits.length !== 11

  // Computador com Chrome/Edge: o "Compartilhar" do sistema manda o PDF para o APLICATIVO do WhatsApp.
  // O site não consegue saber se o aplicativo está instalado, então o WhatsApp Web fica como alternativa.
  const desktopShare = !share && file ? canShareFiles(file) : false
  const primaryShare = share || desktopShare

  async function shareFile() {
    if (!file) return
    // No Windows, o app do WhatsApp às vezes recebe o PDF mas ignora o texto: deixamos a mensagem copiada
    // Sem esperar: o navegador só libera o Compartilhar logo depois do clique
    void navigator.clipboard?.writeText(message).catch(() => {})
    try {
      await navigator.share({ files: [file], text: message })
      onSent('Pronto! Confira no WhatsApp se a mensagem e o PDF foram juntos. Se a mensagem não aparecer, cole com Ctrl+V: ela está copiada.')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // a pessoa fechou o Compartilhar
      // O computador não conseguiu compartilhar: abre a conversa e baixa o PDF para anexar
      if (!phoneInvalid) openWeb()
      else setShareError('Não foi possível abrir o Compartilhar. Digite o WhatsApp para abrir a conversa e anexar o PDF.')
    }
  }

  async function send() {
    setShareError(null)
    if (primaryShare && file) {
      await shareFile()
      return
    }
    openWeb()
  }

  // WhatsApp Web: o link wa.me só aceita texto, então o PDF é baixado para anexar
  function openWeb() {
    setShareError(null)
    window.open(`https://wa.me/55${digits}?text=${encodeURIComponent(message)}`, '_blank', 'noopener')
    if (file) {
      downloadFile(file)
      onSent('WhatsApp aberto e PDF baixado. Anexe o PDF na conversa (clipe ou arraste o arquivo) e envie.')
    } else {
      onSent('WhatsApp aberto, sem o PDF. Use "Baixar PDF" e anexe na conversa.')
    }
  }

  const confirmLabel = pdf.loading ? 'Preparando PDF…' : share ? 'Compartilhar no WhatsApp' : desktopShare ? 'Enviar com o PDF' : 'Abrir WhatsApp Web'

  return (
    <ConfirmDialog open title={`Enviar para ${firstName}`} confirmLabel={confirmLabel} loading={busy}
      confirmDisabled={pdf.loading || message.trim() === '' || (!primaryShare && phoneInvalid)}
      onCancel={onCancel} onConfirm={() => void send()}>
      <div className="oc-dialog-fields">
        {!share && (
          <>
            <NoAutofill><label className="cl-field">
              <span className="cl-field__label">WhatsApp</span>
              <input autoComplete="off" className="cl-input" type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" aria-invalid={phone && phoneInvalid ? true : undefined} />
            </label></NoAutofill>
            {!registered && <p className="oc-small cl-muted">O cliente não tem celular cadastrado. Digite o número para este envio.</p>}
          </>
        )}
        <label className="cl-field">
          <span className="cl-field__label">Mensagem (pode editar)</span>
          <textarea autoComplete="off" className="cl-input cl-textarea" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>

        <div className={`oc-attach${pdf.error ? ' oc-attach--bad' : ''}`} role="status" data-testid="anexo-pdf">
          <AppIcon name="pdfFile" size={24} />
          <span>
            {pdf.loading && 'Preparando o PDF do orçamento…'}
            {file && <><strong>{file.name}</strong> · {Math.max(1, Math.round(file.size / 1024))} KB</>}
            {Boolean(pdf.error) && 'Não deu para gerar o PDF. O WhatsApp abre só com a mensagem.'}
          </span>
        </div>

        <p className="oc-note">
          {share
            ? <>Vai abrir o <strong>Compartilhar</strong> do aparelho. Escolha <strong>WhatsApp</strong> e a conversa de {firstName}. A mensagem e o PDF vão juntos; <strong>você confere e aperta enviar</strong>.</>
            : desktopShare
              ? <><strong>Enviar com o PDF</strong> abre o Compartilhar do computador. Escolha o <strong>aplicativo do WhatsApp</strong> e a conversa de {firstName}: o PDF e a mensagem vão juntos, <strong>você confere e aperta enviar</strong>.</>
              : <><strong>Abrir WhatsApp Web</strong> abre a conversa com a mensagem pronta e <strong>baixa</strong> o PDF. O link do WhatsApp não aceita arquivo, então anexe o PDF lá (clipe ou arraste) e <strong>aperte enviar</strong>. O ZBOX não envia sozinho.</>}
        </p>

        {desktopShare && (
          <div className="oc-share-app">
            <div>
              <strong>Não tem o aplicativo do WhatsApp neste computador?</strong>
              <span>Use o WhatsApp Web: abre a conversa com a mensagem e baixa o PDF para você anexar.</span>
            </div>
            <Button className="btn--secondary" onClick={openWeb} disabled={busy || phoneInvalid} data-testid="abrir-whatsapp-web">
              Usar WhatsApp Web
            </Button>
          </div>
        )}
        {(shareError ?? error) && <Alert variant="error">{shareError ?? error}</Alert>}
      </div>
    </ConfirmDialog>
  )
}

function ApproveDialog({ open, quote, busy, error, onCancel, onConfirm }: {
  open: boolean; quote: Quote; busy: boolean; error: string | null; onCancel: () => void; onConfirm: (m: ApprovalMethod) => void
}) {
  const [method, setMethod] = useState<ApprovalMethod>('WHATSAPP')
  return (
    <ConfirmDialog open={open} title="Marcar como aprovado?" confirmLabel="Marcar como aprovado" loading={busy} loadingText="Salvando…" onCancel={onCancel} onConfirm={() => onConfirm(method)}>
      <p>Orçamento #{quote.number} v{quote.version} · <strong>{formatMoney(quote.totalCents)}</strong></p>
      <fieldset className="oc-radios">
        <legend className="cl-field__label">Como o cliente aprovou?</legend>
        {(Object.keys(APPROVAL_LABEL) as ApprovalMethod[]).map((m) => (
          <label key={m} className="oc-radio">
            <input autoComplete="off" type="radio" name="approval" checked={method === m} onChange={() => setMethod(m)} />
            {APPROVAL_LABEL[m]}
          </label>
        ))}
      </fieldset>
      <p className="oc-small cl-muted">Aprovar não registra pagamento. O dinheiro entra quando o pagamento for registrado no pedido.</p>
      {error && <Alert variant="error">{error}</Alert>}
    </ConfirmDialog>
  )
}

function RejectDialog({ open, busy, error, onCancel, onConfirm }: {
  open: boolean; busy: boolean; error: string | null; onCancel: () => void; onConfirm: (r: RejectionReason, note: string | null) => void
}) {
  const [reason, setReason] = useState<RejectionReason | null>(null)
  const [note, setNote] = useState('')
  return (
    <ConfirmDialog open={open} title="Por que o cliente recusou?" confirmLabel="Marcar como recusado" variant="danger" loading={busy} loadingText="Salvando…"
      confirmDisabled={!reason} onCancel={onCancel} onConfirm={() => reason && onConfirm(reason, note || null)}>
      <div className="oc-pills" role="radiogroup" aria-label="Motivo da recusa">
        {(Object.keys(REJECTION_LABEL) as RejectionReason[]).map((r) => (
          <label key={r} className="oc-pill oc-pill--radio">
            <input autoComplete="off" type="radio" name="reject-reason" checked={reason === r} onChange={() => setReason(r)} />
            {REJECTION_LABEL[r]}
          </label>
        ))}
      </div>
      {!reason && <p className="oc-small cl-muted">Escolha o motivo da recusa.</p>}
      <label className="cl-field oc-dialog-gap">
        <span className="cl-field__label">Detalhe (opcional)</span>
        <textarea autoComplete="off" className="cl-input cl-textarea" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: Achou caro, pediu para pensar." />
      </label>
      <p className="oc-small cl-muted">Se o cliente quiser outra proposta, crie uma nova versão depois.</p>
      {error && <Alert variant="error">{error}</Alert>}
    </ConfirmDialog>
  )
}

function TextReasonDialog({ open, busy, error, onCancel, onConfirm, title, label, help, confirmLabel, cancelLabel, required = false, danger = false, placeholder }: {
  open: boolean; busy: boolean; error: string | null; onCancel: () => void; onConfirm: (text: string) => void
  title: string; label: string; help: string; confirmLabel: string; cancelLabel?: string; required?: boolean; danger?: boolean; placeholder?: string
}) {
  const [text, setText] = useState('')
  return (
    <ConfirmDialog open={open} title={title} confirmLabel={confirmLabel} cancelLabel={cancelLabel} variant={danger ? 'danger' : 'primary'} loading={busy} loadingText="Salvando…"
      confirmDisabled={required && text.trim().length < 3} onCancel={onCancel} onConfirm={() => onConfirm(text)}>
      <p>{help}</p>
      <label className="cl-field oc-dialog-gap">
        <span className="cl-field__label">{label}</span>
        <textarea autoComplete="off" className="cl-input cl-textarea" rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
      </label>
      {error && <Alert variant="error">{error}</Alert>}
    </ConfirmDialog>
  )
}

// ---------- Histórico ----------
function eventText(ev: QuoteEvent): string {
  switch (ev.type) {
    case 'CREATED': return 'Orçamento criado'
    case 'UPDATED': return 'Rascunho salvo'
    case 'CONFIRMED': return `Orçamento confirmado${ev.detail ? ` · ${ev.detail}` : ''}`
    case 'BACK_TO_DRAFT': return 'Voltou para rascunho'
    case 'DISPATCHED': return ev.detail === 'WHATSAPP' ? 'WhatsApp aberto para envio' : ev.detail === 'PDF' ? 'PDF gerado' : 'Impresso'
    case 'APPROVED': return `Aprovado${ev.detail ? ` · ${APPROVAL_LABEL[ev.detail as ApprovalMethod] ?? ev.detail}` : ''}`
    case 'REJECTED': {
      const [code, ...rest] = (ev.detail ?? '').split(': ')
      const label = REJECTION_LABEL[code as RejectionReason]
      return `Recusado${label ? ` · ${label}` : ''}${rest.length ? `: ${rest.join(': ')}` : ''}`
    }
    case 'CANCELED': return `Cancelado${ev.detail ? ` · ${ev.detail}` : ''}`
    case 'NEW_VERSION': return ev.detail?.startsWith('v') ? `Substituído pela ${ev.detail}` : `Nova versão criada${ev.detail ? ` · ${ev.detail}` : ''}`
    case 'CONVERTED': return `Virou o pedido #${ev.detail ?? ''}`
  }
}

function eventIcon(ev: QuoteEvent) {
  if (ev.type === 'DISPATCHED' && ev.detail === 'WHATSAPP') return <WhatsIcon />
  const icons: Record<QuoteEvent['type'], AppIconName> = {
    CREATED: 'plus', UPDATED: 'edit', CONFIRMED: 'check', APPROVED: 'check', REJECTED: 'close', CANCELED: 'cancel',
    BACK_TO_DRAFT: 'arrowLeft', NEW_VERSION: 'quote', DISPATCHED: 'quote', CONVERTED: 'order',
  }
  return <AppIcon name={icons[ev.type] ?? 'quote'} size={24} />
}

function WhatsIcon({ onAccent = false }: { onAccent?: boolean }) {
  return <AppIcon name="chat" size={24} onAccent={onAccent} />
}
