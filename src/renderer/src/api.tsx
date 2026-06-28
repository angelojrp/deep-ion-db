import { type JSX, type ReactNode, createContext, useContext } from 'react'
import type { AppApi, Capabilities } from '@shared/types'

/**
 * Contexto da arquitetura unificada (desktop + web): a UI consome `api` e
 * `capabilities` injetados pelo ambiente, em vez de acessar `window.api` direto.
 * Electron injeta `window.api` + capabilities de desktop; o web injeta um cliente
 * HTTP + capabilities de web. Recursos são mostrados/ocultados por capability.
 */
interface ApiContextValue {
  api: AppApi
  caps: Capabilities
}

const ApiContext = createContext<ApiContextValue | null>(null)

export function ApiProvider({
  api,
  caps,
  children
}: {
  api: AppApi
  caps: Capabilities
  children: ReactNode
}): JSX.Element {
  return <ApiContext.Provider value={{ api, caps }}>{children}</ApiContext.Provider>
}

function useApiContext(): ApiContextValue {
  const ctx = useContext(ApiContext)
  if (!ctx) throw new Error('ApiProvider ausente: a UI precisa de api + capabilities injetados.')
  return ctx
}

/** A API de dados injetada (DbApi/ConnApi/WsApi/HistApi/AiApi). */
export function useApi(): AppApi {
  return useApiContext().api
}

/** As capacidades do ambiente atual (desktop ou web). */
export function useCaps(): Capabilities {
  return useApiContext().caps
}

/** Capabilities do app desktop (Electron): acesso local completo. */
export const DESKTOP_CAPABILITIES: Capabilities = {
  adHocConnections: true,
  managedDataSources: false,
  workspaceFiles: true,
  backup: true,
  sessions: true,
  roles: true,
  health: true,
  jobs: true,
  erDiagram: true,
  schemaDiff: true,
  editableGrid: true,
  history: true,
  ai: true,
  exportResults: true,
  serverMode: true
}
