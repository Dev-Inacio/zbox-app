// Tipos que espelham o contrato da API de autenticação.
// Se o contrato mudar, muda aqui primeiro, e o TypeScript aponta tudo o que quebrou.

export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE'

export type LoginRequest = {
  email: string
  password: string
}

export type AuthUser = {
  id: number
  name: string
  email: string
  role: Role
}

export type LoginResponse = {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
  user: AuthUser
}

export type FieldError = {
  field: string
  code: string
  message: string
}

// Formato padrão de erro do ZBOX
export type ApiErrorBody = {
  timestamp: string
  status: number
  code: string
  message: string
  path: string
  fieldErrors?: FieldError[]
}

// Erro que veio da API, com o `code` do contrato
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: FieldError[]

  constructor(status: number, code: string, message: string, fieldErrors: FieldError[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}
