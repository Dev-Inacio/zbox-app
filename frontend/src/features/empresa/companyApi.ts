import { ApiError } from '../auth/types'
import type { FieldError } from '../auth/types'
import { readMockSession } from '../auth/session'
import type { Company, CompanyRequest } from './types'

// ⚠️ SIMULAÇÃO (mock) de GET/PUT /api/company — enquanto o Inácio não publica.
// Guarda no localStorage para os dados sobreviverem ao F5 (o PDF do orçamento usa eles).
// Na integração, as duas funções viram fetch e as validações passam a ser do back.

const KEY = 'zbox.company'
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const EMPTY_COMPANY: Company = {
  name: 'ZBOX',
  tagline: 'Serralheria e esquadrias',
  whatsapp: null,
  phone: null,
  address: { cep: null, street: null, number: null, complement: null, district: null, city: null, state: null },
  updatedAt: null,
  updatedBy: null,
}

function read(): Company {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...EMPTY_COMPANY, ...(JSON.parse(raw) as Company) } : EMPTY_COMPANY
  } catch {
    return EMPTY_COMPANY
  }
}

// GET /api/company — qualquer usuário logado
export async function getCompany(): Promise<Company> {
  await wait(300)
  if (new URLSearchParams(window.location.search).get('simular') === 'erro') throw new TypeError('Failed to fetch')
  return structuredClone(read())
}

const digits = (v: string | null) => (v ?? '').replace(/\D/g, '')
const clean = (v: string | null) => (v ?? '').trim() || null

// PUT /api/company — só ADMIN e MANAGER
export async function updateCompany(request: CompanyRequest): Promise<Company> {
  await wait(600)
  const role = readMockSession()?.role
  if (role !== 'ADMIN' && role !== 'MANAGER') throw new ApiError(403, 'FORBIDDEN', 'Só Administrador e Gerente podem alterar os dados da empresa.')

  const errors: FieldError[] = []
  const err = (field: string, message: string) => errors.push({ field, code: 'INVALID', message })
  const name = request.name.trim()
  if (name.length < 2 || name.length > 60) err('name', 'Informe o nome da empresa (2 a 60 letras).')
  if ((request.tagline ?? '').trim().length > 60) err('tagline', 'Máximo de 60 caracteres.')
  const whats = digits(request.whatsapp)
  if (whats.length !== 10 && whats.length !== 11) err('whatsapp', 'WhatsApp com DDD: 10 ou 11 números.')
  const phone = digits(request.phone)
  if (phone && phone.length !== 10 && phone.length !== 11) err('phone', 'Telefone com DDD: 10 ou 11 números.')
  const cep = digits(request.address.cep)
  if (cep && cep.length !== 8) err('address.cep', 'O CEP tem 8 números.')
  if (!clean(request.address.city)) err('address.city', 'Informe a cidade.')
  if (!/^[A-Z]{2}$/.test((request.address.state ?? '').trim().toUpperCase())) err('address.state', 'Escolha a UF.')
  if (errors.length) throw new ApiError(400, 'VALIDATION_ERROR', 'Existem campos inválidos.', errors)

  const saved: Company = {
    name,
    tagline: clean(request.tagline),
    whatsapp: whats,
    phone: phone || null,
    address: {
      cep: cep || null,
      street: clean(request.address.street),
      number: clean(request.address.number),
      complement: clean(request.address.complement),
      district: clean(request.address.district),
      city: clean(request.address.city),
      state: (request.address.state ?? '').trim().toUpperCase(),
    },
    updatedAt: new Date().toISOString(),
    updatedBy: readMockSession()?.name ?? 'Usuário',
  }
  localStorage.setItem(KEY, JSON.stringify(saved))
  return structuredClone(saved)
}
