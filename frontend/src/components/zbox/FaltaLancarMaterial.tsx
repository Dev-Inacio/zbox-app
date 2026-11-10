import { Layers, Plus } from 'lucide-react'
import { IconBadge } from '../ui/IconBadge'
import { money } from './money'
import './zbox.css'

// "Gastos e lucro" quando o pedido ainda NÃO tem material (HU27): sem lucro e sem selo.
export function FaltaLancarMaterial({ totalCents, onAdd }: { totalCents: number; onAdd: () => void }) {
  return (
    <div className="zb-missing" data-testid="falta-lancar-material">
      <div className="zb-missing__box">
        <IconBadge icon={Layers} tone="slate" size={40} />
        <div>
          <p className="zb-missing__title">Falta lançar o material</p>
          <p className="zb-muted zb-missing__text">Lance quanto gastou de material para ver quanto sobrou para você.</p>
        </div>
      </div>
      <div className="zb-missing__row"><span>Valor do serviço</span><span>{money(totalCents)}</span></div>
      <button type="button" className="zb-btn zb-btn--block" onClick={onAdd} data-testid="lancar-material">
        <IconBadge icon={Plus} tone="orange" size={28} />Lançar material
      </button>
    </div>
  )
}
