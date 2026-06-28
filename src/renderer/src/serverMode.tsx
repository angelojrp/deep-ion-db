import { type JSX, type ReactNode, createContext, useContext } from 'react'

/**
 * Contexto do modo servidor (#123), provido pelo entrypoint do desktop.
 * A UI compartilhada (Sidebar) usa-o para oferecer "Conectar ao servidor" e
 * "Desconectar". É opcional: no web o provider não existe (retorna null).
 */
export interface ServerModeValue {
  mode: 'local' | 'server'
  /** Rótulo da sessão de servidor conectada (quando em modo servidor). */
  serverLabel: string | null
  /** Abre a tela de conexão a servidor. */
  open: () => void
  /** Volta ao modo local (desconecta do servidor). */
  disconnect: () => void
}

const ServerModeContext = createContext<ServerModeValue | null>(null)

export function ServerModeProvider({
  value,
  children
}: {
  value: ServerModeValue
  children: ReactNode
}): JSX.Element {
  return <ServerModeContext.Provider value={value}>{children}</ServerModeContext.Provider>
}

/** Retorna o controle do modo servidor, ou null fora do desktop. */
export function useServerMode(): ServerModeValue | null {
  return useContext(ServerModeContext)
}
