// Vista previa en vivo del texto que se va a exportar
import { useMemo, useState } from 'react'
import type { Project } from '../types'
import { generateFocusTree, generateLocalisation, treeTag } from '../generator/focusTree'
import { generateIdeas } from '../generator/ideas'
import { planIconExport } from '../export/gfx'

type Tab = 'tree' | 'loc' | 'ideas' | 'gfx'

export default function PreviewPanel({
  project,
  treeId
}: {
  project: Project
  treeId?: string | null
}): JSX.Element {
  const [tab, setTab] = useState<Tab>('tree')
  const text = useMemo(
    () =>
      tab === 'tree'
        ? generateFocusTree(project, treeId ?? undefined)
        : tab === 'loc'
          ? generateLocalisation(project)
          : tab === 'ideas'
            ? generateIdeas(project)
            : planIconExport(project).gfx || '(sin íconos propios)',
    [project, tab, treeId]
  )
  const tabClass = (t: Tab): string =>
    `px-3 py-1 text-xs ${tab === t ? 'border-b-2 border-hoi-accent text-hoi-text' : 'text-hoi-muted'}`
  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-hoi-border">
        <button className={tabClass('tree')} onClick={() => setTab('tree')}>
          {treeTag(project, treeId ?? project.focusTrees[0]?.id ?? '')}_focus.txt
        </button>
        <button className={tabClass('loc')} onClick={() => setTab('loc')}>
          .yml
        </button>
        <button className={tabClass('ideas')} onClick={() => setTab('ideas')}>
          ideas
        </button>
        <button className={tabClass('gfx')} onClick={() => setTab('gfx')}>
          .gfx
        </button>
      </div>
      <pre className="flex-1 select-text overflow-auto whitespace-pre p-3 font-mono text-[11px] leading-snug text-emerald-200">
        {text}
      </pre>
    </div>
  )
}
