import type { ChargeType, DiscountType } from './types'

// ============================================================
// REGRAS DE DINHEIRO DO ORÇAMENTO (HU14)
// ------------------------------------------------------------
// - Tudo em CENTAVOS e CENTÍMETROS (inteiros). Nunca float.
// - Arredondamento: 2 casas, metade para cima (HALF_UP), no
//   subtotal de cada item e no desconto em %.
// - A TELA usa estas funções só para mostrar o cálculo ao vivo.
//   O BACK recalcula tudo com BigDecimal e é a autoridade.
//   Se os dois divergirem, vale o back (e é bug para o QA abrir!).
// ============================================================

// Divide arredondando metade para cima (só para valores ≥ 0)
function divHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n)
}

// Área de UMA peça, em cm² (1,20 m × 1,00 m = 120 × 100 = 12.000 cm² = 1,20 m²)
export function areaCm2(widthCm: number, heightCm: number): number {
  return widthCm * heightCm
}

type ItemForCalc = {
  chargeType: ChargeType
  quantity: number
  widthCm: number | null
  heightCm: number | null
  unitPriceCents: number
}

// Subtotal do item, em centavos
//   UNIT: quantidade × preço
//   AREA: quantidade × (largura × altura) × preço por m²  (÷ 10.000 porque cm² → m²)
// BigInt: 9.999 peças × 2.000 cm × 2.000 cm × R$ 99 mil passa do limite seguro do Number.
export function itemSubtotalCents(item: ItemForCalc): number {
  const qty = BigInt(item.quantity)
  const price = BigInt(item.unitPriceCents)
  if (item.chargeType === 'UNIT') return Number(qty * price)
  const area = BigInt(areaCm2(item.widthCm ?? 0, item.heightCm ?? 0))
  return Number(divHalfUp(qty * area * price, 10000n))
}

export function subtotalCents(items: ItemForCalc[]): number {
  return items.reduce((sum, item) => sum + itemSubtotalCents(item), 0)
}

// Desconto em centavos.
//   PERCENT: discountValue em centésimos de % (5% = 500; 12,5% = 1250)
//   AMOUNT:  discountValue em centavos
export function discountCents(subtotal: number, type: DiscountType | null, value: number | null): number {
  if (!type || !value || value <= 0) return 0
  if (type === 'PERCENT') return Number(divHalfUp(BigInt(subtotal) * BigInt(value), 10000n))
  return value
}

export type DiscountError = 'NEGATIVE' | 'PERCENT_OVER_100' | 'GREATER_THAN_SUBTOTAL' | null

export function validateDiscount(subtotal: number, type: DiscountType | null, value: number | null): DiscountError {
  if (!type || value === null) return null
  if (value < 0) return 'NEGATIVE'
  if (type === 'PERCENT' && value > 10000) return 'PERCENT_OVER_100'
  if (type === 'AMOUNT' && value > subtotal) return 'GREATER_THAN_SUBTOTAL'
  return null
}

// ---------- Formatação e leitura (pt-BR) ----------

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// 336300 → "R$ 3.363,00"
export function formatMoney(cents: number): string {
  return brl.format(cents / 100).replace(/ /g, ' ')
}

// 120 → "1,20"
export function formatMeters(cm: number): string {
  return (cm / 100).toFixed(2).replace('.', ',')
}

// 12000 cm² → "1,20"  (m² com 2 casas para mostrar; a conta usa cm² exato)
export function formatAreaM2(cm2: number): string {
  return (cm2 / 10000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

// 500 → "5"  |  1250 → "12,5"
export function formatPercent(hundredths: number): string {
  return (hundredths / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

// "1.500,00" / "1500" / "R$ 1.500,5" → 150050. Texto inválido → null.
// Aceita no máximo 2 casas depois da vírgula (3 casas = inválido: "preço com 3 casas" é cenário de QA).
export function parseDecimalToHundredths(text: string): number | null {
  const clean = text.replace(/R\$|\s|%|m²?/g, '').replace(/\./g, '')
  if (clean === '') return null
  if (!/^\d+(,\d{1,2})?$/.test(clean)) return null
  const [int, dec = ''] = clean.split(',')
  return Number(int) * 100 + Number(dec.padEnd(2, '0'))
}

// Enquanto a pessoa digita o preço: só números, vira "1.500,00" da direita para a esquerda
export function maskMoneyInput(text: string): string {
  const digits = text.replace(/\D/g, '').replace(/^0+/, '').slice(0, 11)
  if (digits === '') return ''
  const cents = Number(digits)
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
