// Pantalla de inicio: crear un mod nuevo o abrir un proyecto.json
import { useState } from 'react'
import { FolderOpen, Plus } from 'lucide-react'
import { validateTag } from '../export/validator'
import { PROJECT_VERSION, type Project } from '../types'
import { createFocus } from './projectOps'
import { migrateProject } from '../migrate'
import { store } from '../store/appStore'

function onOpen(project: Project, filePath: string | null): void {
  store.set({
    project,
    filePath,
    dirty: false,
    selectedUid: project.focuses[0]?.uid ?? null
  })
}

export default function StartScreen(): JSX.Element {
  const [showForm, setShowForm] = useState(false)
  const [modName, setModName] = useState('')
  const [tag, setTag] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = (): void => {
    if (!modName.trim()) return setError('Escribe un nombre para el mod.')
    const tagError = validateTag(tag)
    if (tagError) return setError(tagError)
    const empty: Project = {
      version: PROJECT_VERSION,
      modName: modName.trim(),
      tag,
      focuses: [],
      ideas: [],
      icons: [],
      countryFlags: []
    }
    onOpen(createFocus(empty, 0, 0, 'Mi primer foco').project, null)
  }

  const open = async (): Promise<void> => {
    const res = await window.electronAPI?.openProjectDialog()
    if (!res) return
    try {
      // Migración automática: los proyectos viejos abren sin error
      onOpen(migrateProject(JSON.parse(res.content)), res.path)
    } catch {
      setError('Ese archivo no es un proyecto válido de HOI4 Mod Studio.')
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-8 bg-hoi-bg">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-hoi-accent">HOI4 Mod Studio</h1>
        <p className="mt-2 text-hoi-muted">
          Crea árboles de focos para Hearts of Iron IV sin escribir código
        </p>
      </div>

      {!showForm ? (
        <div className="flex gap-4">
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={18} /> Nuevo mod
          </button>
          <button className="btn" onClick={open}>
            <FolderOpen size={18} /> Abrir proyecto
          </button>
        </div>
      ) : (
        <div className="w-96 rounded-lg border border-hoi-border bg-hoi-panel p-6 shadow-xl">
          <h2 className="mb-4 text-lg font-semibold">Nuevo mod</h2>
          <label className="label">Nombre del mod</label>
          <input
            className="input"
            autoFocus
            value={modName}
            placeholder="Mi mod de México"
            onChange={(e) => setModName(e.target.value)}
          />
          <label className="label mt-3">Tag del país (3 letras)</label>
          <input
            className="input font-mono uppercase"
            maxLength={3}
            value={tag}
            placeholder="MEX"
            onChange={(e) => setTag(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <p className="mt-1 text-xs text-hoi-muted">
            Es el código del país en el juego: GER = Alemania, MEX = México, SPR = España...
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={create}>
              Crear
            </button>
          </div>
        </div>
      )}
      {error && <p className="max-w-md text-center text-sm text-red-400">{error}</p>}
    </div>
  )
}
