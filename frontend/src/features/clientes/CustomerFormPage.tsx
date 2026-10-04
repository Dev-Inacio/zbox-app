import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHero } from '../../components/layout/PageHero'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Input } from '../../components/ui/Input'
import { useRequest } from '../../hooks/useRequest'
import { ApiError } from '../auth/types'
import { CardSkeleton, CustomerLoadError } from './CustomerLoadStates'
import { createCustomer, findDuplicates, getCustomer, updateCustomer } from './customersApi'
import { maskCep, maskPhone, onlyDigits } from './format'
import { NOTES_MAX, UFS, validateCustomer, validateField } from './validation'
import type { CustomerFormErrors, CustomerFormValues } from './validation'
import { lookupCep } from './viaCep'
import type { Customer, CustomerRequest, CustomerSummary } from './types'
import '../../components/ui/ButtonVariants.css'
import './Clientes.css'

// HU09 (cadastrar) e HU10 (editar): o mesmo formulário.
// Regra aprovada pela PO: SÓ o nome é obrigatório.

const EMPTY: CustomerFormValues = {
  name: '', type: '', phone: '', whatsapp: '', zipCode: '', street: '', number: '',
  complement: '', district: '', city: '', state: '', notes: '',
}

function toValues(c: Customer): CustomerFormValues {
  return {
    name: c.name,
    type: c.type ?? '',
    phone: maskPhone(c.phone ?? ''),
    whatsapp: maskPhone(c.whatsapp ?? ''),
    zipCode: maskCep(c.address.zipCode ?? ''),
    street: c.address.street ?? '',
    number: c.address.number ?? '',
    complement: c.address.complement ?? '',
    district: c.address.district ?? '',
    city: c.address.city ?? '',
    state: c.address.state ?? '',
    notes: c.notes ?? '',
  }
}

// Campo vazio vai como null. Telefone e CEP vão só com números (contrato).
function toRequest(v: CustomerFormValues): CustomerRequest {
  const text = (s: string) => (s.trim() === '' ? null : s.trim())
  const digits = (s: string) => (onlyDigits(s) === '' ? null : onlyDigits(s))
  return {
    name: v.name.trim(),
    type: v.type === '' ? null : v.type,
    phone: digits(v.phone),
    whatsapp: digits(v.whatsapp),
    address: {
      zipCode: digits(v.zipCode),
      street: text(v.street),
      number: text(v.number),
      complement: text(v.complement),
      district: text(v.district),
      city: text(v.city),
      state: text(v.state),
    },
    notes: text(v.notes),
  }
}

// ---------- Página: decide entre "novo" e "editar" ----------
export function CustomerFormPage() {
  const { id } = useParams()
  if (id === undefined) return <CustomerForm />
  return <EditCustomerLoader id={Number(id)} />
}

function EditCustomerLoader({ id }: { id: number }) {
  const [attempt, setAttempt] = useState(0)
  const fetcher = useCallback(() => getCustomer(id), [id])
  const { loading, data, error } = useRequest(`${id}#${attempt}`, fetcher)

  if (data) return <CustomerForm key={data.id} customer={data} />

  return (
    <>
      <PageHero title="Editar cliente" back={{ to: `/clientes/${id}`, label: 'Voltar para o cliente' }} />
      <main className="page-body">
        {loading ? <CardSkeleton /> : <CustomerLoadError error={error} onRetry={() => setAttempt((n) => n + 1)} />}
      </main>
    </>
  )
}

// ---------- O formulário ----------
type CepStatus = 'idle' | 'loading' | 'found' | 'not-found' | 'unavailable'

const CEP_MESSAGES: Record<CepStatus, string> = {
  idle: '',
  loading: 'Buscando endereço…',
  found: 'Endereço encontrado. Confira e complete o número.',
  'not-found': 'CEP não encontrado. Preencha o endereço manualmente.',
  unavailable: 'Não conseguimos buscar o CEP agora. Preencha o endereço manualmente.',
}

function CustomerForm({ customer }: { customer?: Customer }) {
  const navigate = useNavigate()
  const editing = customer !== undefined
  const [initial] = useState<CustomerFormValues>(() => (customer ? toValues(customer) : EMPTY))
  const [values, setValues] = useState<CustomerFormValues>(initial)
  const [errors, setErrors] = useState<CustomerFormErrors>({})
  const [cepStatus, setCepStatus] = useState<CepStatus>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<CustomerSummary[] | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const cepAbort = useRef<AbortController | null>(null)
  const numberRef = useRef<HTMLInputElement>(null)

  const dirty = JSON.stringify(values) !== JSON.stringify(initial)
  const backTo = editing ? `/clientes/${customer.id}` : '/clientes'

  // Avisa o navegador antes de fechar/recarregar a aba com alterações não salvas
  useEffect(() => {
    if (!dirty) return
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  // Cancela a busca de CEP pendente se a pessoa sair da tela
  useEffect(() => () => cepAbort.current?.abort(), [])

  function searchCep(digits: string) {
    cepAbort.current?.abort()
    if (digits.length !== 8) {
      setCepStatus('idle')
      return
    }
    const controller = new AbortController()
    cepAbort.current = controller
    setCepStatus('loading')

    lookupCep(digits, controller.signal)
      .then((result) => {
        setCepStatus(result.status)
        if (result.status !== 'found') return
        const a = result.address
        // Preenche o que veio; mantém o que o ViaCEP não informou (ex.: CEP geral da cidade sem rua)
        setValues((prev) => ({
          ...prev,
          street: a.street || prev.street,
          district: a.district || prev.district,
          city: a.city || prev.city,
          state: a.state || prev.state,
        }))
        setErrors((prev) => ({ ...prev, street: undefined, district: undefined, city: undefined, state: undefined }))
        numberRef.current?.focus() // próximo passo natural: o número
      })
      .catch(() => {
        // cancelado porque digitou outro CEP: não faz nada
      })
  }

  function handleChange(field: keyof CustomerFormValues) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      let value = event.target.value
      if (field === 'phone' || field === 'whatsapp') value = maskPhone(value)
      if (field === 'zipCode') value = maskCep(value)

      const next = { ...values, [field]: value }
      setValues(next)
      setFormError(null)
      // Se o campo já estava com erro, revalida enquanto digita (o erro some quando corrigir)
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: validateField(field, next) }))
      if (field === 'zipCode' && onlyDigits(value) !== onlyDigits(values.zipCode)) searchCep(onlyDigits(value))
    }
  }

  function handleBlur(field: keyof CustomerFormValues) {
    return () => setErrors((prev) => ({ ...prev, [field]: validateField(field, values) }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return // evita duplo clique

    const found = validateCustomer(values)
    setErrors(found)
    const firstInvalid = Object.keys(found)[0]
    if (firstInvalid) {
      setFormError('Confira os campos destacados.')
      document.getElementById(`cliente-${firstInvalid}`)?.focus()
      return
    }

    const request = toRequest(values)

    // Possível duplicado (sem CPF, a checagem é pelo número). Só avisa, não impede.
    const numbersChanged = !editing || request.phone !== customer.phone || request.whatsapp !== customer.whatsapp
    if (numbersChanged && (request.phone || request.whatsapp)) {
      setSubmitting(true)
      try {
        const dups = await findDuplicates(request.phone, request.whatsapp, customer?.id)
        if (dups.length > 0) {
          setDuplicates(dups)
          setSubmitting(false)
          return
        }
      } catch {
        // Se a checagem falhar, segue para salvar: ela é só um aviso
      }
    }

    await save(request)
  }

  async function save(request: CustomerRequest) {
    setDuplicates(null)
    setSubmitting(true)
    setFormError(null)
    try {
      const saved = editing ? await updateCustomer(customer.id, request) : await createCustomer(request)
      navigate(`/clientes/${saved.id}`, {
        replace: true, // "voltar" não reabre o formulário já salvo
        state: { flash: editing ? 'Alterações salvas com sucesso.' : 'Cliente cadastrado com sucesso.' },
      })
    } catch (error) {
      setSubmitting(false)
      if (error instanceof ApiError) {
        if (error.code === 'VALIDATION_ERROR' && error.fieldErrors.length > 0) {
          // O back recusou: mostra o erro no campo certo ("address.zipCode" → "zipCode")
          const fromApi: CustomerFormErrors = {}
          for (const fe of error.fieldErrors) {
            fromApi[fe.field.replace('address.', '') as keyof CustomerFormValues] = fe.message
          }
          setErrors(fromApi)
          setFormError('Confira os campos destacados.')
          return
        }
        if (error.status === 403) return setFormError('Você não tem permissão para salvar clientes.')
        if (error.status === 404) return setFormError('Este cliente não existe mais.')
      }
      // Falha de rede ou erro inesperado: os dados digitados continuam na tela
      setFormError('Não foi possível salvar. Verifique sua conexão e tente de novo.')
    }
  }

  function handleCancel() {
    if (dirty) setConfirmDiscard(true)
    else navigate(backTo)
  }

  const notesLeft = NOTES_MAX - values.notes.length

  return (
    <>
      <PageHero
        title={editing ? 'Editar cliente' : 'Novo cliente'}
        back={{ to: backTo, label: editing ? 'Voltar para o cliente' : 'Voltar para clientes' }}
        subtitle={editing ? customer.name : 'Só o nome é obrigatório. O resto você completa quando tiver.'}
      />

      <main className="page-body">
        <form className="cl-card cl-card--elevated cl-form" onSubmit={handleSubmit} noValidate data-testid="form-cliente">
          {formError && (
            <div className="cl-form__alert">
              <Alert variant="error">{formError}</Alert>
            </div>
          )}

          <fieldset className="cl-form__section">
            <legend className="sr-only">Dados</legend>
            <div className="cl-form__intro">
              <h2 className="cl-form__title">Dados</h2>
              <p className="cl-form__desc">Quem é o cliente.</p>
            </div>
            <div className="cl-form__fields">
              <div className="cl-field">
                <span className="cl-field__label" id="cliente-tipo-label">Tipo de cliente</span>
                <div className="cl-segmented" role="radiogroup" aria-labelledby="cliente-tipo-label">
                  <label className="cl-segmented__option">
                    <input autoComplete="off" type="radio" name="type" value="PERSON" checked={values.type === 'PERSON'} onChange={handleChange('type')} />
                    Pessoa física
                  </label>
                  <label className="cl-segmented__option">
                    <input autoComplete="off" type="radio" name="type" value="COMPANY" checked={values.type === 'COMPANY'} onChange={handleChange('type')} />
                    Empresa
                  </label>
                </div>
              </div>

              <Input
                id="cliente-name"
                label="Nome *"
                value={values.name}
                onChange={handleChange('name')}
                onBlur={handleBlur('name')}
                error={errors.name}
                aria-required="true"
                maxLength={120}
                autoComplete="off"
                data-testid="campo-nome"
              />
            </div>
          </fieldset>

          <fieldset className="cl-form__section">
            <legend className="sr-only">Contato</legend>
            <div className="cl-form__intro">
              <h2 className="cl-form__title">Contato</h2>
              <p className="cl-form__desc">Opcional. O WhatsApp é usado para enviar orçamentos.</p>
            </div>
            <div className="cl-form__fields cl-form__fields--2">
              <Input
                id="cliente-phone"
                label="Telefone"
                type="tel"
                inputMode="numeric"
                placeholder="(00) 0000-0000"
                value={values.phone}
                onChange={handleChange('phone')}
                onBlur={handleBlur('phone')}
                error={errors.phone}
                data-testid="campo-telefone"
              />
              <Input
                id="cliente-whatsapp"
                label="WhatsApp"
                type="tel"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                value={values.whatsapp}
                onChange={handleChange('whatsapp')}
                onBlur={handleBlur('whatsapp')}
                error={errors.whatsapp}
                data-testid="campo-whatsapp"
              />
            </div>
          </fieldset>

          <fieldset className="cl-form__section">
            <legend className="sr-only">Endereço</legend>
            <div className="cl-form__intro">
              <h2 className="cl-form__title">Endereço</h2>
              <p className="cl-form__desc">Digite o CEP e o endereço é preenchido.</p>
            </div>
            <div className="cl-form__fields cl-form__fields--address">
              <div className="cl-span-2">
                <Input
                  id="cliente-zipCode"
                  label="CEP"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={values.zipCode}
                  onChange={handleChange('zipCode')}
                  onBlur={handleBlur('zipCode')}
                  error={errors.zipCode}
                  data-testid="campo-cep"
                />
                <p className={`cl-cep cl-cep--${cepStatus}`} aria-live="polite" data-testid="cep-status">
                  {cepStatus === 'loading' && <span className="cl-cep__spinner" aria-hidden="true" />}
                  {cepStatus === 'found' && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
                  )}
                  {CEP_MESSAGES[cepStatus]}
                </p>
              </div>
              <div className="cl-span-4 cl-hide-mobile" aria-hidden="true" />
              <div className="cl-span-4">
                <Input id="cliente-street" label="Rua" value={values.street} onChange={handleChange('street')} onBlur={handleBlur('street')} error={errors.street} maxLength={120} />
              </div>
              <div className="cl-span-2">
                <Input ref={numberRef} id="cliente-number" label="Número" placeholder="Ex.: 120 ou S/N" value={values.number} onChange={handleChange('number')} onBlur={handleBlur('number')} error={errors.number} maxLength={20} />
              </div>
              <div className="cl-span-3">
                <Input id="cliente-complement" label="Complemento" placeholder="Apto, bloco, referência" value={values.complement} onChange={handleChange('complement')} onBlur={handleBlur('complement')} error={errors.complement} maxLength={120} />
              </div>
              <div className="cl-span-3">
                <Input id="cliente-district" label="Bairro" value={values.district} onChange={handleChange('district')} onBlur={handleBlur('district')} error={errors.district} maxLength={120} />
              </div>
              <div className="cl-span-4">
                <Input id="cliente-city" label="Cidade" value={values.city} onChange={handleChange('city')} onBlur={handleBlur('city')} error={errors.city} maxLength={120} />
              </div>
              <div className="cl-span-2 cl-field">
                <label htmlFor="cliente-state" className="cl-field__label">UF</label>
                <select autoComplete="off"
                  id="cliente-state"
                  className="cl-input"
                  value={values.state}
                  onChange={handleChange('state')}
                  aria-invalid={errors.state ? true : undefined}
                >
                  <option value="">Selecione</option>
                  {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
                {errors.state && <p className="field__error">{errors.state}</p>}
              </div>
            </div>
          </fieldset>

          <fieldset className="cl-form__section">
            <legend className="sr-only">Observações</legend>
            <div className="cl-form__intro">
              <h2 className="cl-form__title">Observações</h2>
              <p className="cl-form__desc">Não registre dados sensíveis aqui.</p>
            </div>
            <div className="cl-form__fields">
              <div className="cl-field">
                <label htmlFor="cliente-notes" className="cl-field__label">Observações</label>
                <textarea autoComplete="off"
                  id="cliente-notes"
                  className="cl-input cl-textarea"
                  rows={4}
                  placeholder="Ex.: prefere contato à tarde"
                  value={values.notes}
                  onChange={handleChange('notes')}
                  onBlur={handleBlur('notes')}
                  maxLength={NOTES_MAX}
                  aria-describedby="cliente-notes-contador"
                  aria-invalid={errors.notes ? true : undefined}
                />
                <p id="cliente-notes-contador" className={`cl-counter${notesLeft <= 20 ? ' cl-counter--low' : ''}`}>
                  {values.notes.length}/{NOTES_MAX}
                </p>
              </div>
            </div>
          </fieldset>

          <div className="cl-form__footer">
            <Button className="btn--secondary" onClick={handleCancel} disabled={submitting}>Cancelar</Button>
            <Button type="submit" loading={submitting} loadingText="Salvando…" data-testid="salvar-cliente">
              {editing ? 'Salvar alterações' : 'Salvar cliente'}
            </Button>
          </div>
        </form>
      </main>

      <ConfirmDialog
        open={duplicates !== null}
        title="Já existe um cliente com este número"
        confirmLabel="Salvar mesmo assim"
        cancelLabel="Voltar e revisar"
        loading={submitting}
        loadingText="Salvando…"
        onConfirm={() => save(toRequest(values))}
        onCancel={() => setDuplicates(null)}
      >
        <p>Confira se não é o mesmo cliente:</p>
        <ul className="cl-dup-list">
          {duplicates?.map((d) => (
            <li key={d.id}>
              <Link to={`/clientes/${d.id}`} target="_blank" rel="noopener">{d.name}</Link>
              <span>{maskPhone(d.whatsapp ?? d.phone ?? '')}{d.status === 'INACTIVE' ? ' · inativo' : ''}</span>
            </li>
          ))}
        </ul>
        <p>Se for outra pessoa usando o mesmo número, pode salvar.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDiscard}
        title="Descartar alterações?"
        confirmLabel="Descartar"
        cancelLabel="Continuar editando"
        variant="danger"
        onConfirm={() => navigate(backTo)}
        onCancel={() => setConfirmDiscard(false)}
      >
        <p>O que você digitou não será salvo.</p>
      </ConfirmDialog>
    </>
  )
}
