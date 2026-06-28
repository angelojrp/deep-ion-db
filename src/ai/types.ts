/** Camada de integração com provedores de IA (épico #3, issue #24). */

export type AIProviderKind = 'anthropic' | 'openai' | 'gemini' | 'local'

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
}

/** Configuração pública (sem a chave) exposta ao renderer. */
export interface AIPublicConfig {
  kind: AIProviderKind
  model: string
  baseUrl?: string
  hasKey: boolean
}
