import { type JSX, type MutableRefObject, useEffect, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { format as formatSql } from 'sql-formatter'
import type { DbKind } from '@shared/types'

export interface SqlEditorApi {
  /** Texto a executar: seleção, ou statement sob o cursor, ou tudo. */
  getRunText: () => string
  /** Formata (pretty-print) o conteúdo conforme o dialeto. */
  format: () => void
}

interface Props {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  onSave?: () => void
  dialect?: DbKind
  theme?: string
  apiRef?: MutableRefObject<SqlEditorApi | null>
}

function mapDialect(
  kind: DbKind | undefined
): 'postgresql' | 'mysql' | 'sqlite' | 'transactsql' | 'sql' {
  if (kind === 'postgres') return 'postgresql'
  if (kind === 'mysql') return 'mysql'
  if (kind === 'sqlite') return 'sqlite'
  if (kind === 'mssql') return 'transactsql'
  return 'sql'
}

/** Retorna o statement (delimitado por ;) que contém o offset do cursor. */
function statementAt(text: string, offset: number): string {
  let start = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ';') {
      if (offset <= i) return text.slice(start, i).trim()
      start = i + 1
    }
  }
  return text.slice(start).trim()
}

export default function SqlEditor({
  value,
  onChange,
  onRun,
  onSave,
  dialect,
  theme = 'vs-dark',
  apiRef
}: Props): JSX.Element {
  const onRunRef = useRef(onRun)
  const onSaveRef = useRef(onSave)
  const dialectRef = useRef(dialect)
  useEffect(() => {
    onRunRef.current = onRun
    onSaveRef.current = onSave
    dialectRef.current = dialect
  }, [onRun, onSave, dialect])

  const handleMount: OnMount = (editor, monaco) => {
    const api: SqlEditorApi = {
      getRunText: () => {
        const model = editor.getModel()
        if (!model) return ''
        const sel = editor.getSelection()
        if (sel && !sel.isEmpty()) return model.getValueInRange(sel)
        const full = model.getValue()
        const pos = editor.getPosition() ?? { lineNumber: 1, column: 1 }
        return statementAt(full, model.getOffsetAt(pos)) || full
      },
      format: () => {
        try {
          editor.setValue(
            formatSql(editor.getValue(), { language: mapDialect(dialectRef.current) })
          )
        } catch {
          /* dialeto/SQL não formatável — ignora */
        }
      }
    }
    if (apiRef) apiRef.current = api

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current())
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSaveRef.current?.())
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () =>
      api.format()
    )
  }

  return (
    <Editor
      height="100%"
      language="sql"
      theme={theme}
      value={value}
      onChange={(v) => onChange(v ?? '')}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        automaticLayout: true,
        scrollBeyondLastLine: false,
        tabSize: 2
      }}
    />
  )
}
