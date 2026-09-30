// Componente raíz: decide si se muestra la pantalla de inicio o el editor,
// y se encarga de guardar/abrir el proyecto (proyecto.json).

import { useCallback, useState } from 'react'
import { createProject, parseProject, serializeProject, type Project } from './model/project'
import Editor from './ui/Editor'
import StartScreen from './ui/StartScreen'

export default function App(): JSX.Element {
  const [project, setProject] = useState<Project | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateProject = useCallback((fn: (p: Project) => Project) => {
    setProject((p) => (p ? fn(p) : p))
    setDirty(true)
  }, [])

  const handleCreate = (modName: string, tag: string): void => {
    setProject(createProject(modName, tag))
    setFilePath(null)
    setDirty(true)
    setError(null)
  }

  const handleOpen = async (): Promise<void> => {
    const api = window.electronAPI
    if (!api) return setError('Abrir proyectos solo funciona dentro de la app de escritorio.')
    const result = await api.openProjectDialog()
    if (!result) return
    try {
      setProject(parseProject(result.content))
      setFilePath(result.path)
      setDirty(false)
      setError(null)
    } catch (e) {
      setError(`No se pudo abrir el proyecto: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const handleSave = useCallback(
    async (saveAs: boolean): Promise<void> => {
      const api = window.electronAPI
      if (!project) return
      if (!api) {
        window.alert('Guardar solo funciona dentro de la app de escritorio.')
        return
      }
      const content = serializeProject(project)
      if (filePath && !saveAs) {
        await api.saveProject(filePath, content)
      } else {
        const saved = await api.saveProjectDialog(content, 'proyecto.json')
        if (!saved) return
        setFilePath(saved)
      }
      setDirty(false)
    },
    [project, filePath]
  )

  const handleClose = (): void => {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Cerrar el proyecto de todos modos?')) return
    setProject(null)
    setFilePath(null)
    setDirty(false)
  }

  if (!project) return <StartScreen onCreate={handleCreate} onOpen={handleOpen} error={error} />

  return (
    <Editor
      project={project}
      dirty={dirty}
      filePath={filePath}
      onUpdate={updateProject}
      onSave={handleSave}
      onClose={handleClose}
    />
  )
}
