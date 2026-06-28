/** Camada de integração com provedores de IA (épico #3, issue #24). */

export type AIProviderKind = 'anthropic' | 'openai'

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AIChatOptions {
  system?: string
  maxTokens?: number
}

export interface AIProviderConfig {
  kind: AIProviderKind
  apiKey: string
  model: string
  /** Endpoint custom (on-prem / compatível). Opcional. */
  baseUrl?: string
}

/** Contrato comum implementado por cada adaptador de provedor. */
export interface AIProvider {
  readonly kind: AIProviderKind
  /** Envia uma conversa e retorna o texto da resposta. */
  chat(messages: AIMessage[], opts?: AIChatOptions): Promise<string>
  /**
   * Envia uma conversa em modo streaming, chamando `onToken` a cada fragmento
   * recebido. Suporte opcional: provedores que não implementam podem omitir.
   */
  chatStream?(
    messages: AIMessage[],
    onToken: (token: string) => void,
    opts?: AIChatOptions,
    signal?: AbortSignal
  ): Promise<void>
}

/** Configuração pública (sem a chave) exposta ao renderer. */
export interface AIPublicConfig {
  kind: AIProviderKind
  model: string
  baseUrl?: string
  hasKey: boolean
}
