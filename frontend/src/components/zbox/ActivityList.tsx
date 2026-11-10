import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { IconBadge, type IconTone } from '../ui/IconBadge'
import './zbox.css'

export type Activity = { id: number | string; icon: LucideIcon; tone: IconTone; title: string; subtitle?: string; when: string; to?: string }

// Histórico (cliente, pedido, orçamento) e "Últimas atividades" do Início
export function ActivityList({ items }: { items: Activity[] }) {
  return (
    <ol className="zb-activity">
      {items.map((a) => (
        <li key={a.id}>
          <IconBadge icon={a.icon} tone={a.tone} size={32} />
          <span className="zb-activity__body">
            {a.to ? <Link to={a.to} className="zb-strong zb-activity__link">{a.title}</Link> : <span className="zb-strong">{a.title}</span>}
            {a.subtitle && <span className="zb-muted">{a.subtitle}</span>}
          </span>
          <span className="zb-muted zb-activity__when">{a.when}</span>
        </li>
      ))}
    </ol>
  )
}
