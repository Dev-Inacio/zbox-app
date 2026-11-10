import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconBadge, type IconTone } from '../ui/IconBadge'
import { SeeMore } from './Chips'
import './zbox.css'

type Props = {
  icon: LucideIcon
  tone: IconTone
  label: string            // "Pedidos em produção"
  value: ReactNode         // 2 | "R$ 15.521,50"
  hint?: string            // "+ 1 novo para começar"
  extra?: ReactNode        // ex.: <AlertChip>2 atrasados · R$ 5.200,00</AlertChip>
  linkLabel: string        // "Ver pedidos"
  href?: string
  onClick?: () => void     // abre algo na própria tela, em vez de ir para outra
  testId?: string
}

// Quadro dos "Destaques" do Início
export function StatTile({ icon, tone, label, value, hint, extra, linkLabel, href, onClick, testId }: Props) {
  const body = (
    <>
      <span className="zb-stat__head"><IconBadge icon={icon} tone={tone} size={36} /><span className="zb-stat__label">{label}</span></span>
      <span className="zb-stat__value">{value}</span>
      {hint && <span className="zb-muted">{hint}</span>}
      {extra}
      <span className="zb-stat__link"><SeeMore>{linkLabel}</SeeMore></span>
    </>
  )
  if (onClick || !href) return <button type="button" className="zb-block zb-stat" onClick={onClick} data-testid={testId}>{body}</button>
  return <Link to={href} className="zb-block zb-stat" data-testid={testId}>{body}</Link>
}
