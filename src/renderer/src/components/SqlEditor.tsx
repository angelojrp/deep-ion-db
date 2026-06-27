import { type JSX, useEffect, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'

interface Props {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  onSave?: () => void
}

export default function SqlEditor({ value, onChange, onRun, onSave }: Props): JSX.Element {
  // Mantém a referência das últimas callbacks para evitar closure obsoleta nos atalhos.
  const onRunRef = useRef(onRun)
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    onRunRef.current = onRun
    onSaveRef.current = onSave
  }, [onRun, onSave])

  const handleMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current())
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSaveRef.current?.())
  }

  return (
    <Editor
      height="100%"
      language="sql"
      theme="vs-dark"
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
