import { useId } from 'react'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import './Input.css'

// ComponentPropsWithRef<'input'>: todos os atributos de um <input>, inclusive `ref` (React 19)
type InputProps = ComponentPropsWithRef<'input'> & {
  label: string
  error?: string           // mensagem de erro (HU02). Se existir, o campo fica inválido
  endAdornment?: ReactNode // algo dentro do campo, à direita (ex.: o olhinho)
}

export function Input({ label, error, endAdornment, id, className = '', ...rest }: InputProps) {
  // useId gera um id único quando ninguém passa um. Evita dois campos com o mesmo id na página.
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-erro`

  const classes = ['field__input', endAdornment ? 'field__input--with-end' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="field">
      <label htmlFor={inputId} className="field__label">
        {label}
      </label>

      <div className="field__control">
        <input
          id={inputId}
          className={classes}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...rest}
        />
        {endAdornment && <div className="field__end">{endAdornment}</div>}
      </div>

      {error && (
        <p id={errorId} className="field__error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 7v6" />
            <path d="M12 17h.01" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}
