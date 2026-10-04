import type { Role } from '../auth/types'

// HU10 (aprovado pela PO): só ADMIN e MANAGER desativam/reativam cliente.
// Aqui a tela só ESCONDE o botão. Quem BLOQUEIA de verdade é o back (403 FORBIDDEN).
export function canChangeCustomerStatus(role: Role | undefined): boolean {
  return role === 'ADMIN' || role === 'MANAGER'
}
