import type { Customer, CustomerRequest, CustomerSummary, Page } from '../clientes/types'
import { readMockSession } from './session'
import { ApiError } from './types'

// ⚠️ Só na versão de demonstração (npm run build:demo): faz o papel do back de Clientes, sem servidor.
// Começa vazio, e os dados ficam na memória da aba: o F5 limpa, igual aos outros mocks.

const customers = new Map<number, Customer>()
let nextId = 1

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function find(id: number): Customer {
  const customer = customers.get(id)
  if (!customer) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado.')
  return customer
}

function toSummary(c: Customer): CustomerSummary {
  return { id: c.id, name: c.name, type: c.type, phone: c.phone, whatsapp: c.whatsapp, city: c.address.city, state: c.address.state, status: c.status }
}

function list(query: Record<string, string | number | null | undefined>): Page<CustomerSummary> {
  const search = query.search ? normalize(String(query.search)) : ''
  const digits = String(query.search ?? '').replace(/\D/g, '')
  const page = Number(query.page ?? 0)
  const size = Number(query.size ?? 20)
  const rows = [...customers.values()]
    .filter((c) => !query.status || query.status === 'ALL' || c.status === query.status)
    .filter((c) => !query.type || c.type === query.type)
    .filter((c) => !search || normalize(c.name).includes(search) || (digits.length >= 2 && `${c.phone ?? ''} ${c.whatsapp ?? ''}`.includes(digits)))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  return { content: rows.slice(page * size, page * size + size).map(toSummary), page, size, totalElements: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / size)) }
}

function save(request: CustomerRequest, current?: Customer): Customer {
  if (!request.name?.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Existem campos inválidos.', [{ field: 'name', code: 'REQUIRED', message: 'Informe o nome do cliente.' }])
  const now = new Date().toISOString()
  const saved: Customer = {
    id: current?.id ?? nextId++, status: current?.status ?? 'ACTIVE', createdAt: current?.createdAt ?? now, deactivatedAt: current?.deactivatedAt ?? null, deactivatedBy: current?.deactivatedBy ?? null,
    ...request, name: request.name.trim(), updatedAt: now,
  }
  customers.set(saved.id, saved)
  return saved
}

export async function demoFetch(path: string, method: string, body: unknown, query: Record<string, string | number | null | undefined> = {}): Promise<unknown> {
  await wait(250)
  const match = path.match(/^\/api\/customers\/([^/]+)(?:\/(\w+))?$/)
  if (path === '/api/customers') return method === 'POST' ? save(body as CustomerRequest) : list(query)
  if (path === '/api/customers/duplicates') {
    const numbers = [query.phone, query.whatsapp].filter(Boolean)
    return [...customers.values()].filter((c) => c.id !== Number(query.excludeId) && (numbers.includes(c.phone) || numbers.includes(c.whatsapp))).map(toSummary)
  }
  if (match) {
    const customer = find(Number(match[1]))
    if (match[2] === 'history') return []
    if (match[2] === 'deactivate' || match[2] === 'activate') {
      const active = match[2] === 'activate'
      Object.assign(customer, { status: active ? 'ACTIVE' : 'INACTIVE', deactivatedAt: active ? null : new Date().toISOString(), deactivatedBy: active ? null : readMockSession()?.name ?? null })
      return { ...customer }
    }
    return method === 'PUT' ? save(body as CustomerRequest, customer) : { ...customer }
  }
  throw new ApiError(404, 'NOT_FOUND', 'Não encontrado.')
}
