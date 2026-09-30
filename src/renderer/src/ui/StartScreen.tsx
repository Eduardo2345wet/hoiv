// Pantalla de inicio: crear un mod nuevo o abrir un proyecto.json
import { useState } from 'react'
import { FolderOpen, Plus } from 'lucide-react'
import { validateTag } from '../export/validator'
import { PROJECT_VERSION, type Project } from '../types'
import { createFocus } from './projectOps'
import { migrateProject } from '../migrate'
import { store } from '../store/appStore'
import { newCountry } from '../countries/countryOps'
import { getCatalogOptions } from '../catalog/catalog'

function onOpen(project: Project, filePath: string | null): void {
  store.openProject(project, filePath)
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
    // El tag inicial crea el primer país (existente si el juego ya lo tiene) con su árbol
    const known = getCatalogOptions('country', null, store.get().game).find((o) => o.id === tag)
    const country = {
      ...newCountry({
        mode: known ? 'existente' : 'nuevo',
        tag,
        name: known?.etiqueta ?? modName.trim()
      }),
      focusTreeId: 'arbol_1'
    }
    const empty: Project = {
      version: PROJECT_VERSION,
      modName: modName.trim(),
      tag,
      countries: [country],
      focusTrees: [{ id: 'arbol_1', name: `Árbol de ${country.names.name}` }],
      focuses: [],
      ideas: [],
      icons: [],
      countryFlags: [],
      stateEdits: {}
    }
    onOpen(createFocus(empty, 0, 0, 'Mi primer foco', 'arbol_1').project, null)
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
