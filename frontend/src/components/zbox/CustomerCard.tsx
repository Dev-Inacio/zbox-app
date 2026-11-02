import { MapPin, MessageCircle, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { IconBadge } from '../ui/IconBadge'
import { SeeMore } from './Chips'
import { InfoBlock, InfoList } from './InfoBlocks'
import './zbox.css'

type Props = {
  name: string
  phone: string | null
  street: string | null          // "Rua das Palmeiras, 108 · Jardim Amanda"
  cityState: string | null       // "Hortolândia/SP"
  customerHref: string           // "/clientes/9"
  addressLabel?: string          // "Endereço da obra" no pedido
  onWhatsApp?: () => void        // abre o WhatsApp; nunca envia sozinho
}

const initials = (name: string) => name.trim().split(/\s+/).filter((_, i, a) => i === 0 || i === a.length - 1).map((p) => p[0]).join('').toUpperCase()

// Card "Cliente" no detalhe do pedido
export function CustomerCard({ name, phone, street, cityState, customerHref, addressLabel = 'Endereço', onWhatsApp }: Props) {
  return (
    <section className="zb-card" aria-labelledby="t-cliente">
      <h2 id="t-cliente" className="zb-card__title zb-card__title--sm">Cliente</h2>
      <div className="zb-cust">
        <div className="zb-cust__who">
          <span className="zb-avatar" aria-hidden="true">{initials(name)}</span>
          <span className="zb-cust__names">
            <span className="zb-cust__name">{name}</span>
            <Link to={customerHref} className="zb-link"><SeeMore>Ver cadastro e outros pedidos</SeeMore></Link>
          </span>
        </div>
        {phone && onWhatsApp && (
          <button type="button" className="zb-btn" onClick={onWhatsApp}>
            <IconBadge icon={MessageCircle} tone="whatsapp" size={28} />WhatsApp
          </button>
        )}
      </div>
      <InfoList columns={2}>
        {phone && <InfoBlock icon={Phone} label="Celular"><span className="zb-strong">{phone}</span></InfoBlock>}
        {street && (
          <InfoBlock icon={MapPin} label={addressLabel}>
            <span className="zb-strong">{street}</span>
            {cityState && <span className="zb-muted">{cityState}</span>}
          </InfoBlock>
        )}
      </InfoList>
    </section>
  )
}
