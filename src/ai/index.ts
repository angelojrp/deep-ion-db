import { AnthropicProvider } from './anthropic'
import { OpenAIProvider } from './openai'
import type { AIProvider, AIProviderConfig, AIProviderKind } from './types'

export * from './types'

/** Modelos padrão por provedor (sempre os mais capazes/recentes). */
export const DEFAULT_MODELS: Record<AIProviderKind, string> = {
  anthropic: 'claude-opus-4-8',
  openai: 'gpt-4o'
}

/** Cria o provedor adequado. `fetchFn` é injetável para testes (mock). */
export function createProvider(
  config: AIProviderConfig,
  fetchFn: typeof fetch = fetch
): AIProvider {
  switch (config.kind) {
    case 'anthropic':
      return new AnthropicProvider(config, fetchFn)
    case 'openai':
      return new OpenAIProvider(config, fetchFn)
    default:
      throw new Error(`Provedor de IA não suportado: ${(config as AIProviderConfig).kind}`)
  }
}
