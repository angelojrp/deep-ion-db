import { type JSX, useEffect, useMemo, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { renderMarkdown } from '../markdown'

type Mode = 'edit' | 'split' | 'preview'

interface Props {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  theme?: string
}

export default function MarkdownView({
  value,
  onChange,
  onSave,
  theme = 'vs-dark'
}: Props): JSX.Element {
  const [mode, setMode] = useState<Mode>('split')
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  const html = useMemo(() => renderMarkdown(value), [value])

  const handleMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSaveRef.current())
  }

  return (
    <div className="md-view">
      <div className="md-toolbar">
        <div className="seg">
          <button className={mode === 'edit' ? 'on' : ''} onClick={() => setMode('edit')}>
            Editor
          </button>
          <button className={mode === 'split' ? 'on' : ''} onClick={() => setMode('split')}>
            Dividido
          </button>
          <button className={mode === 'preview' ? 'on' : ''} onClick={() => setMode('preview')}>
            Preview
          </button>
        </div>
        <button onClick={onSave} title="Salvar (Ctrl/Cmd + S)">
          Salvar
        </button>
      </div>
      <div className={`md-body mode-${mode}`}>
        {mode !== 'preview' && (
          <div className="md-edit">
            <Editor
              height="100%"
              language="markdown"
              theme={theme}
              value={value}
              onChange={(v) => onChange(v ?? '')}
              onMount={handleMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false
              }}
            />
          </div>
        )}
        {mode !== 'edit' && (
          <div className="md-preview markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </div>
  )
}
