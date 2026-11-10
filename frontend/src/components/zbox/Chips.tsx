import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import './zbox.css'

// Contador ao lado do título: "Itens (2)", "Em andamento (4)". tone="red" para pendências.
export function CountChip({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'red' }) {
  return <span className={`zb-count zb-count--${tone}`}>{children}</span>
}

// Selo de alerta vermelho com bolinha: "2 atrasados · R$ 5.200,00", "entregue há 35 dias"
export function AlertChip({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <span className="zb-alert" data-testid={testId}>
      <span className="zb-alert__dot" aria-hidden="true" />
      {children}
    </span>
  )
}

// Etiqueta neutra: "1 un", "R$ 850,00 o m²"
export function Pill({ children }: { children: ReactNode }) {
  return <span className="zb-pill">{children}</span>
}

// Link "Ver todos >" no padrão laranja. Use dentro do <Link> do router ou como <a>.
export function SeeMore({ children }: { children: ReactNode }) {
  return (
    <span className="zb-seemore">
      {children}
      <span className="zb-seemore__arrow" aria-hidden="true"><ChevronRight size={13} strokeWidth={2.25} /></span>
    </span>
  )
}
