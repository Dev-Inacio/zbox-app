import { ApiError } from '../auth/types'
import { readMockSession } from '../auth/session'
import type {
  Customer,
  CustomerHistoryItem,
  CustomerRequest,
  CustomerSummary,
  ListCustomersParams,
  Page,
} from './types'

// ⚠️ SIMULAÇÃO (mock) — enquanto o Inácio não publica /api/customers.
// Cada função responde EXATAMENTE no formato do contrato (docs/contrato-api-clientes.md).
// Na integração, só o corpo destas funções muda (vira fetch); as telas continuam iguais.
//
// Os dados ficam na memória: recarregar a página volta tudo ao início.
//
// Para testar os estados da lista, abra com:
//   /clientes?simular=erro   → erro ao carregar
//   /clientes?simular=vazio  → nenhum cliente cadastrado

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function simulation(): string | null {
  return new URLSearchParams(window.location.search).get('simular')
}

function currentUserName(): string {
  return readMockSession()?.name ?? 'Usuário'
}

// "José" → "jose": busca sem diferenciar acento e maiúscula
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// ---------- Dados de exemplo ----------
const FIRST = ['Marcos', 'Ana Paula', 'José Carlos', 'Renata', 'Fernanda', 'Ricardo', 'Juliana', 'Paulo', 'Carla', 'Eduardo', 'Patrícia', 'Rafael', 'Luciana', 'Sérgio', 'Beatriz']
const LAST = ['Andrade Silva', 'Ribeiro', 'Moreira', 'Lima Duarte', 'Souza', 'Almeida', 'Campos', 'Ferreira', 'Nogueira', 'Teixeira']
const COMPANIES = ['Construtora Pedra Alta Ltda', 'Condomínio Jardim das Acácias', 'Vidraçaria Horizonte Ltda', 'Restaurante Sabor da Serra', 'Clínica Bem Viver', 'Escola Pequeno Saber', 'Mercado Bom Preço', 'Academia Ponto Forte']
const CITIES: [string, string, string][] = [
  ['Campinas', 'Jardim Santa Genebra', '13087460'],
  ['Valinhos', 'Centro', '13270000'],
  ['Sumaré', 'Jardim Nova Veneza', '13177000'],
  ['Hortolândia', 'Jardim Amanda', '13188000'],
  ['Paulínia', 'Morumbi', '13140000'],
]

let nextId = 1
const customers: Customer[] = []
const history = new Map<number, CustomerHistoryItem[]>()
let nextHistoryId = 1

function addHistory(customerId: number, item: Omit<CustomerHistoryItem, 'id'>) {
  const list = history.get(customerId) ?? []
  list.unshift({ id: nextHistoryId++, ...item }) // mais recente primeiro
  history.set(customerId, list)
}

function seed() {
  const names = [
    ...COMPANIES.map((name) => ({ name, type: 'COMPANY' as const })),
    ...FIRST.flatMap((first, i) => [
      { name: `${first} ${LAST[i % LAST.length]}`, type: 'PERSON' as const },
      { name: `${first} ${LAST[(i + 3) % LAST.length]}`, type: i % 4 === 0 ? null : ('PERSON' as const) },
    ]),
  ]

  names.forEach(({ name, type }, i) => {
    const [city, district, zipCode] = CITIES[i % CITIES.length]
    const created = new Date(Date.UTC(2026, 2, 1 + (i % 28), 13 + (i % 6), 20))
    const id = nextId++
    customers.push({
      id,
      name,
      type,
      phone: i % 3 === 0 ? `193241${String(7000 + i).padStart(4, '0')}` : null,
      whatsapp: i % 5 === 4 ? null : `1999${String(8120000 + i * 731).slice(0, 7)}`,
      address: { zipCode, street: 'Rua das Palmeiras', number: String(100 + i), complement: null, district, city, state: 'SP' },
      notes: i === 8 ? 'Prefere contato à tarde. Portão lateral para entrega.' : null,
      status: i % 11 === 10 ? 'INACTIVE' : 'ACTIVE',
      createdAt: created.toISOString(),
      updatedAt: created.toISOString(),
      deactivatedAt: i % 11 === 10 ? '2026-10-01T12:00:00.000Z' : null,
      deactivatedBy: i % 11 === 10 ? 'Thayná' : null,
    })
    addHistory(id, { action: 'CREATED', changedFields: [], userName: i % 2 ? 'Inácio' : 'Thayná', createdAt: created.toISOString() })
  })
}
seed()

function toSummary(c: Customer): CustomerSummary {
  return { id: c.id, name: c.name, type: c.type, phone: c.phone, whatsapp: c.whatsapp, city: c.address.city, state: c.address.state, status: c.status }
}

function findOr404(id: number): Customer {
  const customer = customers.find((c) => c.id === id)
  if (!customer) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado.')
  return customer
}

// O back também valida (a regra mora lá). O mock imita a resposta 400.
function validateOnServer(request: CustomerRequest) {
  if (request.name.trim().length < 3) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Existem campos inválidos.', [
      { field: 'name', code: 'SIZE', message: 'O nome precisa ter pelo menos 3 letras.' },
    ])
  }
}

// ---------- Endpoints ----------

// GET /api/customers?search=&status=ACTIVE&type=&page=0&size=20
export async function listCustomers(params: ListCustomersParams): Promise<Page<CustomerSummary>> {
  await wait(600)
  const sim = simulation()
  if (sim === 'erro') throw new TypeError('Failed to fetch')

  const term = normalize(params.search.trim())
  const digits = params.search.replace(/\D/g, '')

  const filtered = (sim === 'vazio' ? [] : customers)
    .filter((c) => params.status === 'ALL' || c.status === params.status)
    .filter((c) => params.type === 'ALL' || c.type === params.type)
    .filter((c) => {
      if (term.length < 2) return true // RN: busca a partir de 2 caracteres
      if (normalize(c.name).includes(term)) return true
      if (c.address.city && normalize(c.address.city).includes(term)) return true
      if (digits.length >= 2 && (c.phone?.includes(digits) || c.whatsapp?.includes(digits))) return true
      return false
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const start = params.page * params.size
  return {
    content: filtered.slice(start, start + params.size).map(toSummary),
    page: params.page,
    size: params.size,
    totalElements: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / params.size)),
  }
}

// GET /api/customers/{id}
export async function getCustomer(id: number): Promise<Customer> {
  await wait(500)
  return structuredClone(findOr404(id))
}

// GET /api/customers/{id}/history
export async function getCustomerHistory(id: number): Promise<CustomerHistoryItem[]> {
  await wait(400)
  findOr404(id)
  return structuredClone(history.get(id) ?? [])
}

// GET /api/customers/duplicates?phone=&whatsapp=&excludeId=
// Sem CPF, o "possível duplicado" é pelo número de telefone/WhatsApp.
export async function findDuplicates(phone: string | null, whatsapp: string | null, excludeId?: number): Promise<CustomerSummary[]> {
  await wait(300)
  const numbers = [phone, whatsapp].filter((n): n is string => Boolean(n))
  if (numbers.length === 0) return []
  return customers
    .filter((c) => c.id !== excludeId)
    .filter((c) => numbers.some((n) => n === c.phone || n === c.whatsapp))
    .map(toSummary)
}

// POST /api/customers → 201
export async function createCustomer(request: CustomerRequest): Promise<Customer> {
  await wait(800)
  validateOnServer(request)
  const now = new Date().toISOString()
  const customer: Customer = {
    id: nextId++,
    ...structuredClone(request),
    name: request.name.trim(),
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    deactivatedAt: null,
    deactivatedBy: null,
  }
  customers.push(customer)
  addHistory(customer.id, { action: 'CREATED', changedFields: [], userName: currentUserName(), createdAt: now })
  return structuredClone(customer)
}

// PUT /api/customers/{id} → 200
export async function updateCustomer(id: number, request: CustomerRequest): Promise<Customer> {
  await wait(800)
  validateOnServer(request)
  const customer = findOr404(id)

  // O back descobre o que mudou para gravar no AuditLog
  const changed: string[] = []
  if (customer.name !== request.name.trim()) changed.push('name')
  if (customer.type !== request.type) changed.push('type')
  if (customer.phone !== request.phone) changed.push('phone')
  if (customer.whatsapp !== request.whatsapp) changed.push('whatsapp')
  if (JSON.stringify(customer.address) !== JSON.stringify(request.address)) changed.push('address')
  if (customer.notes !== request.notes) changed.push('notes')

  Object.assign(customer, structuredClone(request), { name: request.name.trim(), updatedAt: new Date().toISOString() })
  if (changed.length > 0) {
    addHistory(id, { action: 'UPDATED', changedFields: changed, userName: currentUserName(), createdAt: customer.updatedAt })
  }
  return structuredClone(customer)
}

// PATCH /api/customers/{id}/deactivate → 200 (só ADMIN/MANAGER; o back devolve 403 para os outros)
export async function deactivateCustomer(id: number): Promise<Customer> {
  await wait(700)
  const customer = findOr404(id)
  if (customer.status === 'INACTIVE') {
    throw new ApiError(409, 'CUSTOMER_ALREADY_INACTIVE', 'Este cliente já está desativado.')
  }
  const now = new Date().toISOString()
  Object.assign(customer, { status: 'INACTIVE', deactivatedAt: now, deactivatedBy: currentUserName(), updatedAt: now })
  addHistory(id, { action: 'DEACTIVATED', changedFields: [], userName: currentUserName(), createdAt: now })
  return structuredClone(customer)
}

// PATCH /api/customers/{id}/activate → 200
export async function activateCustomer(id: number): Promise<Customer> {
  await wait(700)
  const customer = findOr404(id)
  if (customer.status === 'ACTIVE') {
    throw new ApiError(409, 'CUSTOMER_ALREADY_ACTIVE', 'Este cliente já está ativo.')
  }
  const now = new Date().toISOString()
  Object.assign(customer, { status: 'ACTIVE', deactivatedAt: null, deactivatedBy: null, updatedAt: now })
  addHistory(id, { action: 'ACTIVATED', changedFields: [], userName: currentUserName(), createdAt: now })
  return structuredClone(customer)
}
