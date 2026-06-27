import { type JSX } from 'react'

export interface TabInfo {
  id: string
  title: string
  dirty?: boolean
}

interface Props {
  tabs: TabInfo[]
  activeId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
}

export default function Tabs({ tabs, activeId, onSelect, onClose, onNew }: Props): JSX.Element {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <div
          key={t.id}
          className={'tab' + (t.id === activeId ? ' active' : '')}
          onClick={() => onSelect(t.id)}
          title={t.title}
        >
          <span className="tab-title">
            {t.dirty ? '● ' : ''}
            {t.title}
          </span>
          <button
            className="tab-close"
            title="Fechar aba"
            onClick={(e) => {
              e.stopPropagation()
              onClose(t.id)
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button className="tab-new" title="Nova aba" onClick={onNew}>
        ＋
      </button>
    </div>
  )
}
