// Abre el mini mapa "Elegir estado" y devuelve el número elegido (null = cancelado).
import { store } from '../store/appStore'

export interface StatePickOptions {
  /** Estado actual del campo (aparece seleccionado y centrado) */
  current?: number | null
  /** Solo se pueden elegir los estados de este país (capital, etc.) */
  onlyOwner?: string | null
}

export function chooseState(opts: StatePickOptions = {}): Promise<number | null> {
  // Sin mapa cargado, la ventana muestra el progreso de la carga
  const s = store.get()
  if (!s.map && !s.mapLoading) void store.loadMap()
  return new Promise((resolve) =>
    store.set({
      statePicker: {
        current: opts.current ?? null,
        onlyOwner: opts.onlyOwner ?? null,
        resolve: (id) => {
          if (id !== null) store.pushRecent('state', id)
          resolve(id)
        }
      }
    })
  )
}
