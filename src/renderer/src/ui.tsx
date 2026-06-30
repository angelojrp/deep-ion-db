import {
  type JSX,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
} from 'react'
import ConfirmModal, { type ConfirmOptions } from './components/ConfirmModal'
import Toaster, { type ToastItem, type ToastKind } from './components/Toaster'

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

export interface UiValue {
  /** Abre um modal de confirmação; resolve `true` se confirmado, `false` se cancelado. */
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>
  /** Exibe uma notificação não bloqueante (toast). */
  toast: (message: string, kind?: ToastKind) => void
}

const UiContext = createContext<UiValue | null>(null)

const TOAST_TTL = 5000

/**
 * Provider de UI transversal: confirmações (modal) e notificações (toasts),
 * substituindo `window.confirm()`/`window.alert()` — não suportados/bloqueantes
 * no Electron com sandbox. Deve envolver a árvore do `App`.
 */
export function UiProvider({ children }: { children: ReactNode }): JSX.Element {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, kind, message }])
      setTimeout(() => dismiss(id), TOAST_TTL)
    },
    [dismiss]
  )

  const confirm = useCallback(
    (opts: ConfirmOptions | string) =>
      new Promise<boolean>((resolve) => {
        const norm = typeof opts === 'string' ? { message: opts } : opts
        setPending({ ...norm, resolve })
      }),
    []
  )

  const settle = useCallback((ok: boolean) => {
    setPending((p) => {
      p?.resolve(ok)
      return null
    })
  }, [])

  const value = useMemo<UiValue>(() => ({ confirm, toast }), [confirm, toast])

  return (
    <UiContext.Provider value={value}>
      {children}
      {pending && (
        <ConfirmModal
          title={pending.title}
          message={pending.message}
          confirmLabel={pending.confirmLabel}
          cancelLabel={pending.cancelLabel}
          danger={pending.danger}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </UiContext.Provider>
  )
}

function useUi(): UiValue {
  const ctx = useContext(UiContext)
  if (!ctx) throw new Error('useUi precisa estar dentro de <UiProvider>')
  return ctx
}

/** Hook para confirmações (modal sim/não). */
export function useConfirm(): UiValue['confirm'] {
  return useUi().confirm
}

/** Hook para notificações não bloqueantes (toasts). */
export function useToast(): UiValue['toast'] {
  return useUi().toast
}
