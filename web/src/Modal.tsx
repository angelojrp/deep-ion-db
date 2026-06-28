import { type JSX, type ReactNode, useEffect, useRef } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
}

export function Modal({ title, onClose, children, width = 560 }: ModalProps): JSX.Element {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="modal-dialog" style={{ maxWidth: width }}>
        <div className="modal-dialog-header">
          <h3 className="modal-dialog-title">{title}</h3>
          <button className="modal-close-btn" onClick={onClose} title="Fechar (Esc)">
            ✕
          </button>
        </div>
        <div className="modal-dialog-body">{children}</div>
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export function ConfirmModal({
  title,
  description,
  confirmLabel = 'Confirmar',
  onConfirm,
  onCancel,
  danger = false
}: ConfirmModalProps): JSX.Element {
  return (
    <Modal title={title} onClose={onCancel} width={420}>
      <p className="confirm-description">{description}</p>
      <div className="admin-form-actions">
        <button className={danger ? 'run-btn danger-run-btn' : 'run-btn'} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button className="ghost-btn" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
