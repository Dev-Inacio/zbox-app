import type { PieceType } from '../../assets/pecas/pieceTypes'
// Tipos que espelham o contrato da API de Orçamentos (docs/contrato-api-orcamentos.md).
//
// Regra de ouro do dinheiro: na API todo valor em reais vai em CENTAVOS (número inteiro).
//   R$ 1.500,00 → 150000
// Medidas vão em CENTÍMETROS (inteiro): 1,20 m → 120.
// Assim ninguém soma 0,1 + 0,2 e ganha 0,30000000000000004.

export type QuoteStatus = 'DRAFT' | 'CONFIRMED' | 'SENT' | 'APPROVED' | 'REJECTED' | 'CANCELED' | 'SUPERSEDED'

// UNIT: quantidade × preço de cada peça (o que o editor usa). AREA (por m²) fica só para itens antigos.
export type ChargeType = 'UNIT' | 'AREA'

export type ItemUnit = 'un' | 'pç' | 'conj' | 'm' | 'kg'

export type DiscountType = 'PERCENT' | 'AMOUNT'

export type DispatchChannel = 'WHATSAPP' | 'PDF' | 'PRINT'

export type ApprovalMethod = 'WHATSAPP' | 'IN_PERSON' | 'PHONE'

export type RejectionReason = 'PRICE' | 'DEADLINE' | 'CHOSE_COMPETITOR' | 'GAVE_UP' | 'OTHER'

// Item como o front ENVIA (sem subtotal: quem calcula é o back)
// Decisão da PO (11/10): o preço é o que a pessoa digita (por peça). O sistema NÃO calcula por m².
// Largura e altura são só a medida da peça (saem no PDF). Itens antigos ainda podem vir como AREA.
export type QuoteItemRequest = {
  description: string
  pieceType?: PieceType | null // desenho do PDF (sem tipo: "Outra peça")
  details?: string | null     // detalhe curto que sai no PDF: cor, acessórios… (até 80 caracteres)
  chargeType: ChargeType
  quantity: number            // peças (inteiro, 1 a 9.999)
  unit: ItemUnit | null       // só para UNIT; em AREA é sempre m²
  widthCm: number | null      // medida da peça (opcional em UNIT)
  heightCm: number | null
  unitPriceCents: number      // UNIT: preço de cada peça | AREA (antigo): preço por m²
}

// Item como o back DEVOLVE (com os valores calculados por ele)
export type QuoteItem = QuoteItemRequest & {
  id: number
  areaPerPieceCm2: number | null // largura × altura, em cm²
  subtotalCents: number
}

export type QuoteCustomer = {
  id: number
  name: string
  whatsapp: string | null
  phone: string | null
  addressLine: string | null // "Rua das Palmeiras, 108 · Jardim Amanda · Hortolândia/SP"
}

export type QuoteEvent = {
  id: number
  type: 'CREATED' | 'UPDATED' | 'CONFIRMED' | 'BACK_TO_DRAFT' | 'DISPATCHED' | 'APPROVED' | 'REJECTED' | 'CANCELED' | 'NEW_VERSION' | 'CONVERTED'
  version: number
  detail: string | null // ex.: "WHATSAPP", "Preço: achou caro", "R$ 3.363,00"
  userName: string
  createdAt: string
}

// Um orçamento numa versão específica (GET /api/quotes/{id} devolve a versão atual)
export type Quote = {
  id: number
  number: string            // "000129"
  version: number           // 1, 2, 3…
  latestVersion: number
  status: QuoteStatus
  customer: QuoteCustomer
  items: QuoteItem[]
  subtotalCents: number
  discountType: DiscountType | null
  discountValue: number | null // PERCENT: em centésimos de % (5% = 500) | AMOUNT: em centavos
  discountCents: number
  totalCents: number
  paymentTerms: string | null
  notes: string | null
  versionReason: string | null
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
  sentAt: string | null
  decidedAt: string | null // aprovado/recusado/cancelado
  approvalMethod: ApprovalMethod | null
  rejectionReason: RejectionReason | null
  decisionNote: string | null
  // Aprovado que já virou pedido (HU19). Um orçamento vira UM pedido só.
  order: { id: number; number: string } | null
  // HU32 — Venda direta: o cliente já fechou, o orçamento não foi enviado (vira pedido na hora)
  directSale?: boolean
  events: QuoteEvent[]
}

// PUT /api/quotes/{id} — só funciona em RASCUNHO. Note: NÃO tem total.
export type QuoteRequest = {
  items: QuoteItemRequest[]
  discountType: DiscountType | null
  discountValue: number | null
  paymentTerms: string | null
  notes: string | null
}

export type QuoteSummary = {
  id: number
  number: string
  version: number
  customerName: string
  createdAt: string
  totalCents: number
  status: QuoteStatus
  statusAt?: string | null    // quando entrou na situação atual
  orderNumber?: string | null // pedido gerado por este orçamento
}

export type QuoteStatusFilter = Exclude<QuoteStatus, 'SUPERSEDED'> | 'ALL'

export type QuotePeriod = 'ALL' | 'LAST_30' | 'LAST_90'

export type ListQuotesParams = {
  search: string
  status: QuoteStatusFilter
  period: QuotePeriod
  customerId?: number
  page: number
  size: number
}

export type QuoteCounts = Record<Exclude<QuoteStatusFilter, 'ALL'>, number> & { ALL: number }
