import { useId } from 'react'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { NoAutofill } from './NoAutofill'
import { AppIcon } from './AppIcon'
import './Input.css'

// ComponentPropsWithRef<'input'>: todos os atributos de um <input>, inclusive `ref` (React 19)
type InputProps = ComponentPropsWithRef<'input'> & {
  label: string
  error?: string           // mensagem de erro (HU02). Se existir, o campo fica inválido
  endAdornment?: ReactNode // algo dentro do campo, à direita (ex.: o olhinho)
  noAutofill?: boolean     // campo de cadastro: o Chrome não oferece salvar (ver NoAutofill). Login NÃO usa.
}

export function Input({ noAutofill = false, ...props }: InputProps) {
  return noAutofill ? <NoAutofill><InputField {...props} /></NoAutofill> : <InputField {...props} />
}

function InputField({ label, error, endAdornment, id, className = '', ...rest }: Omit<InputProps, 'noAutofill'>) {
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
          // Padrão "off": o Chrome não oferece salvar endereço/dados na conta Google.
          // Quem precisa (login: "username", "current-password") passa outro valor e ele vale (vem depois, no rest)
          autoComplete="off"
          {...rest}
        />
        {endAdornment && <div className="field__end">{endAdornment}</div>}
      </div>

      {error && (
        <p id={errorId} className="field__error">
          <AppIcon name="alert" size={16} />
          {error}
        </p>
      )}
    </div>
  )
}
