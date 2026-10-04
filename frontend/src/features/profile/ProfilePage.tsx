import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, Ref } from 'react'
import { PageHero } from '../../components/layout/PageHero'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Toast } from '../../components/ui/Toast'
import { useRequest } from '../../hooks/useRequest'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../auth/types'
import { CardSkeleton, CustomerLoadError } from '../clientes/CustomerLoadStates'
import { formatDateTime, maskCep, maskPhone, onlyDigits } from '../clientes/format'
import { UFS } from '../clientes/validation'
import { lookupCep } from '../clientes/viaCep'
import { getCompany, updateCompany } from '../empresa/companyApi'
import { canEditCompany, companyAddressLine, ROLE_LABEL } from '../empresa/format'
import type { Company, CompanyRequest } from '../empresa/types'
import { CompanyBrand } from '../orcamentos/QuoteDocument'
import '../../components/ui/ButtonVariants.css'
import '../clientes/Clientes.css'
import '../orcamentos/QuoteDocument.css'
import './Perfil.css'

// HU26 — Perfil: dados da empresa (cabeçalho do PDF do orçamento).
// ADMIN e MANAGER editam. EMPLOYEE só vê. O back bloqueia de verdade (403).

type Values = {
  name: string; tagline: string; whatsapp: string; phone: string
  cep: string; street: string; number: string; complement: string; district: string; city: string; state: string
}
type Errors = Partial<Record<keyof Values, string>>
type CepStatus = 'idle' | 'loading' | 'found' | 'not-found' | 'unavailable'

const CEP_MESSAGES: Record<CepStatus, string> = {
  idle: '',
  loading: 'Buscando endereço…',
  found: 'Endereço encontrado. Confira o número.',
  'not-found': 'CEP não encontrado. Preencha o endereço manualmente.',
  unavailable: 'Não conseguimos buscar o CEP agora. Preencha o endereço manualmente.',
}

function toValues(c: Company): Values {
  const a = c.address
  return {
    name: c.name, tagline: c.tagline ?? '', whatsapp: c.whatsapp ? maskPhone(c.whatsapp) : '', phone: c.phone ? maskPhone(c.phone) : '',
    cep: a.cep ? maskCep(a.cep) : '', street: a.street ?? '', number: a.number ?? '', complement: a.complement ?? '',
    district: a.district ?? '', city: a.city ?? '', state: a.state ?? '',
  }
}

function toRequest(v: Values): CompanyRequest {
  const t = (s: string) => s.trim() || null
  return {
    name: v.name.trim(), tagline: t(v.tagline), whatsapp: onlyDigits(v.whatsapp) || null, phone: onlyDigits(v.phone) || null,
    address: { cep: onlyDigits(v.cep) || null, street: t(v.street), number: t(v.number), complement: t(v.complement), district: t(v.district), city: t(v.city), state: t(v.state) },
  }
}

// Mesmas regras do back: a tela avisa antes, o back confere de novo
function validate(v: Values): Errors {
  const e: Errors = {}
  if (v.name.trim().length < 2) e.name = 'Informe o nome da empresa.'
  const w = onlyDigits(v.whatsapp)
  if (w.length !== 10 && w.length !== 11) e.whatsapp = 'WhatsApp com DDD: 10 ou 11 números.'
  const p = onlyDigits(v.phone)
  if (p && p.length !== 10 && p.length !== 11) e.phone = 'Telefone com DDD: 10 ou 11 números.'
  const c = onlyDigits(v.cep)
  if (c && c.length !== 8) e.cep = 'O CEP tem 8 números.'
  if (!v.city.trim()) e.city = 'Informe a cidade.'
  if (!v.state) e.state = 'Escolha a UF.'
  return e
}

export function ProfilePage() {
  const { user } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const request = useRequest(`empresa#${attempt}`, getCompany)
  const [toast, setToast] = useState<string | null>(null)
  const who = user ? <>Você entrou como <strong className="pf-strong">{user.name}</strong> · {ROLE_LABEL[user.role]}</> : undefined

  return (
    <>
      <PageHero title="Perfil" subtitle={who} />
      <main className="page-body">
        {request.data
          ? <CompanyForm company={request.data} canEdit={canEditCompany(user?.role)}
              onSaved={(c) => { request.setData(c); setToast('Dados da empresa salvos. O PDF do orçamento já usa estes dados.') }} />
          : request.loading ? <CardSkeleton /> : <CustomerLoadError error={request.error} onRetry={() => setAttempt((n) => n + 1)} />}
      </main>
      <Toast message={toast} onClose={() => setToast(null)} />
    </>
  )
}

function CompanyForm({ company, canEdit, onSaved }: { company: Company; canEdit: boolean; onSaved: (c: Company) => void }) {
  const [initial, setInitial] = useState(() => toValues(company))
  const [values, setValues] = useState<Values>(initial)
  const [errors, setErrors] = useState<Errors>({})
  const [cepStatus, setCepStatus] = useState<CepStatus>('idle')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const cepAbort = useRef<AbortController | null>(null)
  const numberRef = useRef<HTMLInputElement>(null)
  const dirty = JSON.stringify(values) !== JSON.stringify(initial)

  useEffect(() => () => cepAbort.current?.abort(), [])

  // Prévia ao vivo: o que está digitado agora, no formato do orçamento
  const req = toRequest(values)
  const preview: Company = { ...company, ...req, name: req.name || 'ZBOX' }

  function searchCep(digits: string) {
    cepAbort.current?.abort()
    if (digits.length !== 8) { setCepStatus('idle'); return }
    const controller = new AbortController()
    cepAbort.current = controller
    setCepStatus('loading')
    lookupCep(digits, controller.signal)
      .then((result) => {
        setCepStatus(result.status)
        if (result.status !== 'found') return
        const a = result.address
        setValues((prev) => ({ ...prev, street: a.street || prev.street, district: a.district || prev.district, city: a.city || prev.city, state: a.state || prev.state }))
        setErrors((prev) => ({ ...prev, city: undefined, state: undefined }))
        numberRef.current?.focus()
      })
      .catch(() => { /* cancelado: digitou outro CEP */ })
  }

  function change(field: keyof Values) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      let value = event.target.value
      if (field === 'whatsapp' || field === 'phone') value = maskPhone(value)
      if (field === 'cep') value = maskCep(value)
      const next = { ...values, [field]: value }
      setValues(next)
      setFormError(null)
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: validate(next)[field] }))
      if (field === 'cep' && onlyDigits(value) !== onlyDigits(values.cep)) searchCep(onlyDigits(value))
    }
  }

  async function save() {
    if (saving) return
    const e = validate(values)
    setErrors(e)
    if (Object.keys(e).length) {
      setFormError('Confira os campos marcados.')
      document.getElementById(`emp-${Object.keys(e)[0]}`)?.focus()
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const saved = await updateCompany(toRequest(values))
      // Atualiza o formulário NO LUGAR (sem desmontar). Se os campos sumissem da tela depois de salvar,
      // o Chrome entenderia como "formulário de endereço enviado" e ofereceria salvar o endereço na conta Google.
      const fresh = toValues(saved)
      setInitial(fresh)
      setValues(fresh)
      setSaving(false)
      onSaved(saved)
    } catch (err) {
      setSaving(false)
      if (err instanceof ApiError && err.fieldErrors.length) {
        const mapped: Errors = {}
        for (const f of err.fieldErrors) mapped[f.field.replace('address.', '') as keyof Values] = f.message
        setErrors(mapped)
        setFormError('Confira os campos marcados.')
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar. Verifique sua conexão e tente de novo.')
      }
    }
  }

  function field(name: keyof Values, label: string, opts: { hint?: string; placeholder?: string; inputMode?: 'numeric' | 'tel'; ref?: Ref<HTMLInputElement>; maxLength?: number } = {}) {
    const id = `emp-${name}`
    const error = errors[name]
    return (
      <div className="cl-field">
        <label htmlFor={id} className="cl-field__label">{label}</label>
        <input id={id} ref={opts.ref} className="cl-input" autoComplete="off" value={values[name]} onChange={change(name)} disabled={!canEdit} placeholder={opts.placeholder}
          inputMode={opts.inputMode} maxLength={opts.maxLength ?? 120} aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-erro` : opts.hint ? `${id}-dica` : undefined} data-testid={id} />
        {error && <p id={`${id}-erro`} className="field__error">{error}</p>}
        {!error && opts.hint && <p id={`${id}-dica`} className="cl-field__hint">{opts.hint}</p>}
      </div>
    )
  }

  return (
    <div className="pf-layout">
      <section className="cl-card cl-card--elevated pf-card" aria-labelledby="t-empresa">
        <div className="pf-head">
          <h2 id="t-empresa" className="cl-card__title">Dados da empresa</h2>
          <p className="cl-muted">Aparecem no cabeçalho do orçamento (PDF e impressão).</p>
        </div>
        {!canEdit && <Alert variant="info">Só Administrador e Gerente podem alterar estes dados.</Alert>}
        {!company.whatsapp && canEdit && <Alert variant="warning">Preencha o WhatsApp e o endereço: o PDF do orçamento ainda está sem os dados da empresa.</Alert>}

        <fieldset className="pf-group" disabled={!canEdit}>
          <legend className="pf-legend">Identificação</legend>
          <div className="pf-grid pf-grid--2">
            {field('name', 'Nome da empresa', { maxLength: 60 })}
            {field('tagline', 'Frase abaixo do nome (opcional)', { placeholder: 'Ex.: Serralheria e esquadrias', maxLength: 60 })}
          </div>
        </fieldset>

        <fieldset className="pf-group" disabled={!canEdit}>
          <legend className="pf-legend">Contato</legend>
          <div className="pf-grid pf-grid--2">
            {field('whatsapp', 'WhatsApp', { inputMode: 'tel', placeholder: '(00) 00000-0000', hint: 'Sai no PDF. É o número que o cliente usa para responder.' })}
            {field('phone', 'Telefone fixo (opcional)', { inputMode: 'tel', placeholder: '(00) 0000-0000' })}
          </div>
        </fieldset>

        <fieldset className="pf-group" disabled={!canEdit}>
          <legend className="pf-legend">Endereço</legend>
          <div className="pf-grid pf-grid--street">
            <div className="cl-field">
              <label htmlFor="emp-cep" className="cl-field__label">CEP</label>
              <input id="emp-cep" className="cl-input" autoComplete="off" inputMode="numeric" placeholder="00000-000" value={values.cep} onChange={change('cep')} disabled={!canEdit}
                aria-invalid={errors.cep ? true : undefined} aria-describedby="emp-cep-status" data-testid="emp-cep" />
              {errors.cep
                ? <p id="emp-cep-status" className="field__error">{errors.cep}</p>
                : <p id="emp-cep-status" className="cl-field__hint" aria-live="polite">{CEP_MESSAGES[cepStatus] || 'Preenche o endereço sozinho.'}</p>}
            </div>
            {field('street', 'Rua')}
            {field('number', 'Número', { ref: numberRef, maxLength: 10 })}
          </div>
          <div className="pf-grid pf-grid--2">
            {field('complement', 'Complemento (opcional)', { placeholder: 'Ex.: galpão 2' })}
            {field('district', 'Bairro')}
          </div>
          <div className="pf-grid pf-grid--city">
            {field('city', 'Cidade', { maxLength: 80 })}
            <div className="cl-field">
              <label htmlFor="emp-state" className="cl-field__label">UF</label>
              <select id="emp-state" className="cl-input" autoComplete="off" value={values.state} onChange={change('state')} disabled={!canEdit}
                aria-invalid={errors.state ? true : undefined} aria-describedby={errors.state ? 'emp-state-erro' : undefined} data-testid="emp-state">
                <option value="">—</option>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
              {errors.state && <p id="emp-state-erro" className="field__error">{errors.state}</p>}
            </div>
          </div>
        </fieldset>

        {formError && <Alert variant="error">{formError}</Alert>}

        <div className="pf-footer">
          <span className="cl-muted pf-small">
            {company.updatedAt ? `Última alteração: ${formatDateTime(company.updatedAt)} por ${company.updatedBy ?? '—'}` : 'Ainda não preenchido.'}
          </span>
          {canEdit && (
            <span className="pf-actions">
              <Button className="btn--secondary" onClick={() => { setValues(initial); setErrors({}); setFormError(null); setCepStatus('idle') }} disabled={!dirty || saving}>Descartar</Button>
              <Button onClick={() => void save()} loading={saving} loadingText="Salvando…" disabled={!dirty} data-testid="salvar-empresa">Salvar dados da empresa</Button>
            </span>
          )}
        </div>
      </section>

      <aside className="pf-aside">
        <section className="cl-card pf-preview" aria-labelledby="t-previa">
          <h2 id="t-previa" className="cl-card__title">Como aparece no orçamento</h2>
          <div className="qd pf-letterhead" aria-label="Prévia do cabeçalho do orçamento">
            <div className="qd__frame">
              <header className="qd__header">
                <CompanyBrand company={preview} />
                <div className="qd__docbox">
                  <div className="qd__doctitle">ORÇAMENTO</div>
                  <div className="qd__docfield"><span className="qd__label">Número</span><span className="qd__mono">000125-v1</span></div>
                </div>
              </header>
            </div>
          </div>
          <p className="cl-muted pf-small">{canEdit ? 'A prévia muda enquanto você digita.' : companyAddressLine(company) || 'Endereço ainda não preenchido.'}</p>
        </section>
      </aside>
    </div>
  )
}
