// Vista previa en vivo del texto que se va a exportar
import { useMemo, useState } from 'react'
import type { Project } from '../types'
import { generateFocusTree, generateLocalisation } from '../generator/focusTree'

type Tab = 'tree' | 'loc'

export default function PreviewPanel({ project }: { project: Project }): JSX.Element {
  const [tab, setTab] = useState<Tab>('tree')
  const text = useMemo(
    () => (tab === 'tree' ? generateFocusTree(project) : generateLocalisation(project)),
    [project, tab]
  )
  const tabClass = (t: Tab): string =>
    `px-3 py-1 text-xs ${tab === t ? 'border-b-2 border-hoi-accent text-hoi-accent' : 'text-hoi-muted'}`
  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-hoi-border">
        <button className={tabClass('tree')} onClick={() => setTab('tree')}>
          {project.tag}_focus.txt
        </button>
        <button className={tabClass('loc')} onClick={() => setTab('loc')}>
          localización .yml
        </button>
      </div>
      <pre className="flex-1 select-text overflow-auto whitespace-pre p-3 font-mono text-[11px] leading-snug text-emerald-200">
        {text}
      </pre>
    </div>
  )
}
