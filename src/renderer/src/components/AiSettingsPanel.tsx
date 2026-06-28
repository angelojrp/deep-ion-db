import { type JSX, useEffect, useState } from 'react'
import type { AIProviderKind } from '@shared/types'
import { useApi } from '../api'

const DEFAULT_MODEL: Record<AIProviderKind, string> = {
  anthropic: 'claude-opus-4-8',
  openai: 'gpt-4o'
}

const MODEL_OPTIONS: Record<AIProviderKind, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { value: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' }
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' }
  ]
}

export default function AiSettingsPanel({ onClose }: { onClose: () => void }): JSX.Element {
  const [kind, setKind] = useState<AIProviderKind>('anthropic')
  const [model, setModel] = useState(DEFAULT_MODEL.anthropic)
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [sendSchema, setSendSchema] = useState(true)
  const [sendExplain, setSendExplain] = useState(true)
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
          setSendSchema(c.sendSchema)
          setSendExplain(c.sendExplain)
        }
      })
      .catch(() => {})
  }, [api])

  function changeKind(k: AIProviderKind): void {
    setKind(k)
    setModel(DEFAULT_MODEL[k])
  }

  function isCustomModel(currentKind: AIProviderKind, currentModel: string): boolean {
    return !MODEL_OPTIONS[currentKind].some((o) => o.value === currentModel)
  }

  async function save(): Promise<void> {
    setErr(null)
    try {
      const c = await api.ai.setConfig({
        kind,
        model,
        baseUrl: baseUrl || undefined,
        apiKey: apiKey || undefined,
        sendSchema,
        sendExplain
      })
      setHasKey(c.hasKey)
      setApiKey('')
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  const modelOptions = MODEL_OPTIONS[kind]
  const isCustom = isCustomModel(kind, model)

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
            </select>
          </label>
          <label>
            Modelo
            <select
              value={isCustom ? '__custom__' : model}
              onChange={(e) => {
                if (e.target.value !== '__custom__') {
                  setModel(e.target.value)
                }
              }}
            >
              {modelOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
              <option value="__custom__">Personalizado…</option>
            </select>
          </label>
          {isCustom && (
            <label>
              Modelo personalizado
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="ex: claude-3-5-sonnet-20241022"
              />
            </label>
          )}
          <label>
            Endpoint (opcional — on-prem/compatível)
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={
                kind === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com'
              }
            />
          </label>
          <label>
            Chave de API {hasKey ? '(uma chave já está salva)' : ''}
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? '•••••• (deixe em branco para manter)' : 'cole a chave aqui'}
            />
          </label>
          <fieldset style={{ border: 'none', padding: 0, margin: '8px 0 0' }}>
            <legend style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
              Privacidade — contexto enviado à IA
            </legend>
            <label
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={sendSchema}
                onChange={(e) => setSendSchema(e.target.checked)}
              />
              Enviar schema/DDL como contexto
            </label>
            <label
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={sendExplain}
                onChange={(e) => setSendExplain(e.target.checked)}
              />
              Enviar plano de EXPLAIN como contexto
            </label>
            <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Nunca são enviadas linhas/dados das suas tabelas — apenas estrutura e metadados.
            </p>
          </fieldset>
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
