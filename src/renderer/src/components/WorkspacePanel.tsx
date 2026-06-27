import { type JSX, useState } from 'react'
import type { Workspace, WsEntry } from '@shared/types'

interface Props {
  workspace: Workspace | null
  onOpen: () => void
  onRefresh: () => void
  onOpenFile: (entry: WsEntry) => void
  onNewFile: (dir: string) => void
  onDelete: (entry: WsEntry) => void
}

function baseName(p: string): string {
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1] || p
}

export default function WorkspacePanel({
  workspace,
  onOpen,
  onRefresh,
  onOpenFile,
  onNewFile,
  onDelete
}: Props): JSX.Element {
  return (
    <div className="ws-panel">
      <div className="explorer-head">
        <span className="section-title">Workspace</span>
        <span className="head-actions">
          {workspace && (
            <>
              <button
                className="icon-btn"
                title="Novo arquivo na raiz"
                onClick={() => onNewFile(workspace.root)}
              >
                ＋
              </button>
              <button className="icon-btn" title="Recarregar" onClick={onRefresh}>
                ⟳
              </button>
            </>
          )}
          <button className="icon-btn" title="Abrir pasta" onClick={onOpen}>
            📁
          </button>
        </span>
      </div>

      {!workspace ? (
        <div className="explorer-empty">
          Nenhuma pasta aberta.{' '}
          <button className="linklike" onClick={onOpen}>
            Abrir pasta…
          </button>
        </div>
      ) : (
        <>
          <div className="ws-root" title={workspace.root}>
            {baseName(workspace.root)}
          </div>
          {workspace.tree.length === 0 && (
            <div className="explorer-empty">Sem arquivos .sql/.md aqui.</div>
          )}
          {workspace.tree.map((e) => (
            <WsNode
              key={e.path}
              entry={e}
              onOpenFile={onOpenFile}
              onNewFile={onNewFile}
              onDelete={onDelete}
            />
          ))}
        </>
      )}
    </div>
  )
}

function WsNode({
  entry,
  onOpenFile,
  onNewFile,
  onDelete
}: {
  entry: WsEntry
  onOpenFile: (entry: WsEntry) => void
  onNewFile: (dir: string) => void
  onDelete: (entry: WsEntry) => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(true)

  if (entry.type === 'dir') {
    return (
      <div className="node">
        <div className="node-row" onClick={() => setExpanded((e) => !e)}>
          <span className="caret">{expanded ? '▾' : '▸'}</span>
          <span className="node-label">
            <span className="ic">📁</span>
            {entry.name}
          </span>
          <span className="node-actions">
            <button
              className="link"
              title="Novo arquivo"
              onClick={(ev) => {
                ev.stopPropagation()
                onNewFile(entry.path)
              }}
            >
              ＋
            </button>
          </span>
        </div>
        {expanded && (
          <div className="children">
            {(entry.children ?? []).map((c) => (
              <WsNode
                key={c.path}
                entry={c}
                onOpenFile={onOpenFile}
                onNewFile={onNewFile}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const isMd = /\.(md|markdown)$/i.test(entry.name)
  return (
    <div className="node">
      <div className="node-row leaf" onClick={() => onOpenFile(entry)} title={entry.path}>
        <span className="caret-spacer" />
        <span className="node-label">
          <span className="ic">{isMd ? '📝' : '🗎'}</span>
          {entry.name}
        </span>
        <span className="node-actions">
          <button
            className="link"
            title="Excluir"
            onClick={(ev) => {
              ev.stopPropagation()
              onDelete(entry)
            }}
          >
            ×
          </button>
        </span>
      </div>
    </div>
  )
}
