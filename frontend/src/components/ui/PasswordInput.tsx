import { useState } from 'react'
import type { ComponentPropsWithRef } from 'react'
import { Input } from './Input'
import './PasswordInput.css'

type PasswordInputProps = Omit<ComponentPropsWithRef<'input'>, 'type'> & {
  label: string
  error?: string
}

export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  const toggle = (
    <button
      type="button" // "button" para NÃO enviar o formulário ao clicar no olho
      className="password-toggle"
      aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
      aria-pressed={visible}
      onClick={() => setVisible((v) => !v)}
    >
      {/* Olho fechado = senha escondida; olho aberto = senha à mostra */}
      <svg className={`password-eye${visible ? ' is-open' : ''}`} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <g className="password-eye__open">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </g>
        <g className="password-eye__closed">
          <path d="M3 10c2.4 3.4 5.4 5 9 5s6.6-1.6 9-5" />
          <path d="M12 15v3M6.5 13.2l-1.7 2.4M17.5 13.2l1.7 2.4" />
        </g>
      </svg>
    </button>
  )

  return <Input {...props} type={visible ? 'text' : 'password'} endAdornment={toggle} />
}
