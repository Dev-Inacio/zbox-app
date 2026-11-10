import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Pagination } from '../../components/ui/Pagination'
import { Button } from '../../components/ui/Button'
import { useRequest } from '../../hooks/useRequest'
import { listCustomers } from './customersApi'
import { StatusBadge } from './CustomerBadges'
import { customerMobile, maskPhone, typeLabel } from './format'
import { ListFilters, SegFilter } from '../../components/zbox'
import type { CustomerSummary, ListCustomersParams, StatusFilter } from './types'
import { AppIcon } from '../../components/ui/AppIcon'
import './Clientes.css'

// HU08 — Listar e buscar clientes.
// Os filtros moram na URL (?busca=ana&status=ACTIVE&pagina=2):
// dá para recarregar, voltar e mandar o link sem perder a busca.

const PAGE_SIZE = 10
const MIN_SEARCH = 2 // RN aprovada: busca a partir de 2 caracteres

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'INACTIVE', label: 'Inativos' },
  { value: 'ALL', label: 'Todos' },
]

function readStatus(value: string | null): StatusFilter {
  return value === 'INACTIVE' || value === 'ALL' ? value : 'ACTIVE'
}

export function CustomersListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('busca') ?? ''
  const status = readStatus(searchParams.get('status'))
  const type = 'ALL' as const
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

  const hasFilters = search !== '' || status !== 'ACTIVE'

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
          <Link to="/clientes/novo" className="zv-btn zv-btn--primary zv-btn--top" data-testid="novo-cliente">
            <Plus size={20} strokeWidth={1.8} aria-hidden="true" />
            Novo cliente
          </Link>
        }
      />

      <main className="page-body">
        <section className="zv-card" aria-label="Lista de clientes">
          <ListFilters value={term} onChange={setTerm} placeholder="Buscar por nome, celular ou cidade" testId="busca-clientes"
            hint={term.trim().length === 1 ? 'Digite pelo menos 2 letras para buscar.' : undefined}>
            <SegFilter label="Mostrar" options={STATUS_OPTIONS} value={status} onChange={(v) => updateParams({ status: v === 'ACTIVE' ? null : v, pagina: null })} />
          </ListFilters>

          {loading && <ListSkeleton />}

          {!loading && Boolean(error) && (
            <div className="cl-state" role="alert">
              <span className="cl-state__icon cl-state__icon--error" aria-hidden="true">
                <AppIcon name="alert" size={26} />
              </span>
              <p className="cl-state__title">Não foi possível carregar os clientes.</p>
              <p className="cl-state__text">Verifique sua conexão e tente de novo.</p>
              <Button className="btn--secondary" onClick={() => setAttempt((n) => n + 1)}>Tentar novamente</Button>
            </div>
          )}

          {data && data.totalElements === 0 && !hasFilters && (
            <div className="cl-state">
              <span className="cl-state__icon" aria-hidden="true">
                <AppIcon name="customer" size={26} />
              </span>
              <p className="cl-state__title">Nenhum cliente cadastrado ainda.</p>
              <p className="cl-state__text">Cadastre o primeiro para começar a fazer orçamentos.</p>
              <Link to="/clientes/novo" className="cl-cta">Cadastrar cliente</Link>
            </div>
          )}

          {data && data.totalElements === 0 && hasFilters && (
            <div className="cl-state">
              <span className="cl-state__icon" aria-hidden="true">
                <AppIcon name="search" size={26} />
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
              <Pagination page={data.page} totalPages={data.totalPages} size={data.size} total={data.totalElements} shown={data.content.length} noun="clientes" onChange={goToPage} />
            </>
          )}
        </section>
      </main>
    </>
  )
}

function CustomerTable({ items }: { items: CustomerSummary[] }) {
  return (
    <div className="zv-table-wrap">
      <table className="zv-table" data-testid="tabela-clientes">
        <thead>
          <tr>
            <th scope="col">Cliente</th>
            <th scope="col">Celular</th>
            <th scope="col">Cidade</th>
            <th scope="col">Situação</th>
            <th scope="col"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => {
            const mobile = customerMobile(c)
            const city = c.city ? `${c.city}${c.state ? `/${c.state}` : ''}` : null
            return (
              <tr key={c.id}>
                <td>
                  <span className="zv-two">
                    <Link to={`/clientes/${c.id}`}>{c.name}</Link>
                    <span className="zv-m-hide">{typeLabel(c.type)}</span>
                    <span className="zv-m-only">{[mobile && maskPhone(mobile), city].filter(Boolean).join(' · ')}</span>
                  </span>
                </td>
                <td className="zv-m-hide">{mobile ? maskPhone(mobile) : '—'}</td>
                <td className="zv-m-hide">{city ?? '—'}</td>
                <td><StatusBadge status={c.status} /></td>
                <td className="zv-r zv-m-hide"><Link to={`/clientes/${c.id}`} className="zv-btn zv-btn--sm" tabIndex={-1} aria-label={`Ver ${c.name}`}>Ver</Link></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
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
