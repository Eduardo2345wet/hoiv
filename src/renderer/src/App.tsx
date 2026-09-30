// Componente raíz: muestra la pantalla de inicio o el editor
import { useState } from 'react'
import type { Project } from './types'
import StartScreen from './ui/StartScreen'
import Editor from './ui/Editor'

export default function App(): JSX.Element {
  const [project, setProject] = useState<Project | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)

  if (!project)
    return (
      <StartScreen
        onOpen={(p, path) => {
          setProject(p)
          setFilePath(path)
        }}
      />
    )

  return (
    <Editor
      project={project}
      filePath={filePath}
      onProjectChange={(p) => setProject((prev) => (typeof p === 'function' ? p(prev!) : p))}
      onFilePathChange={setFilePath}
      onClose={() => {
        setProject(null)
        setFilePath(null)
      }}
    />
  )
}
