import type { ApprovalMethod, QuoteStatus, RejectionReason } from './types'

// Textos da tela para os códigos da API. Um lugar só: se a PO mudar um nome, muda aqui.

export const STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: 'Rascunho',
  CONFIRMED: 'Confirmado',
  SENT: 'Enviado',
  APPROVED: 'Aprovado',
  REJECTED: 'Recusado',
  CANCELED: 'Cancelado',
  SUPERSEDED: 'Substituído',
}

export const APPROVAL_LABEL: Record<ApprovalMethod, string> = {
  WHATSAPP: 'Pelo WhatsApp',
  IN_PERSON: 'Pessoalmente',
  PHONE: 'Por telefone',
}

export const REJECTION_LABEL: Record<RejectionReason, string> = {
  PRICE: 'Preço',
  DEADLINE: 'Prazo',
  CHOSE_COMPETITOR: 'Fechou com outro',
  GAVE_UP: 'Desistiu',
  OTHER: 'Outro',
}

export const PAYMENT_SHORTCUTS = ['À vista no PIX', '50% de entrada e 50% na entrega', 'Cartão em até 10x']
