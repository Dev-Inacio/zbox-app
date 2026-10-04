import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import './ButtonVariants.css'
import './ConfirmDialog.css'

// Janela de confirmação. Usa o <dialog> nativo do navegador, que já:
// - prende o foco dentro da janela (Tab não "foge" para a página de trás)
// - fecha com Esc
// - devolve o foco para o botão que abriu, ao fechar

type ConfirmDialogProps = {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
  loading?: boolean
  loadingText?: string
  confirmDisabled?: boolean // ex.: enquanto falta escolher o motivo
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open, title, children, confirmLabel, cancelLabel = 'Cancelar',
  variant = 'primary', loading = false, loadingText, confirmDisabled = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  // Sincroniza o <dialog> com a prop `open`
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc: o navegador fecharia sozinho. Seguramos para o React controlar.
        event.preventDefault()
        if (!loading) onCancel()
      }}
    >
      <h2 id={titleId} className="confirm-dialog__title">{title}</h2>
      <div className="confirm-dialog__body">{children}</div>
      <div className="confirm-dialog__actions">
        <Button className="btn--secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          className={variant === 'danger' ? 'btn--danger' : ''}
          onClick={onConfirm}
          disabled={confirmDisabled}
          loading={loading}
          loadingText={loadingText}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
