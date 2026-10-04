// Tipos que espelham o contrato da API de Orçamentos (docs/contrato-api-orcamentos.md).
//
// Regra de ouro do dinheiro: na API todo valor em reais vai em CENTAVOS (número inteiro).
//   R$ 1.500,00 → 150000
// Medidas vão em CENTÍMETROS (inteiro): 1,20 m → 120.
// Assim ninguém soma 0,1 + 0,2 e ganha 0,30000000000000004.

export type QuoteStatus = 'DRAFT' | 'CONFIRMED' | 'SENT' | 'APPROVED' | 'REJECTED' | 'CANCELED' | 'SUPERSEDED'

export type ChargeType = 'UNIT' | 'AREA' // por unidade | por m²

export type ItemUnit = 'un' | 'pç' | 'conj' | 'm' | 'kg'

export type DiscountType = 'PERCENT' | 'AMOUNT'

export type DispatchChannel = 'WHATSAPP' | 'PDF' | 'PRINT'

export type ApprovalMethod = 'WHATSAPP' | 'IN_PERSON' | 'PHONE'

export type RejectionReason = 'PRICE' | 'DEADLINE' | 'CHOSE_COMPETITOR' | 'GAVE_UP' | 'OTHER'

// Item como o front ENVIA (sem subtotal: quem calcula é o back)
export type QuoteItemRequest = {
  description: string
  chargeType: ChargeType
  quantity: number            // peças (inteiro, 1 a 9.999)
  unit: ItemUnit | null       // só para UNIT; em AREA é sempre m²
  widthCm: number | null      // só para AREA
  heightCm: number | null     // só para AREA
  unitPriceCents: number      // preço por unidade ou por m²
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
