import './monaco-setup'
import React, { type JSX, useCallback, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ApiProvider, DESKTOP_CAPABILITIES } from './api'
import { SERVER_CAPABILITIES, createServerApi } from './serverApi'
import { ServerModeProvider, type ServerModeValue } from './serverMode'
import ServerConnect from './components/ServerConnect'
import { UiProvider } from './ui'
import './styles.css'

interface Session {
  serverUrl: string
  label: string
}

/**
 * Entrypoint do desktop (#123): por padrão injeta `window.api` (acesso local
 * via IPC). Em "modo servidor", injeta um `serverApi` sobre HTTP — a mesma UI,
 * sem alterações. A troca acontece pela tela ServerConnect.
 */
function Root(): JSX.Element {
  const [session, setSession] = useState<Session | null>(null)
  const [showConnect, setShowConnect] = useState(false)
  const tokenRef = useRef<string | null>(null)

  const enterServer = useCallback(async (serverUrl: string, label: string): Promise<void> => {
    tokenRef.current = await window.serverAuth.token(serverUrl)
    setSession({ serverUrl, label })
    setShowConnect(false)
  }, [])

  const disconnect = useCallback((): void => {
    setSession(null)
    tokenRef.current = null
    setShowConnect(false)
  }, [])

  const serverApi = useMemo(() => {
    if (!session) return null
    return createServerApi({
      serverUrl: session.serverUrl,
      getToken: () => tokenRef.current,
      // 401: token expirou — reabre o login para o servidor atual.
      onUnauthorized: () => setShowConnect(true)
    })
  }, [session])

  const serverMode: ServerModeValue = useMemo(
    () => ({
      mode: session ? 'server' : 'local',
      serverLabel: session?.label ?? null,
      open: () => setShowConnect(true),
      disconnect
    }),
    [session, disconnect]
  )

  const api = serverApi ?? window.api
  const caps = serverApi ? SERVER_CAPABILITIES : DESKTOP_CAPABILITIES

  return (
    <ServerModeProvider value={serverMode}>
      <ApiProvider api={api} caps={caps}>
        <UiProvider>
          {/* key força recarregar conexões ao alternar local/servidor. */}
          <App key={session?.serverUrl ?? 'local'} />
        </UiProvider>
      </ApiProvider>
      {showConnect && (
        <ServerConnect onConnected={enterServer} onCancel={() => setShowConnect(false)} />
      )}
    </ServerModeProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
