import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Alert } from '../../components/ui/Alert'
import { useRequest } from '../../hooks/useRequest'
import { ApiError } from '../auth/types'
import { listCustomers } from '../clientes/customersApi'
import { maskPhone } from '../clientes/format'
import type { CustomerSummary } from '../clientes/types'
import { createQuote } from './quotesApi'
import '../clientes/Clientes.css'
import './Orcamentos.css'

// HU14 (início) — Novo orçamento: primeiro escolhe o cliente.
// Vindo do detalhe do cliente (?cliente=12), cria direto com ele.

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

export function NewQuotePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetId = Number(params.get('cliente')) || null
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [creating, setCreating] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const startedPreset = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim().length >= 2 ? term.trim() : ''), 300)
    return () => clearTimeout(t)
  }, [term])

  const fetcher = useCallback(() => listCustomers({ search: debounced, status: 'ACTIVE', type: 'ALL', page: 0, size: 8 }), [debounced])
  const customers = useRequest(`clientes|${debounced}`, fetcher)

  const choose = useCallback(
    async (customerId: number) => {
      setCreating(customerId)
      setError(null)
      try {
        const quote = await createQuote(customerId)
        navigate(`/orcamentos/${quote.id}/editar`, { replace: true })
      } catch (e) {
        setCreating(null)
        if (e instanceof ApiError && e.code === 'CUSTOMER_INACTIVE') setError('Este cliente está desativado. Reative o cliente para fazer orçamento.')
        else if (e instanceof ApiError && e.status === 404) setError('Cliente não encontrado.')
        else setError('Não foi possível criar o orçamento. Tente de novo.')
      }
    },
    [navigate],
  )

  // Atalho vindo do detalhe do cliente: cria uma vez só (mesmo se o React rodar o efeito 2×)
  useEffect(() => {
    if (presetId && !startedPreset.current) {
      startedPreset.current = true
      void choose(presetId)
    }
  }, [presetId, choose])

  return (
    <>
      <PageHero title="Novo orçamento" back={{ to: '/orcamentos', label: 'Voltar para orçamentos' }} subtitle="Comece escolhendo o cliente." />
      <main className="page-body oc-layout">
        <div className="oc-layout__main">
          <section className="cl-card cl-card--elevated" aria-labelledby="titulo-cliente">
            <div className="oc-step-title">
              <span className="oc-step-num" aria-hidden="true">1</span>
              <h2 id="titulo-cliente" className="cl-card__title">Para qual cliente?</h2>
            </div>
            {error && <Alert variant="error">{error}</Alert>}
            <div className="cl-search">
              <label htmlFor="busca-cliente-orc" className="sr-only">Buscar cliente</label>
              <svg className="cl-search__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input
                id="busca-cliente-orc"
                type="search"
                className="cl-input cl-search__input"
                placeholder="Nome, telefone ou cidade"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                autoComplete="off"
                data-testid="busca-cliente-orcamento"
              />
            </div>

            <CustomerChoices state={customers} creating={creating} onChoose={choose} />

            <Link to="/clientes/novo" className="oc-link-add">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
              Cadastrar novo cliente
            </Link>
            <p className="cl-muted oc-small">Só aparecem clientes ativos. Depois de cadastrar, use "Novo orçamento" no detalhe do cliente.</p>
          </section>

          <section className="oc-step-locked" aria-label="Itens: libera depois de escolher o cliente">
            <span className="oc-step-num oc-step-num--off" aria-hidden="true">2</span>
            <div><h2 className="oc-step-locked__title">Itens</h2><span>Libera depois de escolher o cliente.</span></div>
          </section>
          <section className="oc-step-locked" aria-label="Condições: libera depois de escolher o cliente">
            <span className="oc-step-num oc-step-num--off" aria-hidden="true">3</span>
            <div><h2 className="oc-step-locked__title">Condições</h2><span>Pagamento e observações.</span></div>
          </section>
        </div>
      </main>
    </>
  )
}

type ChoicesState = { loading: boolean; data?: { content: CustomerSummary[] }; error?: unknown }

function CustomerChoices({ state, creating, onChoose }: { state: ChoicesState; creating: number | null; onChoose: (id: number) => void }) {
  if (state.loading) return <div className="cl-skeleton" role="status" aria-label="Buscando clientes"><div className="cl-skeleton__row"><span style={{ width: '60%' }} /><span style={{ width: '35%' }} /></div><div className="cl-skeleton__row"><span style={{ width: '50%' }} /><span style={{ width: '30%' }} /></div></div>
  if (!state.data) return <p className="cl-muted" role="alert">Não foi possível buscar os clientes.</p>
  if (state.data.content.length === 0) return <p className="cl-muted">Nenhum cliente ativo encontrado.</p>

  return (
    <ul className="oc-choices" aria-label="Clientes">
      {state.data.content.map((c) => (
        <li key={c.id}>
          <button type="button" className="oc-choice" onClick={() => onChoose(c.id)} disabled={creating !== null} aria-busy={creating === c.id}>
            <span className="oc-avatar" aria-hidden="true">{initials(c.name)}</span>
            <span className="oc-choice__text">
              <span className="oc-choice__name">{c.name}</span>
              <span className="oc-choice__meta">
                {[c.whatsapp ? maskPhone(c.whatsapp) : c.phone ? maskPhone(c.phone) : 'Sem contato', c.city ? `${c.city}/${c.state ?? ''}` : null].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="oc-choice__cta">{creating === c.id ? 'Criando…' : 'Escolher'}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
