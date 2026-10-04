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
      {visible ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 3l18 18" />
          <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1" />
          <path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  )

  return <Input {...props} type={visible ? 'text' : 'password'} endAdornment={toggle} />
}
