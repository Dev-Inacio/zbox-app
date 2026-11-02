import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import './zbox.css'

// Bloco claro com ícone cinza + rótulo pequeno + valor. Usado em "Dados do cliente" e no card Cliente do pedido.
export function InfoBlock({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <li className="zb-block zb-info">
      <span className="zb-info__icon" aria-hidden="true"><Icon size={16} /></span>
      <span className="zb-info__body">
        <span className="zb-info__label">{label}</span>
        {children}
      </span>
    </li>
  )
}

export function InfoList({ children, columns = 1 }: { children: ReactNode; columns?: 1 | 2 }) {
  return <ul className={`zb-blocks${columns === 2 ? ' zb-blocks--2' : ''}`}>{children}</ul>
}
