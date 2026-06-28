import { type JSX, useEffect, useState } from 'react'
import type { AIProviderKind } from '@shared/types'
import { useApi } from '../api'

const DEFAULT_MODEL: Record<AIProviderKind, string> = {
  anthropic: 'claude-opus-4-8',
  openai: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
  local: 'llama3.2'
}

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']

export default function AiSettingsPanel({ onClose }: { onClose: () => void }): JSX.Element {
  const [kind, setKind] = useState<AIProviderKind>('anthropic')
  const [model, setModel] = useState(DEFAULT_MODEL.anthropic)
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const api = useApi()

  useEffect(() => {
    api.ai
      .getConfig()
      .then((c) => {
        if (c) {
          setKind(c.kind)
          setModel(c.model)
          setBaseUrl(c.baseUrl ?? '')
          setHasKey(c.hasKey)
        }
      })
      .catch(() => {})
  }, [api])

  function changeKind(k: AIProviderKind): void {
    setKind(k)
    setModel(DEFAULT_MODEL[k])
    setBaseUrl('')
  }

  async function save(): Promise<void> {
    setErr(null)
    try {
      const c = await api.ai.setConfig({
        kind,
        model,
        baseUrl: baseUrl || undefined,
        apiKey: apiKey || undefined
      })
      setHasKey(c.hasKey)
      setApiKey('')
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const needsApiKey = kind !== 'local'
  const showBaseUrl = kind === 'openai' || kind === 'anthropic' || kind === 'local'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(520px, 92vw)' }}
      >
        <div className="modal-head">
          <strong>Configuração de IA</strong>
          <button className="icon-btn" title="Fechar" onClick={onClose}>
            ×
          </button>
        </div>
        <form
          className="conn-form"
          style={{ padding: 14 }}
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <label>
            Provedor
            <select value={kind} onChange={(e) => changeKind(e.target.value as AIProviderKind)}>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="local">Local / Ollama (OpenAI-compatible)</option>
            </select>
          </label>

          {/* Modelo */}
          {kind === 'gemini' ? (
            <label>
              Modelo
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                {GEMINI_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Modelo
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={kind === 'local' ? 'ex.: llama3.2, mistral' : ''}
              />
            </label>
          )}

          {/* Endpoint */}
          {showBaseUrl && (
            <label>
              {kind === 'local'
                ? 'URL base do servidor local'
                : 'Endpoint (opcional — on-prem/compatível)'}
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={
                  kind === 'anthropic'
                    ? 'https://api.anthropic.com'
                    : kind === 'openai'
                      ? 'https://api.openai.com'
                      : 'http://localhost:11434/v1'
                }
              />
            </label>
          )}

          {/* Chave de API */}
          {needsApiKey && (
            <label>
              Chave de API {hasKey ? '(uma chave já está salva)' : ''}
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasKey ? '•••••• (deixe em branco para manter)' : 'cole a chave aqui'}
              />
            </label>
          )}

          {/* Nota para local sem chave */}
          {kind === 'local' && !hasKey && (
            <p className="muted" style={{ fontSize: 11 }}>
              Chave de API é opcional para servidores locais (Ollama, LM Studio). Informe apenas se
              seu servidor exigir autenticação.
            </p>
          )}

          <button type="submit">Salvar</button>
          {saved && <p className="muted">Salvo ✓</p>}
          {err && <p className="form-error">{err}</p>}
          <p className="muted" style={{ fontSize: 11 }}>
            A chave é criptografada e fica apenas no processo principal — nunca é exposta à
            interface.
          </p>
        </form>
      </div>
    </div>
  )
}
