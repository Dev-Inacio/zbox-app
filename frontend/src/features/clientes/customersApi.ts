import { apiFetch } from '../auth/http'
import type {
  Address,
  Customer,
  CustomerHistoryItem,
  CustomerRequest,
  CustomerSummary,
  ListCustomersParams,
  Page,
} from './types'

// Clientes: API REAL (/api/customers, publicada pelo Inácio) — contrato em docs/contrato-api-clientes.md.
// Sem mock e sem dados de exemplo: tudo vem do banco.

const EMPTY_ADDRESS: Address = { zipCode: null, street: null, number: null, complement: null, district: null, city: null, state: null }

// O back devolve address = null quando o cliente não tem endereço; a tela sempre espera o objeto
function withAddress(c: Customer): Customer {
  return { ...c, address: c.address ?? EMPTY_ADDRESS }
}

// GET /api/customers?search=&status=ACTIVE&type=&page=0&size=20
// Busca só a partir de 2 letras; "todos os tipos" = sem o parâmetro type (o back não aceita ALL)
export function listCustomers(p: ListCustomersParams): Promise<Page<CustomerSummary>> {
  return apiFetch('/api/customers', {
    query: { search: p.search.trim().length >= 2 ? p.search.trim() : null, status: p.status, type: p.type === 'ALL' ? null : p.type, page: p.page, size: p.size },
  })
}

// GET /api/customers/{id}
export async function getCustomer(id: number): Promise<Customer> {
  return withAddress(await apiFetch<Customer>(`/api/customers/${id}`))
}

// GET /api/customers/{id}/history
export function getCustomerHistory(id: number): Promise<CustomerHistoryItem[]> {
  return apiFetch(`/api/customers/${id}/history`)
}

// GET /api/customers/duplicates?phone=&whatsapp=&excludeId=
export function findDuplicates(phone: string | null, whatsapp: string | null, excludeId?: number): Promise<CustomerSummary[]> {
  return apiFetch('/api/customers/duplicates', { query: { phone, whatsapp, excludeId } })
}

// POST /api/customers → 201
export async function createCustomer(request: CustomerRequest): Promise<Customer> {
  return withAddress(await apiFetch<Customer>('/api/customers', { method: 'POST', body: request }))
}

// PUT /api/customers/{id}
export async function updateCustomer(id: number, request: CustomerRequest): Promise<Customer> {
  return withAddress(await apiFetch<Customer>(`/api/customers/${id}`, { method: 'PUT', body: request }))
}

// PATCH /api/customers/{id}/deactivate (só ADMIN/MANAGER; o back devolve 403 para os outros)
export async function deactivateCustomer(id: number): Promise<Customer> {
  return withAddress(await apiFetch<Customer>(`/api/customers/${id}/deactivate`, { method: 'PATCH' }))
}

// PATCH /api/customers/{id}/activate
export async function activateCustomer(id: number): Promise<Customer> {
  return withAddress(await apiFetch<Customer>(`/api/customers/${id}/activate`, { method: 'PATCH' }))
}
