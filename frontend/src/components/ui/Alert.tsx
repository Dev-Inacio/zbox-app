import type { ReactNode } from 'react'
import './Alert.css'

type AlertProps = {
  variant: 'error' | 'warning' | 'info' | 'success'
  children: ReactNode
}

export function Alert({ variant, children }: AlertProps) {
  // role="alert" faz o leitor de tela anunciar a mensagem assim que ela aparece
  return (
    <div role="alert" className={`alert alert--${variant}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="alert__icon">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 7v6" />
        <path d="M12 17h.01" />
      </svg>
      <span>{children}</span>
    </div>
  )
}
