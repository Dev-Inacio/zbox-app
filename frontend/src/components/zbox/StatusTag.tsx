import type { ReactNode } from 'react'
import './zbox.css'

export type StatusTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'brand'

// Situação: ponto + palavra. Nunca só a cor (acessibilidade).
export function StatusTag({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={`zb-tag zb-tag--${tone}`}><span className="zb-tag__dot" aria-hidden="true" />{children}</span>
}
