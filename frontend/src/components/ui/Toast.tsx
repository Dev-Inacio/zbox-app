import { useEffect } from 'react'
import { AppIcon } from './AppIcon'
import './Toast.css'

// Mensagem de sucesso que some sozinha depois de alguns segundos.
// role="status": o leitor de tela anuncia sem interromper o que a pessoa está fazendo.

type ToastProps = {
  message: string | null
  onClose: () => void
  duration?: number
}

export function Toast({ message, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [message, onClose, duration])

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {message && (
        <div className="toast">
          <span className="toast__icon" aria-hidden="true">
            <AppIcon name="check" size={16} />
          </span>
          <span className="toast__text">{message}</span>
          <button type="button" className="toast__close" aria-label="Fechar mensagem" onClick={onClose}>
            <AppIcon name="close" size={24} />
          </button>
        </div>
      )}
    </div>
  )
}
