import { type JSX, useState } from 'react'

interface Props {
  /** Título exibido no cabeçalho do modal. */
  title: string
  /** Rótulo do campo de entrada. */
  label?: string
  /** Placeholder do campo de entrada. */
  placeholder?: string
  /** Valor inicial do campo. */
  initialValue?: string
  /** Texto do botão de confirmação. */
  confirmLabel?: string
  /** Chamado com o valor digitado ao confirmar (string não vazia). */
  onSubmit: (value: string) => void
  /** Chamado ao cancelar/fechar sem confirmar. */
  onClose: () => void
}

/**
 * Modal de entrada de texto — substitui `window.prompt()`, que não é suportado
 * no Electron com `sandbox`/`contextIsolation` ativos.
 */
export default function PromptModal({
  title,
  label,
  placeholder,
  initialValue = '',
  confirmLabel = 'OK',
  onSubmit,
  onClose
}: Props): JSX.Element {
  const [value, setValue] = useState(initialValue)
  const trimmed = value.trim()

  function confirm(): void {
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal prompt-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(440px, 92vw)' }}
      >
        <div className="modal-head">
          <strong>{title}</strong>
          <button className="ghost-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="prompt-form">
          <label>
            {label}
            <input
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirm()
                else if (e.key === 'Escape') onClose()
              }}
              autoFocus
            />
          </label>

          <div className="toolbar">
            <button className="run-btn" onClick={confirm} disabled={!trimmed}>
              {confirmLabel}
            </button>
            <button className="ghost-btn" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
