/// <reference types="vite/client" />
import type { AppApi, ServerAuthApi } from '@shared/types'

declare global {
  interface Window {
    api: AppApi
    serverAuth: ServerAuthApi
  }
}

export {}
