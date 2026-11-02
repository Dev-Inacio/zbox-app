import { demoFetch } from './demoApi'
import { readAccessToken } from './session'
import { ApiError } from './types'
import type { ApiErrorBody } from './types'

// Chamada ao back (Spring Boot). Todo endpoint integrado passa por aqui:
//   - manda o token do login no cabeçalho Authorization
//   - devolve o JSON já convertido
//   - erro vira ApiError com o `code` do contrato (a tela decide a mensagem pelo code, nunca pelo texto)
//   - 401 (token vencido ou inválido): avisa o AuthProvider, que tira a pessoa do sistema com recado
// Em desenvolvimento, o Vite repassa /api para o back (ver vite.config.ts).
// Se o servidor estiver fora do ar, o fetch lança TypeError e as telas mostram "Não foi possível conectar".

export const UNAUTHORIZED_EVENT = 'zbox:unauthorized'

type Query = Record<string, string | number | null | undefined>

function withQuery(path: string, query?: Query): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `${path}?${text}` : path
}

export async function apiFetch<T>(path: string, options: { method?: string; body?: unknown; query?: Query } = {}): Promise<T> {
  if (import.meta.env.VITE_DEMO === 'true') return demoFetch(path, options.method ?? 'GET', options.body, options.query) as Promise<T>

  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = readAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(withQuery(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const text = await response.text()
  const body = text ? parseJson(text) : null

  if (response.ok) return body as T

  if (response.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  const error = body as ApiErrorBody | null
  const code = error?.code ?? (response.status === 403 ? 'FORBIDDEN' : response.status === 404 ? 'NOT_FOUND' : 'UNKNOWN_ERROR')
  throw new ApiError(response.status, code, error?.message ?? 'Erro inesperado no servidor.', error?.fieldErrors)
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
