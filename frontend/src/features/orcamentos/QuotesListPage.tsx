import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Button } from '../../components/ui/Button'
import { Pagination } from '../../components/ui/Pagination'
import { useRequest } from '../../hooks/useRequest'
import { formatDate } from '../clientes/format'
import { formatMoney } from './money'
import { countQuotes, listQuotes } from './quotesApi'
import { QuoteStatusBadge } from './QuoteStatusBadge'
import { ListFilters, SegFilter } from '../../components/zbox'
import type { QuoteStatusFilter, QuoteSummary } from './types'
import { AppIcon } from '../../components/ui/AppIcon'
import '../../components/ui/ButtonVariants.css'
import '../clientes/Clientes.css' // estilos de cartão/lista/estados compartilhados
import './Orcamentos.css'

// HU13 — Listar orçamentos. Filtros na URL: ?status=SENT&busca=123&periodo=LAST_30&pagina=2

const PAGE_SIZE = 10
const MIN_SEARCH = 2
const STATUS_TABS: QuoteStatusFilter[] = ['ALL', 'DRAFT', 'CONFIRMED', 'SENT', 'APPROVED', 'REJECTED', 'CANCELED']
const SEG: { value: QuoteStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' }, { value: 'DRAFT', label: 'Rascunho' }, { value: 'SENT', label: 'Enviados' },
  { value: 'APPROVED', label: 'Aprovados' }, { value: 'REJECTED', label: 'Recusados' },
]

function readStatus(v: string | null): QuoteStatusFilter {
  return STATUS_TABS.includes(v as QuoteStatusFilter) ? (v as QuoteStatusFilter) : 'ALL'
}
export function QuotesListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('busca') ?? ''
  const status = readStatus(searchParams.get('status'))
  const period = 'ALL' as const
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

  const hasFilters = search !== '' || status !== 'ALL'
  const sent = counts.data?.SENT ?? 0

  return (
    <>
      <PageHero
        eyebrow="Comercial"
        title="Orçamentos"
        subtitle={counts.data ? `${sent} esperando resposta do cliente` : ' '}
        actions={
          <Link to="/orcamentos/novo" className="zv-btn zv-btn--primary zv-btn--top zv-m-full" data-testid="novo-orcamento">
            <Plus size={20} strokeWidth={1.8} aria-hidden="true" />
            Novo orçamento
          </Link>
        }
      />

      <main className="page-body">
        <section className="zv-card" aria-label="Lista de orçamentos">
          <ListFilters value={term} onChange={setTerm} placeholder="Buscar por número ou cliente"
            hint={term.trim().length === 1 ? 'Digite pelo menos 2 caracteres para buscar.' : undefined}>
            <SegFilter label="Situação" options={SEG} value={status} onChange={(v) => updateParams({ status: v === 'ALL' ? null : v, pagina: null })} />
          </ListFilters>

          {loading && (
            <div className="cl-skeleton" role="status" aria-label="Carregando orçamentos">
              {Array.from({ length: 5 }, (_, i) => <div key={i} className="cl-skeleton__row"><span style={{ width: `${50 + i * 7}%` }} /><span style={{ width: '30%' }} /></div>)}
            </div>
          )}

          {!loading && Boolean(error) && (
            <div className="cl-state" role="alert">
              <span className="cl-state__icon cl-state__icon--error" aria-hidden="true">
                <AppIcon name="alert" size={26} />
              </span>
              <p className="cl-state__title">Não foi possível carregar os orçamentos.</p>
              <p className="cl-state__text">Verifique sua conexão e tente de novo.</p>
              <Button className="btn--secondary" onClick={() => setAttempt((n) => n + 1)}>Tentar novamente</Button>
            </div>
          )}

          {data && data.totalElements === 0 && (
            <div className="cl-state">
              <span className="cl-state__icon" aria-hidden="true">
                <AppIcon name="quote" size={26} />
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

function QuoteTable({ items }: { items: QuoteSummary[] }) {
  return (
    <div className="zv-table-wrap">
      <table className="zv-table" data-testid="tabela-orcamentos">
        <thead>
          <tr>
            <th scope="col">Orçamento</th>
            <th scope="col">Cliente</th>
            <th scope="col">Situação</th>
            <th scope="col" className="zv-r">Total</th>
            <th scope="col"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((q) => {
            const draft = q.status === 'DRAFT'
            const to = draft ? `/orcamentos/${q.id}/editar` : `/orcamentos/${q.id}`
            return (
              <tr key={q.id}>
                <td>
                  <span className="zv-two">
                    <Link to={`/orcamentos/${q.id}`}>Nº {q.number}</Link>
                    <span className="zv-m-hide">{formatDate(q.createdAt)}</span>
                    <span className="zv-m-only">{q.customerName}</span>
                  </span>
                </td>
                <td className="zv-m-hide">{q.customerName}</td>
                <td className="zv-m-hide"><QuoteStatusBadge status={q.status} /></td>
                <td className="zv-r zv-m-right"><b>{formatMoney(q.totalCents)}</b><span className="zv-m-only"><QuoteStatusBadge status={q.status} /></span></td>
                <td className="zv-r zv-m-hide"><Link to={to} className="zv-btn zv-btn--sm" tabIndex={-1} aria-label={`${draft ? 'Continuar' : 'Ver'} orçamento ${q.number}`}>{draft ? 'Continuar' : 'Ver'}</Link></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
