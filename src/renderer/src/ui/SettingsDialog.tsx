// Ajustes: carpeta del juego (OPCIONAL). Sin ella se usa una lista integrada corta.
import { useState } from 'react'
import { store, useApp } from '../store/appStore'
import Modal from './Modal'

/**
 * Al arrancar: busca HOI4 sola (registro de Windows, bibliotecas de Steam, rutas típicas),
 * sin bloquear la app. Una carpeta elegida a mano se respeta.
 */
export async function loadGameSettings(): Promise<string | null> {
  const api = window.electronAPI
  if (!api) return null
  store.set({ gameDetect: { searching: true, auto: false, via: null } })
  const r = await api.detectGame()
  store.clearMapCache() // otra carpeta del juego = otros mapas
  store.set({ gamePath: r.gamePath, gameDetect: { searching: false, auto: r.auto, via: r.via } })
  if (r.gamePath) store.set({ game: await api.readGameCatalog(r.gamePath) })
  return r.gamePath
}

export default function SettingsDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const game = useApp((s) => s.game)
  const gamePath = useApp((s) => s.gamePath)
  const detect = useApp((s) => s.gameDetect)
  const [msg, setMsg] = useState('')

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
    await api.setSettings({ gamePath: dir, gamePathAuto: false })
    store.set({
      game: cat,
      gamePath: dir,
      gameDetect: { searching: false, auto: false, via: 'manual' }
    })
    setMsg(`✔ Leídos ${cat.countries.length} países y ${cat.ideas.length} espíritus del juego.`)
  }
  const redetect = async (): Promise<void> => {
    await window.electronAPI?.setSettings({ gamePath: null, gamePathAuto: true })
    const found = await loadGameSettings()
    setMsg(found ? '✔ HOI4 encontrado.' : 'No encontré HOI4.')
  }

  return (
    <Modal
      title="Ajustes"
      width={560}
      onClose={onClose}
      footer={
        <button className="btn" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <h3 className="mb-2 font-semibold">Hearts of Iron IV</h3>
      {detect.searching ? (
        <p className="text-sm text-hoi-muted">Buscando HOI4…</p>
      ) : gamePath ? (
        <>
          <p className="text-sm">
            HOI4 encontrado en: <span className="break-all font-mono text-xs">{gamePath}</span>{' '}
            <span className="text-hoi-muted">
              {detect.auto ? '(detectado automáticamente)' : '(elegido a mano)'}
            </span>
          </p>
          <div className="mt-2 flex gap-2">
            <button className="btn" onClick={() => void choose()}>
              Cambiar…
            </button>
            {!detect.auto && (
              <button className="btn" onClick={() => void redetect()}>
                Volver a detectar
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-yellow-300">
            No encontré HOI4 en Steam ni en las rutas típicas.
          </p>
          <div className="mt-2 flex gap-2">
            <button className="btn-primary" onClick={() => void choose()}>
              Elegir la carpeta a mano…
            </button>
            <button className="btn" onClick={() => void redetect()}>
              Buscar otra vez
            </button>
          </div>
        </>
      )}
      <p className="mt-3 text-xs text-hoi-muted">
        El juego NUNCA necesita estar abierto: la app solo lee sus archivos y nunca escribe en su
        carpeta ({game ? 'listas: datos del juego' : 'listas: lista integrada corta'}).
      </p>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </Modal>
  )
}
