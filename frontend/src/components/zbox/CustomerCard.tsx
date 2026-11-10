import { useCallback } from 'react'
import { ChevronRight, FileText, MapPin, MessageCircle, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getCustomer } from '../../features/clientes/customersApi'
import { customerMobile, formatDate, maskCep, maskPhone, onlyDigits, typeLabel } from '../../features/clientes/format'
import type { QuoteCustomer } from '../../features/orcamentos/types'
import { listOrders } from '../../features/pedidos/ordersApi'
import { useRequest } from '../../hooks/useRequest'
import './zbox.css'

const initials = (name: string) => name.trim().split(/\s+/).filter((_, i, a) => i === 0 || i === a.length - 1).map((p) => p[0]).join('').toUpperCase()

// Card "Cliente" do orçamento e do pedido.
// Celular, tipo, observação e CEP vêm do cadastro ATUAL; o endereço é o guardado no orçamento ou no pedido.
export function CustomerCard({ customer, addressLabel = 'Endereço da obra' }: { customer: QuoteCustomer; addressLabel?: string }) {
  const fetchCustomer = useCallback(() => getCustomer(customer.id), [customer.id])
  const current = useRequest(`cartao-cliente|${customer.id}`, fetchCustomer).data
  const fetchOrders = useCallback(() => listOrders({ search: '', status: 'ALL', payment: 'ALL', customerId: customer.id, page: 0, size: 1 }), [customer.id])
  const orderCount = useRequest(`cartao-pedidos|${customer.id}`, fetchOrders).data?.totalElements

  const mobile = current ? customerMobile(current) : customerMobile(customer)
  const digits = mobile ? onlyDigits(mobile) : ''
  const meta = [
    current?.type ? typeLabel(current.type) : null,
    current ? `cliente desde ${formatDate(current.createdAt)}` : null,
    orderCount === undefined ? null : orderCount === 1 ? '1 pedido' : `${orderCount} pedidos`,
  ].filter(Boolean).join(' · ')
  // O CEP só entra se o cadastro ainda for o mesmo endereço guardado aqui
  const street = current?.address.street
  const zipCode = street && customer.addressLine?.includes(street) ? current?.address.zipCode : null
  const address = customer.addressLine ? [customer.addressLine, zipCode ? `CEP ${maskCep(zipCode)}` : null].filter(Boolean).join(' · ') : null
  const mapQuery = customer.addressLine?.replace(/ · /g, ', ')

  return (
    <section className="zv-card zb-client" aria-labelledby="t-cliente">
      <h2 id="t-cliente" className="zv-h2">Cliente</h2>
      <div className="zb-client__who">
        <span className="oc-avatar" aria-hidden="true">{initials(customer.name)}</span>
        <span className="zb-client__names">
          <b>{customer.name}</b>
          {meta && <span>{meta}</span>}
        </span>
        <Link to={`/clientes/${customer.id}`} className="zv-link">Ver cadastro<ChevronRight size={18} aria-hidden="true" /></Link>
      </div>

      <div className="zb-client__row">
        <span className="zv-data__icon"><Phone size={20} strokeWidth={1.8} aria-hidden="true" /></span>
        <span className="zb-client__text"><span>Celular e WhatsApp</span><b>{mobile ? maskPhone(mobile) : 'Não cadastrado'}</b></span>
        {mobile && (
          <span className="zb-client__acts">
            <a className="zv-btn zv-btn--sm" href={`tel:+55${digits}`}><Phone size={18} strokeWidth={1.8} aria-hidden="true" />Ligar</a>
            <a className="zv-btn zv-btn--sm" href={`https://wa.me/55${digits}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} strokeWidth={1.8} aria-hidden="true" />WhatsApp</a>
          </span>
        )}
      </div>

      <div className="zb-client__row">
        <span className="zv-data__icon"><MapPin size={20} strokeWidth={1.8} aria-hidden="true" /></span>
        <span className="zb-client__text"><span>{addressLabel}</span><b>{address ?? 'Não cadastrado'}</b></span>
        {mapQuery && (
          <span className="zb-client__acts">
            <a className="zv-btn zv-btn--sm" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noopener noreferrer"><MapPin size={18} strokeWidth={1.8} aria-hidden="true" />Abrir no mapa</a>
          </span>
        )}
      </div>

      {current?.notes && (
        <div className="zb-client__row">
          <span className="zv-data__icon"><FileText size={20} strokeWidth={1.8} aria-hidden="true" /></span>
          <span className="zb-client__text"><span>Observação do cliente</span><b>{current.notes}</b></span>
        </div>
      )}
    </section>
  )
}
