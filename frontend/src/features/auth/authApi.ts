import { ApiError } from './types'
import type { ApiErrorBody, LoginRequest, LoginResponse } from './types'

// POST /api/auth/login (endpoint do back).
// Em desenvolvimento, o Vite repassa /api para o Spring Boot (ver vite.config.ts).
export async function login(request: LoginRequest): Promise<LoginResponse> {
  // Se o servidor estiver fora do ar, o fetch lança TypeError e a tela mostra "Não foi possível conectar"
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (response.ok) {
    return (await response.json()) as LoginResponse
  }

  // Erro no formato padrão do ZBOX: a tela decide a mensagem pelo `code`, nunca pelo texto
  const body = (await response.json().catch(() => null)) as ApiErrorBody | null
  throw new ApiError(
    response.status,
    body?.code ?? 'UNKNOWN_ERROR',
    body?.message ?? 'Erro inesperado no servidor.',
    body?.fieldErrors,
  )
}
