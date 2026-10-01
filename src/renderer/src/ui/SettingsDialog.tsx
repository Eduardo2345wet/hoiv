// Ajustes: carpeta del juego (OPCIONAL). Sin ella se usa una lista integrada corta.
import { useEffect, useState } from 'react'
import { store, useApp } from '../store/appStore'
import Modal from './Modal'

/** Lee los ajustes guardados y, si hay carpeta del juego, carga su contenido */
export async function loadGameSettings(): Promise<string | null> {
  const api = window.electronAPI
  if (!api) return null
  const s = await api.getSettings()
  if (s.gamePath) store.set({ game: await api.readGameCatalog(s.gamePath), gamePath: s.gamePath })
  return s.gamePath
}

export default function SettingsDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const game = useApp((s) => s.game)
  const [gamePath, setGamePath] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    void window.electronAPI?.getSettings().then((s) => setGamePath(s.gamePath))
  }, [])

  const choose = async (): Promise<void> => {
    const api = window.electronAPI
    if (!api) return
    const dir = await api.selectGameFolder()
    if (!dir) return
    const cat = await api.readGameCatalog(dir)
    if (!cat) {
      setMsg('Esa carpeta no parece la del juego (no tiene common/country_tags).')
      return
    }
    await api.setSettings({ gamePath: dir })
    setGamePath(dir)
    store.set({ game: cat, gamePath: dir })
    setMsg(`✔ Leídos ${cat.countries.length} países y ${cat.ideas.length} espíritus del juego.`)
  }
  const clear = async (): Promise<void> => {
    await window.electronAPI?.setSettings({ gamePath: null })
    setGamePath(null)
    store.set({ game: null, gamePath: null })
    setMsg('Se usará la lista integrada.')
  }

  return (
    <Modal
      title="Ajustes"
      width={520}
      onClose={onClose}
      footer={
        <button className="btn" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <label className="label">Carpeta de instalación de Hearts of Iron IV (opcional)</label>
      <div className="mb-2 break-all rounded bg-hoi-bg p-2 font-mono text-xs">
        {gamePath ?? '(sin configurar)'}
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => void choose()}>
          Elegir carpeta…
        </button>
        {gamePath && (
          <button className="btn" onClick={() => void clear()}>
            Quitar
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-hoi-muted">
        Solo se LEE para completar las listas de países y espíritus. La app nunca escribe en la
        carpeta del juego. Sin carpeta, se usa una lista corta integrada (
        {game ? 'ahora: datos del juego' : 'ahora: lista integrada'}).
      </p>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </Modal>
  )
}
