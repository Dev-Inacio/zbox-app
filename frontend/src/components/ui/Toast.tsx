import { useEffect } from 'react'
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M5 12l5 5 9-10" />
            </svg>
          </span>
          <span className="toast__text">{message}</span>
          <button type="button" className="toast__close" aria-label="Fechar mensagem" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
