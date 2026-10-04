import type { CustomerType } from './types'

// Funções de exibição. Nenhuma regra de negócio aqui: só como mostrar na tela.

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

// "19998124410" → "(19) 99812-4410" | "1932417788" → "(19) 3241-7788"
// Funciona enquanto a pessoa digita: "1999" → "(19) 99"
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  const ddd = d.slice(0, 2)
  const rest = d.slice(2)
  if (rest.length <= 4) return `(${ddd}) ${rest}`
  // 11 dígitos = celular (5 + 4); até 10 = fixo (4 + 4)
  const split = d.length === 11 ? 5 : 4
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`
}

// "13087460" → "13087-460"
export function maskCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export function typeLabel(type: CustomerType | null): string {
  if (type === 'PERSON') return 'Pessoa física'
  if (type === 'COMPANY') return 'Empresa'
  return 'Tipo não informado'
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso)).replace(',', '')
}

// Link do WhatsApp: abre a conversa, NÃO envia nada sozinho
export function whatsappLink(digits: string): string {
  return `https://wa.me/55${onlyDigits(digits)}`
}
