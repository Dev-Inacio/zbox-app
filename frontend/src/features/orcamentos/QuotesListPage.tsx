import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/ui/Pagination'
import { useRequest } from '../../hooks/useRequest'
import { formatDate } from '../clientes/format'
import { STATUS_LABEL } from './labels'
import { formatMoney } from './money'
import { countQuotes, listQuotes } from './quotesApi'
import { QuoteStatusBadge } from './QuoteStatusBadge'
import type { QuotePeriod, QuoteStatusFilter, QuoteSummary } from './types'
import '../../components/ui/ButtonVariants.css'
import '../clientes/Clientes.css' // estilos de cartão/lista/estados compartilhados
import './Orcamentos.css'

// HU13 — Listar orçamentos. Filtros na URL: ?status=SENT&busca=123&periodo=LAST_30&pagina=2

const PAGE_SIZE = 20
const MIN_SEARCH = 2
const STATUS_TABS: QuoteStatusFilter[] = ['ALL', 'DRAFT', 'CONFIRMED', 'SENT', 'APPROVED', 'REJECTED', 'CANCELED']
const PERIODS: { value: QuotePeriod; label: string }[] = [
  { value: 'ALL', label: 'Todo o período' },
  { value: 'LAST_30', label: 'Últimos 30 dias' },
  { value: 'LAST_90', label: 'Últimos 90 dias' },
]

function readStatus(v: string | null): QuoteStatusFilter {
  return STATUS_TABS.includes(v as QuoteStatusFilter) ? (v as QuoteStatusFilter) : 'ALL'
}
function readPeriod(v: string | null): QuotePeriod {
  return v === 'LAST_30' || v === 'LAST_90' ? v : 'ALL'
}

export function QuotesListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('busca') ?? ''
  const status = readStatus(searchParams.get('status'))
  const period = readPeriod(searchParams.get('periodo'))
  const page = Math.max(0, Number(searchParams.get('pagina') ?? '1') - 1) || 0
  const [term, setTerm] = useState(search)
  const [attempt, setAttempt] = useState(0)

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(changes)) {
          if (v === null || v === '') next.delete(k)
          else next.set(k, v)
        }
        return next
      })
    },
    [setSearchParams],
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      const value = term.trim()
      const effective = value.length >= MIN_SEARCH ? value : ''
      if (effective !== search) updateParams({ busca: effective, pagina: null })
    }, 300)
    return () => clearTimeout(timer)
  }, [term, search, updateParams])

  const key = `${search}|${status}|${period}|${page}|${attempt}`
  const fetchList = useCallback(() => listQuotes({ search, status, period, page, size: PAGE_SIZE }), [search, status, period, page])
  const { loading, data, error } = useRequest(key, fetchList)
  const counts = useRequest(`counts#${attempt}`, countQuotes)

  const hasFilters = search !== '' || status !== 'ALL' || period !== 'ALL'
  const sent = counts.data?.SENT ?? 0

  return (
    <>
      <PageHero
        eyebrow="Comercial"
        title="Orçamentos"
        subtitle={counts.data ? (sent === 1 ? '1 enviado aguardando resposta do cliente' : `${sent} enviados aguardando resposta do cliente`) : ' '}
        actions={
          <Link to="/orcamentos/novo" className="cl-cta" data-testid="novo-orcamento">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
            Novo orçamento
          </Link>
        }
      />

      <main className="page-body">
        <section className="cl-card cl-card--elevated" aria-labelledby="titulo-orcamentos">
          <div className="cl-card__header">
            <h2 id="titulo-orcamentos" className="cl-card__title">Todos os orçamentos</h2>
            <span className="cl-card__badge">Dados de exemplo</span>
          </div>

          {/* Filtro por status com contadores: são links-botão de filtro (aria-pressed) */}
          <div className="oc-chips" role="group" aria-label="Filtrar por status">
            {STATUS_TABS.map((s) => (
              <button
                key={s}
                type="button"
                className="oc-chip"
                aria-pressed={status === s}
                onClick={() => updateParams({ status: s === 'ALL' ? null : s, pagina: null })}
              >
                {s === 'ALL' ? 'Todos' : STATUS_LABEL[s]}
                <span className="oc-chip__count">{counts.data ? counts.data[s] : '–'}</span>
              </button>
            ))}
          </div>

          <div role="search" className="oc-filters">
            <div className="cl-field">
              <label htmlFor="busca-orcamentos" className="cl-field__label">Buscar</label>
              <div className="cl-search">
                <svg className="cl-search__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                <input
                  id="busca-orcamentos"
                  type="search"
                  className="cl-input cl-search__input"
                  placeholder="Número ou nome do cliente"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  autoComplete="off"
                  aria-describedby="busca-orc-dica"
                />
              </div>
              <p id="busca-orc-dica" className="cl-field__hint" aria-live="polite">
                {term.trim().length === 1 ? 'Digite pelo menos 2 caracteres para buscar.' : ''}
              </p>
            </div>
            <div className="cl-field">
              <label htmlFor="periodo-orcamentos" className="cl-field__label">Período</label>
              <select autoComplete="off" id="periodo-orcamentos" className="cl-input" value={period} onChange={(e) => updateParams({ periodo: e.target.value === 'ALL' ? null : e.target.value, pagina: null })}>
                {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {loading && (
            <div className="cl-skeleton" role="status" aria-label="Carregando orçamentos">
              {Array.from({ length: 5 }, (_, i) => <div key={i} className="cl-skeleton__row"><span style={{ width: `${50 + i * 7}%` }} /><span style={{ width: '30%' }} /></div>)}
            </div>
          )}

          {!loading && Boolean(error) && (
            <div className="cl-state" role="alert">
              <span className="cl-state__icon cl-state__icon--error" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 16.5v.5" /></svg>
              </span>
              <p className="cl-state__title">Não foi possível carregar os orçamentos.</p>
              <p className="cl-state__text">Verifique sua conexão e tente de novo.</p>
              <Button className="btn--secondary" onClick={() => setAttempt((n) => n + 1)}>Tentar novamente</Button>
            </div>
          )}

          {data && data.totalElements === 0 && (
            <div className="cl-state">
              <span className="cl-state__icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>
              </span>
              {hasFilters ? (
                <>
                  <p className="cl-state__title">Nenhum orçamento encontrado.</p>
                  <p className="cl-state__text">Tente outro termo ou limpe os filtros.</p>
                  <Button className="btn--secondary" onClick={() => { setTerm(''); setSearchParams(new URLSearchParams()) }}>Limpar filtros</Button>
                </>
              ) : (
                <>
                  <p className="cl-state__title">Nenhum orçamento ainda.</p>
                  <p className="cl-state__text">Crie o primeiro para enviar ao cliente.</p>
                  <Link to="/orcamentos/novo" className="cl-cta">Criar orçamento</Link>
                </>
              )}
            </div>
          )}

          {data && data.totalElements > 0 && data.content.length === 0 && (
            <div className="cl-state">
              <p className="cl-state__title">Esta página não tem orçamentos.</p>
              <Button className="btn--secondary" onClick={() => updateParams({ pagina: null })}>Ir para a primeira página</Button>
            </div>
          )}

          {data && data.content.length > 0 && (
            <>
              <QuoteTable items={data.content} />
              <Pagination
                page={data.page} totalPages={data.totalPages} size={data.size} total={data.totalElements} shown={data.content.length}
                onChange={(p) => { updateParams({ pagina: p === 0 ? null : String(p + 1) }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              />
            </>
          )}
        </section>
      </main>
    </>
  )
}

export function QuoteTable({ items, showCustomer = true }: { items: QuoteSummary[]; showCustomer?: boolean }) {
  return (
    <table className="cl-table oc-table" data-testid="tabela-orcamentos">
      <thead>
        <tr>
          <th scope="col">Número</th>
          {showCustomer && <th scope="col">Cliente</th>}
          <th scope="col">Criado em</th>
          <th scope="col" className="oc-num">Valor</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {items.map((q) => (
          <tr key={q.id}>
            <td className="cl-table__name">
              <Link to={`/orcamentos/${q.id}`}>#{q.number}</Link> <span className="oc-version">v{q.version}</span>
            </td>
            {showCustomer && <td className="oc-table__customer">{q.customerName}</td>}
            <td className="oc-table__date">{formatDate(q.createdAt)}</td>
            <td className="oc-num oc-table__total">{formatMoney(q.totalCents)}</td>
            <td className="oc-table__status"><QuoteStatusBadge status={q.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
