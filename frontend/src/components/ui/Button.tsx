import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.css'

// Herda todos os atributos de um <button> normal (onClick, aria-*, etc.)
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  loading?: boolean        // HU01 RN06: bloqueia e mostra indicador
  loadingText?: string     // texto durante o loading (ex.: "Entrando…")
  fullWidth?: boolean      // ocupa a largura toda (login)
}

export function Button({
  children,
  type = 'button',
  loading = false,
  loadingText,
  fullWidth = false,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  const classes = ['btn', fullWidth ? 'btn--full' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      {loading ? (loadingText ?? children) : children}
    </button>
  )
}
