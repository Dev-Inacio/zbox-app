import { useCallback, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Toast } from '../../components/ui/Toast'
import { useFlashMessage } from '../../hooks/useFlashMessage'
import { useRequest } from '../../hooks/useRequest'
import { ApiError } from '../auth/types'
import { useAuth } from '../auth/useAuth'
import { StatusBadge } from './CustomerBadges'
import { CardSkeleton, CustomerLoadError } from './CustomerLoadStates'
import { activateCustomer, deactivateCustomer, getCustomer, getCustomerHistory } from './customersApi'
import { formatDate, formatDateTime, maskCep, maskPhone, typeLabel, whatsappLink } from './format'
import { canChangeCustomerStatus } from './permissions'
import { listQuotes } from '../orcamentos/quotesApi'
import { QuoteTable } from '../orcamentos/QuotesListPage'
import type { QuoteSummary } from '../orcamentos/types'
import type { Page } from './types'
import type { Customer, CustomerHistoryItem } from './types'
import '../../components/ui/ButtonVariants.css'
import './Clientes.css'

// HU11 — Ver detalhe do cliente. Também é onde se desativa/reativa (HU10).

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
  const fetchQuotes = useCallback(() => listQuotes({ search: '', status: 'ALL', period: 'ALL', customerId: id, page: 0, size: 5 }), [id])
  const quotes = useRequest(`orcamentos-${id}`, fetchQuotes)

  const canChangeStatus = canChangeCustomerStatus(user?.role)

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
        // Alguém mudou antes de nós: recarrega para mostrar a situação real
        setDialog(null)
        setAttempt((n) => n + 1)
        setHistoryAttempt((n) => n + 1)
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

  return (
    <>
      <PageHero
        title={c.name}
        back={{ to: '/clientes', label: 'Voltar para clientes' }}
        badge={<StatusBadge status={c.status} />}
        subtitle={`${typeLabel(c.type)} · Cliente desde ${formatDate(c.createdAt)}`}
        actions={
          <>
            {c.whatsapp && (
              <a className="cl-hero-btn" href={whatsappLink(c.whatsapp)} target="_blank" rel="noopener noreferrer" data-testid="abrir-whatsapp">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z" />
                </svg>
                WhatsApp
                <span className="sr-only">(abre em nova aba)</span>
              </a>
            )}
            <Link className="cl-hero-btn" to={`/clientes/${c.id}/editar`} data-testid="editar-cliente">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
              Editar
            </Link>
            {inactive ? (
              <button type="button" className="cl-cta" disabled title="Cliente desativado não recebe orçamento">Novo orçamento</button>
            ) : (
              <Link to={`/orcamentos/novo?cliente=${c.id}`} className="cl-cta" data-testid="cliente-novo-orcamento">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                Novo orçamento
              </Link>
            )}
          </>
        }
      />

      <main className="page-body cl-detail">
        {inactive && (
          <div className="cl-inactive-banner" role="status">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M6 18L18 6" />
            </svg>
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
            <section className="cl-card cl-card--elevated" aria-labelledby="titulo-resumo">
              <div className="cl-card__header">
                <h2 id="titulo-resumo" className="cl-card__title">Resumo</h2>
                <span className="cl-card__badge">Pedidos na Fase 4</span>
              </div>
              <ul className="cl-summary">
                <li><span className="cl-summary__label">Orçamentos</span><span className="cl-summary__value">{quotes.data ? quotes.data.totalElements : '–'}</span></li>
                <li><span className="cl-summary__label">Pedidos</span><span className="cl-summary__value">0</span></li>
                <li><span className="cl-summary__label">A receber</span><span className="cl-summary__value">R$ 0</span></li>
              </ul>
            </section>

            <MovementTabs quotes={quotes} newQuoteHref={inactive ? null : `/orcamentos/novo?cliente=${c.id}`} />

            <section className="cl-card" aria-labelledby="titulo-historico">
              <div className="cl-card__header">
                <h2 id="titulo-historico" className="cl-card__title">Histórico</h2>
              </div>
              <HistoryList state={history} onRetry={() => setHistoryAttempt((n) => n + 1)} />
            </section>
          </div>

          <aside className="cl-detail__side">
            <section className="cl-card cl-card--elevated" aria-labelledby="titulo-contato">
              <h2 id="titulo-contato" className="cl-card__title">Contato</h2>
              <dl className="cl-dl">
                <div>
                  <dt>WhatsApp</dt>
                  <dd>{c.whatsapp ? maskPhone(c.whatsapp) : <span className="cl-muted">Não informado</span>}</dd>
                </div>
                <div>
                  <dt>Telefone</dt>
                  <dd>{c.phone ? <a href={`tel:+55${c.phone}`}>{maskPhone(c.phone)}</a> : <span className="cl-muted">Não informado</span>}</dd>
                </div>
              </dl>
            </section>

            <section className="cl-card" aria-labelledby="titulo-endereco">
              <h2 id="titulo-endereco" className="cl-card__title">Endereço</h2>
              <AddressBlock customer={c} />
            </section>

            <section className="cl-card" aria-labelledby="titulo-obs">
              <h2 id="titulo-obs" className="cl-card__title">Observações</h2>
              {c.notes ? <p className="cl-notes">{c.notes}</p> : <p className="cl-muted">Nenhuma observação.</p>}
            </section>

            {canChangeStatus && !inactive && (
              <Button className="btn--danger-outline" fullWidth onClick={() => openDialog('deactivate')} data-testid="desativar-cliente">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M6 18L18 6" />
                </svg>
                Desativar cliente
              </Button>
            )}
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

function AddressBlock({ customer }: { customer: Customer }) {
  const a = customer.address
  const line1 = [a.street, a.number].filter(Boolean).join(', ')
  const line2 = [a.complement, a.district].filter(Boolean).join(' · ')
  const cityUf = [a.city, a.state].filter(Boolean).join('/')
  const line3 = [cityUf, a.zipCode ? maskCep(a.zipCode) : null].filter(Boolean).join(' · ')

  if (!line1 && !line2 && !line3) return <p className="cl-muted">Endereço não informado.</p>

  return (
    <address className="cl-address">
      {line1 && <span>{line1}</span>}
      {line2 && <span>{line2}</span>}
      {line3 && <span>{line3}</span>}
    </address>
  )
}

// ---------- Abas: Orçamentos / Pedidos / Pagamentos ----------
// Orçamentos já funciona (Fase 3). Pedidos e Pagamentos ficam vazios até as Fases 4 e 5. As setas ← → trocam de aba (padrão de acessibilidade de tabs).

const TABS = [
  { id: 'orcamentos', label: 'Orçamentos', empty: 'Nenhum orçamento para este cliente.', phase: '' },
  { id: 'pedidos', label: 'Pedidos', empty: 'Nenhum pedido para este cliente.', phase: 'Fase 4' },
  { id: 'pagamentos', label: 'Pagamentos', empty: 'Nenhum pagamento para este cliente.', phase: 'Fase 5' },
]

type QuotesState = { loading: boolean; data?: Page<QuoteSummary>; error?: unknown }

function MovementTabs({ quotes, newQuoteHref }: { quotes: QuotesState; newQuoteHref: string | null }) {
  const [active, setActive] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 }
    if (event.key in moves) {
      event.preventDefault()
      const next = (active + moves[event.key] + TABS.length) % TABS.length
      setActive(next)
      tabRefs.current[next]?.focus()
    }
  }

  const tab = TABS[active]

  return (
    <section className="cl-card" aria-labelledby="titulo-movimentacao">
      <div className="cl-card__header">
        <h2 id="titulo-movimentacao" className="cl-card__title">Orçamentos, pedidos e pagamentos</h2>
      </div>
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
            onClick={() => setActive(i)}
            onKeyDown={handleKeyDown}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab.id === 'orcamentos' && quotes.data && quotes.data.content.length > 0 ? (
        <div role="tabpanel" id={`painel-${tab.id}`} aria-labelledby={`aba-${tab.id}`}>
          <QuoteTable items={quotes.data.content} showCustomer={false} />
          {quotes.data.totalElements > quotes.data.content.length && (
            <p className="cl-muted">Mostrando os {quotes.data.content.length} mais recentes de {quotes.data.totalElements}.</p>
          )}
        </div>
      ) : (
        <div className="cl-state cl-state--compact" role="tabpanel" id={`painel-${tab.id}`} aria-labelledby={`aba-${tab.id}`}>
          <span className="cl-state__icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <path d="M14 3v6h6" />
            </svg>
          </span>
          {tab.id === 'orcamentos' && quotes.loading ? (
            <p className="cl-state__text" role="status">Carregando orçamentos…</p>
          ) : (
            <>
              <p className="cl-state__title">{tab.empty}</p>
              {tab.phase ? (
                <p className="cl-state__text">Aparece aqui quando a {tab.phase} estiver pronta.</p>
              ) : newQuoteHref ? (
                <Link to={newQuoteHref} className="cl-cta">Criar orçamento</Link>
              ) : null}
            </>
          )}
        </div>
      )}
    </section>
  )
}

// ---------- Histórico (vem do AuditLog) ----------
const FIELD_LABELS: Record<string, string> = {
  name: 'nome', type: 'tipo', phone: 'telefone', whatsapp: 'WhatsApp', address: 'endereço', notes: 'observações',
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
      const fields = item.changedFields.map((f) => FIELD_LABELS[f] ?? f)
      if (fields.length === 0) return 'Dados alterados'
      const text = fields.join(', ')
      return `Alterado: ${text}`
    }
  }
}

type HistoryState = { loading: boolean; data?: CustomerHistoryItem[]; error?: unknown }

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
    <ol className="cl-history">
      {state.data.map((item, i) => (
        <li key={item.id} className="cl-history__item">
          <span className={`cl-history__dot${i === 0 ? ' cl-history__dot--latest' : ''}`} aria-hidden="true" />
          <span className="cl-history__text">
            <span className="cl-history__title">{describe(item)}</span>
            <span className="cl-history__by">por {item.userName}</span>
          </span>
          <time className="cl-history__when" dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
        </li>
      ))}
    </ol>
  )
}
