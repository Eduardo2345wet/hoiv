// Pantalla de inicio: crear un mod nuevo o abrir un proyecto guardado.

import { useState } from 'react'
import { FilePlus2, FolderOpen } from 'lucide-react'
import NewModDialog from './NewModDialog'

interface Props {
  onCreate: (modName: string, tag: string) => void
  onOpen: () => void
  error: string | null
}

export default function StartScreen({ onCreate, onOpen, error }: Props): JSX.Element {
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-hoi-bg">
      <h1 className="text-4xl font-extrabold tracking-tight text-hoi-accent">HOI4 Mod Studio</h1>
      <p className="mt-2 text-hoi-muted">Crea árboles de focos para Hearts of Iron IV sin escribir código.</p>

      <div className="mt-10 flex gap-4">
        <button
          onClick={() => setShowNew(true)}
          className="flex w-56 flex-col items-center gap-3 rounded-lg border border-hoi-accent bg-hoi-accent/10 p-6 text-hoi-text hover:bg-hoi-accent/20"
        >
          <FilePlus2 size={36} className="text-hoi-accent" />
          <span className="text-lg font-semibold">Nuevo mod</span>
        </button>
        <button
          onClick={onOpen}
          className="flex w-56 flex-col items-center gap-3 rounded-lg border border-hoi-border bg-hoi-panel p-6 text-hoi-text hover:bg-hoi-card"
        >
          <FolderOpen size={36} className="text-hoi-muted" />
          <span className="text-lg font-semibold">Abrir proyecto</span>
        </button>
      </div>
      {error && <p className="mt-6 max-w-md text-center text-sm text-red-400">{error}</p>}

      {showNew && (
        <NewModDialog
          onCancel={() => setShowNew(false)}
          onCreate={(name, tag) => {
            setShowNew(false)
            onCreate(name, tag)
          }}
        />
      )}
    </div>
  )
}
