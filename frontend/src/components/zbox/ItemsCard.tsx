import { useId, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { money } from './money'
import './zbox.css'

export type ItemView = {
  id: number
  description: string
  details?: string | null      // "2 peças de 1,20 × 1,00 m" — opcional (nem todo item tem medida)
  quantityLabel: string        // "1 un", "2,40 m²"
  unitPriceLabel: string       // "R$ 1.500,00 cada", "R$ 850,00 o m²"
  totalCents: number           // vem do back
}

type Props = {
  items: ItemView[]
  versionLabel?: string        // "Do orçamento #000120 v1" ou "Versão v1"
  collapseAfter?: number       // 5 por padrão; passe Infinity na Revisão (lista sempre completa)
}

// Card "Itens" — só itens. Subtotal/desconto/total ficam no card de Valores/Pagamento.
export function ItemsCard({ items, versionLabel, collapseAfter = 5 }: Props) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const hidden = Math.max(0, items.length - collapseAfter)
  const visible = open || hidden === 0 ? items : items.slice(0, collapseAfter)

  return (
    <section className="zv-card" aria-labelledby={`${listId}-t`}>
      <div className="zv-card__head">
        <div>
          <h2 id={`${listId}-t`} className="zv-h2">Itens</h2>
          <p className="zv-sub">{versionLabel ?? (items.length === 1 ? '1 item' : `${items.length} itens`)}</p>
        </div>
      </div>

      <ol id={listId} className="zv-items">
        {visible.map((it, i) => (
          <li key={it.id} data-testid="item-linha">
            <span className="zv-items__n" aria-hidden="true">{i + 1}</span>
            <span className="zv-items__info">
              <b>{it.description}</b>
              {it.details && <span>{it.details}</span>}
              <span>{it.quantityLabel} × {it.unitPriceLabel}</span>
            </span>
            <b className="zv-items__value">{money(it.totalCents)}</b>
          </li>
        ))}
      </ol>

      {hidden > 0 && (
        <button type="button" className="zb-expand" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)} data-testid="ver-mais-itens">
          {open ? 'Mostrar menos' : `Ver mais ${hidden} ${hidden === 1 ? 'item' : 'itens'}`}
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      )}
    </section>
  )
}
