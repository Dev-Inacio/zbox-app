import { ApiError } from './types'
import type { ApiErrorBody, LoginRequest, LoginResponse } from './types'

// Chave do mock: true = simulação local; false = chama o back de verdade (POST /api/auth/login).
// Troque para false quando o endpoint do Inácio estiver no ar.
const USE_MOCK = false

export function login(request: LoginRequest): Promise<LoginResponse> {
  return USE_MOCK ? mockLogin(request) : apiLogin(request)
}

// ---------- API real ----------
// Em desenvolvimento, o Vite repassa /api para o Spring Boot (ver vite.config.ts).
async function apiLogin(request: LoginRequest): Promise<LoginResponse> {
  // Se o servidor estiver fora do ar, o fetch lança TypeError e a tela mostra "Não foi possível conectar"
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  const text = await response.text()
  const body = parseJson(text)

  if (response.ok) {
    // Formato do contrato: { accessToken, tokenType, expiresIn, user }
    if (body && typeof body === 'object' && 'accessToken' in body) return body as LoginResponse
    // ⚠️ PROVISÓRIO: hoje o back devolve só o token (texto puro), sem os dados do usuário.
    // Montamos o resto aqui até o back seguir o contrato. Aí este trecho pode ser apagado.
    return fromRawToken(text, request.email.trim()) // request.email = o usuário digitado
  }

  // Erro no formato padrão do ZBOX: a tela decide a mensagem pelo `code`, nunca pelo texto
  const error = body as ApiErrorBody | null
  // ⚠️ PROVISÓRIO: o back ainda responde 401 com texto, sem `code`; 401 no login = credencial errada
  const code = error?.code ?? (response.status === 401 ? 'INVALID_CREDENTIALS' : 'UNKNOWN_ERROR')
  throw new ApiError(response.status, code, error?.message ?? 'Erro inesperado no servidor.', error?.fieldErrors)
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// O nome mostrado é o próprio usuário ("thayna@zbox.com.br" → "thayna"). O papel é ADMIN porque o back hoje dá ROLE_ADMIN para todos.
function fromRawToken(token: string, username: string): LoginResponse {
  return {
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn: 0, // desconhecido: o back ainda não informa
    user: { id: 0, name: username.split('@')[0], email: username, role: 'ADMIN' },
  }
}

// ---------- ⚠️ SIMULAÇÃO (mock) ----------
// Responde exatamente nos formatos do contrato.
//
// Usuários de teste:
//   thayna      + senha "zbox1234" → sucesso (ADMIN)
//   funcionario + senha "zbox1234" → sucesso (EMPLOYEE)
//   bloqueado                     → 423 ACCOUNT_LOCKED
//   offline                       → falha de rede
//   qualquer outro                → 401 INVALID_CREDENTIALS

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function mockLogin(request: LoginRequest): Promise<LoginResponse> {
  await wait(900) // simula o tempo da rede, para dar para ver o "Entrando…"

  const username = request.email.trim().toLowerCase() // o campo "email" leva o usuário

  if (username === 'offline') {
    throw new TypeError('Failed to fetch') // é assim que o fetch avisa falha de rede
  }

  if (username === 'bloqueado') {
    throw new ApiError(423, 'ACCOUNT_LOCKED', 'Muitas tentativas. Tente novamente em 15 minutos.')
  }

  if (username === 'thayna' && request.password === 'zbox1234') {
    return {
      accessToken: 'mock-access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: 1, name: 'Thayná', email: 'thayna@zbox.com.br', role: 'ADMIN' },
    }
  }

  // Perfil EMPLOYEE: para testar o que funcionário NÃO pode fazer (ex.: desativar cliente)
  if (username === 'funcionario' && request.password === 'zbox1234') {
    return {
      accessToken: 'mock-access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: 2, name: 'Carlos', email: 'funcionario@zbox.com.br', role: 'EMPLOYEE' },
    }
  }

  throw new ApiError(401, 'INVALID_CREDENTIALS', 'Usuário ou senha inválidos.')
}
