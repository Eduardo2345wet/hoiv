// Estructura del mapa en memoria. La generan igual el mapa REAL (carpeta del juego)
// y el mapa de DEMOSTRACIÓN, para que todo el editor funcione igual con los dos.

import type { BorderSet, BorderStats } from './vector'

export const PROVINCE_TYPE = { none: 0, land: 1, sea: 2, lake: 3 } as const
export type ProvinceType = (typeof PROVINCE_TYPE)[keyof typeof PROVINCE_TYPE]

export interface MapState {
  id: number
  /** Clave de localización (STATE_N) o nombre ya resuelto */
  nameKey: string
  /** Nombre legible (localización del juego o "Estado N") */
  name: string
  /** Archivo de origen en history/states (mismo nombre al exportar) */
  file: string
  provinces: number[]
  /** Dueño y cores ORIGINALES (bloque history de nivel superior) */
  owner: string
  cores: string[]
  /** [provincia, puntos] */
  victoryPoints: [number, number][]
  category: string
  /** Tiene bloques con fecha (1939.1.1 = { … }) que cambian owner o cores */
  hasDatedChanges: boolean
}

export interface MapData {
  source: 'demo' | 'real'
  width: number
  height: number
  /** ID de provincia por píxel, filas de arriba hacia abajo (0 = sin provincia) */
  provinceIndex: Uint16Array
  /** Indexados por ID de provincia */
  provinceType: Uint8Array
  provinceCoastal: Uint8Array
  /** Color RGB de provinces.bmp: (R<<16)|(G<<8)|B */
  provinceColor: Uint32Array
  /** Estado de cada provincia (0 = mar o sin estado) */
  provinceToState: Uint16Array
  states: MapState[]
  /** Estados vecinos por tierra (por id de estado) */
  stateAdjacency: Record<number, number[]>
  /**
   * Píxeles de cada estado en formato compacto: los índices de píxel del estado N van de
   * statePixelIndex[statePixelOffsets[N]] a statePixelIndex[statePixelOffsets[N+1]-1]
   * (N = posición del estado en `states`).
   */
  statePixelIndex: Uint32Array
  statePixelOffsets: Uint32Array
  /** Píxeles de provinces.bmp cuyo color no está en definition.csv */
  unknownColorPixels: number
  /** Centro aproximado de cada estado (para centrar la vista), por id */
  stateCenters: Record<number, [number, number]>
  /**
   * Centro visual de cada estado (polo de inaccesibilidad): [x, y, radio] en píxeles del mapa.
   * La etiqueta va aquí y solo se dibuja si cabe en un círculo de ese radio.
   */
  stateLabels: Record<number, [number, number, number]>
  /** Fronteras vectoriales (por par de estados y por costa), calculadas una vez y en la caché */
  borders: BorderSet
  /** Cuánto costó calcularlas (para el overlay F3) */
  borderStats: BorderStats
}

/** Posición de un estado en `states` por id */
export function stateIndexById(map: MapData): Map<number, number> {
  return new Map(map.states.map((s, i) => [s.id, i]))
}
