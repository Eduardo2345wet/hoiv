// Importar un mod existente (solo lectura): elige su carpeta, mira qué trae y confirma.
import { useState } from 'react'
import type { Project } from '../types'
import { store } from '../store/appStore'
import { importMod, type ImportFile, type ImportReport } from '../sections/importMod'
import { Button } from './kit'

export default function ImportPanel({ project }: { project: Project }): JSX.Element {
  const [state, setState] = useState<{
    folder: string
    name: string | null
    files: ImportFile[]
    preview: ImportReport
  } | null>(null)
  const [done, setDone] = useState<ImportReport | null>(null)
  const api = window.electronAPI

  const pick = async (): Promise<void> => {
    if (!api)
      return store.toast('Importar solo está disponible en la app de escritorio.', {
        kind: 'error'
      })
    const folder = await api.selectFolder()
    if (!folder) return
    const r = await api.readModFolder(folder)
    setDone(null)
    setState({ folder, name: r.name, files: r.files, preview: importMod(project, r.files).report })
  }
  const apply = (): void => {
    if (!state) return
    let rep: ImportReport | null = null
    store.updateProject((p) => {
      const r = importMod(p, state.files)
      rep = r.report
      return r.project
    })
    setDone(rep)
    setState(null)
  }
  const Counts = ({ r }: { r: ImportReport }): JSX.Element => (
    <ul className="list-disc pl-5 text-sm">
      <li>
        {r.focusTrees} árbol(es) de focos con {r.focuses} foco(s)
      </li>
      <li>{r.events} evento(s)</li>
      <li>
        {r.categories} categoría(s) y {r.decisions} decisión(es)
      </li>
      <li>{r.ideas} espíritu(s) nacional(es)</li>
    </ul>
  )
  const Notes = ({ r }: { r: ImportReport }): JSX.Element | null =>
    r.notes.length ? (
      <div className="mt-2 max-h-48 overflow-y-auto rounded border border-hoi-border p-2 text-xs text-yellow-300">
        {r.notes.map((n, i) => (
          <p key={i}>{n}</p>
        ))}
      </div>
    ) : null
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">Importar un mod existente</h2>
      <p className="mb-3 text-xs text-hoi-muted">
        Solo lectura: se lee la carpeta del mod (focos, eventos, decisiones, espíritus y su
        localización en inglés) y se agrega a tu proyecto. Nunca se modifica la carpeta original. Lo
        que la app no entiende queda como «Avanzado (texto)» y se exporta tal cual.
      </p>
      <Button onClick={() => void pick()}>Elegir la carpeta de un mod…</Button>
      {state && (
        <div className="mt-3 rounded border border-hoi-border p-3">
          <div className="mb-1 text-sm font-semibold">
            {state.name ?? state.folder} · {state.files.length} archivo(s) leídos
          </div>
          <Counts r={state.preview} />
          <Notes r={state.preview} />
          <div className="mt-3 flex gap-2">
            <Button primary onClick={apply}>
              Importar al proyecto
            </Button>
            <Button onClick={() => setState(null)}>Cancelar</Button>
          </div>
        </div>
      )}
      {done && (
        <div className="mt-3 rounded border border-hoi-border p-3">
          <div className="mb-1 text-sm font-semibold text-green-400">Importado.</div>
          <Counts r={done} />
          <Notes r={done} />
        </div>
      )}
    </div>
  )
}
