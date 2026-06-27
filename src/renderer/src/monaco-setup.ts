import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { loader } from '@monaco-editor/react'

// Carrega o Monaco localmente (sem CDN) e configura o worker do editor.
self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker()
  }
}

loader.config({ monaco })
