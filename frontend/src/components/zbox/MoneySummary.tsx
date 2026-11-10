import { money } from './money'
import './zbox.css'

type Props = {
  subtotalCents: number
  discountCents: number
  discountLabel?: string | null  // "5%" quando percentual
  totalCents: number
  totalLabel?: string            // "Total do pedido" (Pagamento) | "Total" (orçamento)
  big?: boolean                  // total grande (orçamento); no Pagamento use false
}

// Conta do pedido/orçamento: Subtotal, Desconto (verde), Total. Valores SEMPRE do back.
export function MoneySummary({ subtotalCents, discountCents, discountLabel, totalCents, totalLabel = 'Total', big = false }: Props) {
  return (
    <dl className="zb-sum">
      <div><dt>Subtotal</dt><dd>{money(subtotalCents)}</dd></div>
      {discountCents > 0 && (
        <div className="zb-sum__discount"><dt>Desconto{discountLabel ? ` (${discountLabel})` : ''}</dt><dd>− {money(discountCents)}</dd></div>
      )}
      <div className={`zb-sum__total${big ? ' zb-sum__total--big' : ''}`} data-testid="total">
        <dt>{totalLabel}</dt><dd>{money(totalCents)}</dd>
      </div>
    </dl>
  )
}
