import { ApiError } from './types'
import type { LoginRequest, LoginResponse } from './types'

// ⚠️ SIMULAÇÃO (mock), enquanto o back não publica POST /api/auth/login.
// Responde nos formatos do contrato, para a troca pela API real ser só aqui.
//
// E-mails de teste:
//   thayna@zbox.com.br  + senha "zbox1234" → sucesso
//   bloqueado@zbox.com.br                  → 423 ACCOUNT_LOCKED
//   offline@zbox.com.br                    → falha de rede
//   qualquer outro                         → 401 INVALID_CREDENTIALS

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function login(request: LoginRequest): Promise<LoginResponse> {
  await wait(900) // simula o tempo da rede, para dar para ver o "Entrando…"

  const email = request.email.trim().toLowerCase()

  if (email === 'offline@zbox.com.br') {
    throw new TypeError('Failed to fetch') // é assim que o fetch avisa falha de rede
  }

  if (email === 'bloqueado@zbox.com.br') {
    throw new ApiError(423, 'ACCOUNT_LOCKED', 'Muitas tentativas. Tente novamente em 15 minutos.')
  }

  if (email === 'thayna@zbox.com.br' && request.password === 'zbox1234') {
    return {
      accessToken: 'mock-access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: 1, name: 'Thayná', email, role: 'ADMIN' },
    }
  }

  throw new ApiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.')
}
