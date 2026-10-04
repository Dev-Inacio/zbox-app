import type { Role } from '../auth/types'
import { maskPhone } from '../clientes/format'
import type { Company } from './types'

// HU26: ADMIN e MANAGER alteram os dados da empresa. A tela só desabilita; quem bloqueia é o back (403).
export function canEditCompany(role: Role | undefined): boolean {
  return role === 'ADMIN' || role === 'MANAGER'
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  EMPLOYEE: 'Funcionário',
}

// "Rua das Indústrias, 250 · Centro · Hortolândia/SP"
export function companyAddressLine(c: Company): string {
  const a = c.address
  const street = [a.street, a.number].filter(Boolean).join(', ')
  const streetFull = [street, a.complement].filter(Boolean).join(' - ')
  const city = [a.city, a.state].filter(Boolean).join('/')
  return [streetFull, a.district, city].filter(Boolean).join(' · ')
}

// Linha de contato do cabeçalho do orçamento: WhatsApp · telefone · endereço
export function companyContactLine(c: Company): string {
  return [c.whatsapp ? maskPhone(c.whatsapp) : null, c.phone ? maskPhone(c.phone) : null, companyAddressLine(c) || null].filter(Boolean).join(' · ')
}
