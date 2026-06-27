import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { loader } from '@monaco-editor/react'
import { registerSqlCompletion } from './sqlCompletion'

// Carrega o Monaco localmente (sem CDN) e configura o worker do editor.
self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker()
  }
}

registerSqlCompletion(monaco)
loader.config({ monaco })
