import { type JSX } from 'react'

export interface ConfirmOptions {
  /** Título no cabeçalho do modal. */
  title?: string
  /** Mensagem/pergunta exibida no corpo. */
  message: string
  /** Texto do botão de confirmação. */
  confirmLabel?: string
  /** Texto do botão de cancelamento. */
  cancelLabel?: string
  /** Estiliza a confirmação como ação destrutiva (vermelho). */
  danger?: boolean
}

interface Props extends ConfirmOptions {
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Modal de confirmação (sim/não) — substitui `window.confirm()` por uma UI
 * React consistente e estilizável. Padrão alinhado a `PromptModal`/`FeedbackModal`.
 */
export default function ConfirmModal({
  title = 'Confirmar',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel
}: Props): JSX.Element {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal confirm-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(440px, 92vw)' }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm()
          else if (e.key === 'Escape') onCancel()
        }}
      >
        <div className="modal-head">
          <strong>{title}</strong>
          <button className="ghost-btn" onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="confirm-body">
          <p className="confirm-message">{message}</p>

          <div className="toolbar">
            <button className={danger ? 'danger-btn' : 'run-btn'} onClick={onConfirm} autoFocus>
              {confirmLabel}
            </button>
            <button className="ghost-btn" onClick={onCancel}>
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
