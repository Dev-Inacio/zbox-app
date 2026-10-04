// Tipos que espelham o contrato da API de Clientes (docs/contrato-api-clientes.md).
// Se o contrato mudar, muda aqui primeiro, e o TypeScript aponta tudo o que quebrou.

export type CustomerType = 'PERSON' | 'COMPANY' // Pessoa física | Empresa
export type CustomerStatus = 'ACTIVE' | 'INACTIVE'

// Telefone, WhatsApp e CEP trafegam SÓ com números ("19998124410").
// A máscara "(19) 99812-4410" é coisa da tela.
export type Address = {
  zipCode: string | null
  street: string | null
  number: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null // UF com 2 letras
}

// Item da lista (GET /api/customers): só o que a tabela mostra
export type CustomerSummary = {
  id: number
  name: string
  type: CustomerType | null
  phone: string | null
  whatsapp: string | null
  city: string | null
  state: string | null
  status: CustomerStatus
}

// Detalhe (GET /api/customers/{id})
export type Customer = {
  id: number
  name: string
  type: CustomerType | null
  phone: string | null
  whatsapp: string | null
  address: Address
  notes: string | null
  status: CustomerStatus
  createdAt: string // ISO 8601
  updatedAt: string
  deactivatedAt: string | null
  deactivatedBy: string | null // nome de quem desativou
}

// Corpo do POST e do PUT. Só "name" é obrigatório.
export type CustomerRequest = {
  name: string
  type: CustomerType | null
  phone: string | null
  whatsapp: string | null
  address: Address
  notes: string | null
}

// Página no formato do Spring (Page<T>)
export type Page<T> = {
  content: T[]
  page: number // começa em 0
  size: number
  totalElements: number
  totalPages: number
}

export type StatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL'

export type ListCustomersParams = {
  search: string
  status: StatusFilter
  type: CustomerType | 'ALL'
  page: number
  size: number
}

// Histórico (GET /api/customers/{id}/history): vem do AuditLog
export type CustomerHistoryAction = 'CREATED' | 'UPDATED' | 'DEACTIVATED' | 'ACTIVATED'

export type CustomerHistoryItem = {
  id: number
  action: CustomerHistoryAction
  changedFields: string[] // ex.: ["whatsapp"] quando action = UPDATED
  userName: string
  createdAt: string
}
