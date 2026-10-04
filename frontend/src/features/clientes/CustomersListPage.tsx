import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Pagination } from '../../components/ui/Pagination'
import { Button } from '../../components/ui/Button'
import { useRequest } from '../../hooks/useRequest'
import { listCustomers } from './customersApi'
import { StatusBadge, TypeBadge } from './CustomerBadges'
import { maskPhone } from './format'
import type { CustomerSummary, CustomerType, ListCustomersParams, StatusFilter } from './types'
import './Clientes.css'

// HU08 — Listar e buscar clientes.
// Os filtros moram na URL (?busca=ana&status=ACTIVE&pagina=2):
// dá para recarregar, voltar e mandar o link sem perder a busca.

const PAGE_SIZE = 20 // RN aprovada: 20 por página
const MIN_SEARCH = 2 // RN aprovada: busca a partir de 2 caracteres

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'INACTIVE', label: 'Inativos' },
  { value: 'ALL', label: 'Todos' },
]

const TYPE_OPTIONS: { value: CustomerType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PERSON', label: 'Pessoa física' },
  { value: 'COMPANY', label: 'Empresa' },
]

function readStatus(value: string | null): StatusFilter {
  return value === 'INACTIVE' || value === 'ALL' ? value : 'ACTIVE'
}

function readType(value: string | null): CustomerType | 'ALL' {
  return value === 'PERSON' || value === 'COMPANY' ? value : 'ALL'
}

export function CustomersListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('busca') ?? ''
  const status = readStatus(searchParams.get('status'))
  const type = readType(searchParams.get('tipo'))
  const page = Math.max(0, Number(searchParams.get('pagina') ?? '1') - 1) || 0

  const [term, setTerm] = useState(search) // o que está escrito no campo, antes do debounce
  const [attempt, setAttempt] = useState(0)

  // Muda só os parâmetros informados; null remove o parâmetro da URL
  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '') next.delete(key)
          else next.set(key, value)
        }
        return next
      })
    },
    [setSearchParams],
  )

  // Debounce de 300ms: espera a pessoa parar de digitar antes de buscar
  useEffect(() => {
    const timer = setTimeout(() => {
      const value = term.trim()
      const effective = value.length >= MIN_SEARCH ? value : ''
      if (effective !== search) updateParams({ busca: effective, pagina: null })
    }, 300)
    return () => clearTimeout(timer)
  }, [term, search, updateParams])

  // A key muda quando muda um filtro, a página ou quando clica em "Tentar novamente"
  const key = `${search}|${status}|${type}|${page}|${attempt}`
  const fetcher = useCallback(() => {
    const params: ListCustomersParams = { search, status, type, page, size: PAGE_SIZE }
    return listCustomers(params)
  }, [search, status, type, page])
  const { loading, data, error } = useRequest(key, fetcher)

  const hasFilters = search !== '' || status !== 'ACTIVE' || type !== 'ALL'

  function clearAll() {
    setTerm('')
    setSearchParams(new URLSearchParams())
  }

  function goToPage(next: number) {
    updateParams({ pagina: next === 0 ? null : String(next + 1) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  let subtitle = 'Carregando…'
  if (data) {
    const n = data.totalElements
    if (!hasFilters) subtitle = n === 1 ? '1 cliente ativo' : `${n} clientes ativos`
    else subtitle = n === 1 ? '1 cliente encontrado' : `${n} clientes encontrados`
  } else if (error) {
    subtitle = ''
  }

  return (
    <>
      <PageHero
        eyebrow="Cadastro"
        title="Clientes"
        subtitle={subtitle}
        actions={
          <Link to="/clientes/novo" className="cl-cta" data-testid="novo-cliente">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Novo cliente
          </Link>
        }
      />

      <main className="page-body">
        <section className="cl-card cl-card--elevated" aria-labelledby="titulo-lista">
          <div className="cl-card__header">
            <h2 id="titulo-lista" className="cl-card__title">Lista de clientes</h2>
            <span className="cl-card__badge">Dados de exemplo</span>
          </div>

          <div role="search" className="cl-filters">
            <div className="cl-field cl-filters__search">
              <label htmlFor="busca-clientes" className="cl-field__label">Buscar</label>
              <div className="cl-search">
                <svg className="cl-search__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input
                  id="busca-clientes"
                  type="search"
                  className="cl-input cl-search__input"
                  placeholder="Nome, telefone ou cidade"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  aria-describedby="busca-dica"
                  autoComplete="off"
                  data-testid="busca-clientes"
                />
              </div>
              <p id="busca-dica" className="cl-field__hint" aria-live="polite">
                {term.trim().length === 1 ? 'Digite pelo menos 2 letras para buscar.' : ''}
              </p>
            </div>

            <div className="cl-field">
              <label htmlFor="filtro-status" className="cl-field__label">Status</label>
              <select
                id="filtro-status"
                className="cl-input"
                value={status}
                onChange={(event) => updateParams({ status: event.target.value === 'ACTIVE' ? null : event.target.value, pagina: null })}
              >
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="cl-field">
              <label htmlFor="filtro-tipo" className="cl-field__label">Tipo</label>
              <select
                id="filtro-tipo"
                className="cl-input"
                value={type}
                onChange={(event) => updateParams({ tipo: event.target.value === 'ALL' ? null : event.target.value, pagina: null })}
              >
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {loading && <ListSkeleton />}

          {!loading && Boolean(error) && (
            <div className="cl-state" role="alert">
              <span className="cl-state__icon cl-state__icon--error" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 16.5v.5" /></svg>
              </span>
              <p className="cl-state__title">Não foi possível carregar os clientes.</p>
              <p className="cl-state__text">Verifique sua conexão e tente de novo.</p>
              <Button className="btn--secondary" onClick={() => setAttempt((n) => n + 1)}>Tentar novamente</Button>
            </div>
          )}

          {data && data.totalElements === 0 && !hasFilters && (
            <div className="cl-state">
              <span className="cl-state__icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M19 8v6" /><path d="M16 11h6" /></svg>
              </span>
              <p className="cl-state__title">Nenhum cliente cadastrado ainda.</p>
              <p className="cl-state__text">Cadastre o primeiro para começar a fazer orçamentos.</p>
              <Link to="/clientes/novo" className="cl-cta">Cadastrar cliente</Link>
            </div>
          )}

          {data && data.totalElements === 0 && hasFilters && (
            <div className="cl-state">
              <span className="cl-state__icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              </span>
              <p className="cl-state__title">Nenhum cliente encontrado.</p>
              <p className="cl-state__text">
                {search ? <>Não achamos nada para “{search}”. Confira a grafia ou tente outro termo.</> : 'Nenhum cliente com esses filtros.'}
              </p>
              <Button className="btn--secondary" onClick={clearAll}>Limpar busca e filtros</Button>
            </div>
          )}

          {/* Página que não existe mais (ex.: link antigo ?pagina=9, ou clientes desativados nesse meio-tempo) */}
          {data && data.totalElements > 0 && data.content.length === 0 && (
            <div className="cl-state">
              <p className="cl-state__title">Esta página não tem clientes.</p>
              <p className="cl-state__text">A lista tem {data.totalPages} {data.totalPages === 1 ? 'página' : 'páginas'}.</p>
              <Button className="btn--secondary" onClick={() => goToPage(0)}>Ir para a primeira página</Button>
            </div>
          )}

          {data && data.content.length > 0 && (
            <>
              <CustomerTable items={data.content} />
              <Pagination page={data.page} totalPages={data.totalPages} size={data.size} total={data.totalElements} shown={data.content.length} onChange={goToPage} />
            </>
          )}
        </section>
      </main>
    </>
  )
}

function contactOf(c: CustomerSummary) {
  if (c.whatsapp) return { label: 'WhatsApp', value: maskPhone(c.whatsapp) }
  if (c.phone) return { label: 'Telefone', value: maskPhone(c.phone) }
  return null
}

function CustomerTable({ items }: { items: CustomerSummary[] }) {
  return (
    <table className="cl-table" data-testid="tabela-clientes">
      <thead>
        <tr>
          <th scope="col">Nome</th>
          <th scope="col">Tipo</th>
          <th scope="col">Contato</th>
          <th scope="col">Cidade</th>
          <th scope="col">Status</th>
          <th scope="col"><span className="sr-only">Ações</span></th>
        </tr>
      </thead>
      <tbody>
        {items.map((c) => {
          const contact = contactOf(c)
          return (
            <tr key={c.id} className={c.status === 'INACTIVE' ? 'is-inactive' : undefined}>
              <td className="cl-table__name">
                <Link to={`/clientes/${c.id}`}>{c.name}</Link>
              </td>
              <td className="cl-table__type"><TypeBadge type={c.type} /></td>
              <td className="cl-table__contact">
                {contact ? <span title={contact.label}>{contact.value}</span> : <span className="cl-muted">Sem contato</span>}
              </td>
              <td className="cl-table__city">
                {c.city ? `${c.city}${c.state ? `/${c.state}` : ''}` : <span className="cl-muted">—</span>}
              </td>
              <td className="cl-table__status"><StatusBadge status={c.status} /></td>
              <td className="cl-table__go">
                <Link to={`/clientes/${c.id}`} aria-label={`Ver ${c.name}`} className="cl-icon-link" tabIndex={-1}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                </Link>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ListSkeleton() {
  return (
    <div className="cl-skeleton" role="status" aria-label="Carregando clientes">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="cl-skeleton__row">
          <span style={{ width: `${55 + ((i * 13) % 30)}%` }} />
          <span style={{ width: `${30 + ((i * 7) % 20)}%` }} />
        </div>
      ))}
    </div>
  )
}
