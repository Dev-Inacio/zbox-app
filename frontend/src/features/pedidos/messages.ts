import { formatMoney } from '../orcamentos/money'
import { formatDay, todayIso } from './dates'

// Quem será cobrado (vem do pedido, da linha do Financeiro ou do Início)
export type CollectTarget = {
  id: number
  number: string
  customerName: string
  customerWhatsapp: string | null
  remainingCents: number
  deliveredOn?: string | null
}

// Mensagem de cobrança (HU24). Educada, com o valor que falta. A pessoa pode editar antes de enviar.
export function collectionMessage(t: CollectTarget): string {
  const first = t.customerName.split(' ')[0]
  const when = t.deliveredOn ? `, entregue ${t.deliveredOn === todayIso() ? 'hoje' : `em ${formatDay(t.deliveredOn)}`}` : ''
  return `Olá, ${first}! Tudo bem? Passando para lembrar do pedido nº ${t.number} da ZBOX${when}.\nFicou faltando ${formatMoney(t.remainingCents)}.\nSe já pagou, pode desconsiderar. Qualquer dúvida, estamos à disposição.`
}
