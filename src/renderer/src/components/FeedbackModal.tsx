import { type JSX, useState } from 'react'

const REPO = 'angelojrp/deep-ion-db'

const CATEGORIES = [
  { value: 'enhancement', label: 'Sugestão de melhoria' },
  { value: 'bug', label: 'Relatar um bug' },
  { value: 'question', label: 'Dúvida / pergunta' }
]

const BODY_HINTS: Record<string, string> = {
  enhancement: `## O que você gostaria de ver?\n\n<!-- descreva a funcionalidade ou melhoria -->\n\n## Por que isso seria útil?\n\n`,
  bug: `## O que aconteceu?\n\n<!-- descreva o comportamento incorreto -->\n\n## Passos para reproduzir\n\n1. \n2. \n\n## Comportamento esperado\n\n`,
  question: `<!-- descreva sua dúvida -->\n`
}

interface Props {
  onClose: () => void
}

export default function FeedbackModal({ onClose }: Props): JSX.Element {
  const [category, setCategory] = useState('enhancement')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState(BODY_HINTS['enhancement']!)

  function handleCategoryChange(val: string): void {
    setCategory(val)
    setBody(BODY_HINTS[val] ?? '')
  }

  function openIssue(): void {
    const params = new URLSearchParams({
      title: title.trim() || '(sem título)',
      body,
      labels: category
    })
    const url = `https://github.com/${REPO}/issues/new?${params.toString()}`
    window.open(url, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal feedback-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(560px, 92vw)' }}
      >
        <div className="modal-head">
          <strong>Enviar feedback</strong>
          <button className="ghost-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="feedback-form">
          <label>
            Tipo
            <select value={category} onChange={(e) => handleCategoryChange(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Título
            <input
              placeholder="Resumo em uma linha…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </label>

          <label>
            Descrição
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Detalhe o máximo possível…"
            />
          </label>

          <p className="feedback-hint">
            Ao clicar em <strong>Abrir no GitHub</strong>, uma nova aba será aberta com os campos
            pré-preenchidos. Você poderá revisar antes de enviar.
          </p>

          <div className="toolbar">
            <button className="run-btn" onClick={openIssue} disabled={!title.trim()}>
              Abrir no GitHub
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
