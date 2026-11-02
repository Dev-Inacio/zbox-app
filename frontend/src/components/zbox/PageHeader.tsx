import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import './zbox.css'

// Topo de cada página: voltar (com texto), título grande, subtítulo e ações à direita.
export function PageHeader({ title, subtitle, back, actions, tags }: { title: string; subtitle?: ReactNode; back?: { to: string; label: string }; actions?: ReactNode; tags?: ReactNode }) {
  return (
    <header className="zb-ph">
      {back && <Link to={back.to} className="zb-ph__back"><ChevronLeft size={20} aria-hidden="true" />{back.label}</Link>}
      <div className="zb-ph__row">
        <div className="zb-ph__text">
          <div className="zb-ph__titleline"><h1 className="zb-ph__title">{title}</h1>{tags}</div>
          {subtitle && <p className="zb-ph__sub">{subtitle}</p>}
        </div>
        {actions && <div className="zb-ph__actions">{actions}</div>}
      </div>
    </header>
  )
}
