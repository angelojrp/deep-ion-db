import { type JSX } from 'react'

export type ToastKind = 'info' | 'success' | 'error'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface Props {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}

const ICON: Record<ToastKind, string> = {
  info: 'ℹ',
  success: '✓',
  error: '✕'
}

/**
 * Pilha de notificações não bloqueantes — substitui `window.alert()`.
 * Renderizada no canto da tela; cada toast pode ser dispensado manualmente.
 */
export default function Toaster({ toasts, onDismiss }: Props): JSX.Element {
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <span className="toast-icon" aria-hidden="true">
            {ICON[t.kind]}
          </span>
          <span className="toast-message">{t.message}</span>
          <button className="toast-close" onClick={() => onDismiss(t.id)} aria-label="Fechar">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
