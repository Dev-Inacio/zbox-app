import type { ReactNode } from 'react'
import { AppIcon } from './AppIcon'
import type { AppIconName } from './AppIcon'
import './Alert.css'

type AlertProps = {
  variant: 'error' | 'warning' | 'info' | 'success'
  children: ReactNode
}

// Ícone combina com o tipo do aviso (antes era sempre o alerta vermelho, até em aviso verde)
const ICON: Record<AlertProps['variant'], AppIconName> = { error: 'alert', warning: 'alert', info: 'info', success: 'check' }

export function Alert({ variant, children }: AlertProps) {
  // role="alert" faz o leitor de tela anunciar a mensagem assim que ela aparece
  return (
    <div role="alert" className={`alert alert--${variant}`}>
      <AppIcon name={ICON[variant]} size={24} className="alert__icon" />
      <span>{children}</span>
    </div>
  )
}
