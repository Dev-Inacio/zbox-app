import type { ItemView } from '../../components/zbox'
import { formatAreaM2, formatMeters, formatMoney, formatPercent } from './money'
import type { DiscountType, QuoteItem } from './types'

// Item do orçamento/pedido no formato do card "Itens": detalhes + medida numa linha só; sem medida, não aparece.
export function toItemView(item: QuoteItem): ItemView {
  const measure = item.widthCm && item.heightCm ? `Medida ${formatMeters(item.widthCm)} × ${formatMeters(item.heightCm)} m` : null
  const area = item.chargeType === 'AREA'
  return {
    id: item.id,
    description: item.description,
    details: [measure, item.details].filter(Boolean).join(' · ') || null,
    quantityLabel: area ? `${formatAreaM2((item.areaPerPieceCm2 ?? 0) * item.quantity)} m²` : `${item.quantity} ${item.unit ?? 'un'}`,
    unitPriceLabel: `${formatMoney(item.unitPriceCents)}${area ? ' o m²' : ''}`,
    totalCents: item.subtotalCents,
  }
}

// "5%" quando o desconto é percentual
export function discountLabel(type: DiscountType | null, value: number | null): string | null {
  return type === 'PERCENT' && value ? `${formatPercent(value)}%` : null
}
