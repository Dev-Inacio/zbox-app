import type { Role } from '../auth/types'

// HU23 RN06: só ADMIN e MANAGER estornam pagamento.
// A tela só ESCONDE o botão. Quem BLOQUEIA de verdade é o back (403 FORBIDDEN).
export function canReversePayment(role: Role | undefined): boolean {
  return role === 'ADMIN' || role === 'MANAGER'
}
