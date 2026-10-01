export type ProvinceType = 'land' | 'sea' | 'lake'

export interface Province {
  id: number
  type: ProvinceType
  coastal: boolean
  color: [number, number, number]
  terrain?: string
  continent?: number
}

export interface State {
  id: number
  name: string
  sourceFile: string
  provinces: number[]
  originalOwner: string
  originalCores: string[]
  victoryPoints: Array<[number, number]>
  category: string
  hasDateChanges: boolean
  dateChanges?: Record<string, { owner?: string; addCores?: string[]; removeCores?: string[] }>
}

export interface MapData {
  width: number
  height: number
  /** Uint16Array con el ID de provincia por píxel (x + y * width) */
  provinceIndex: Uint16Array
  /** Arreglo o mapa de provincias por ID */
  provinces: Record<number, Province>
  /** Arreglo indexado por ID de provincia (0 = mar o sin estado) */
  provinceToState: Uint16Array
  /** Mapa de estados por ID */
  states: Record<number, State>
  /** Adyacencia entre estados por tierra (estadoId -> array de estadoIds vecinos) */
  stateAdjacency: Record<number, number[]>
  /** Índices de píxeles (y * width + x) pertenecientes a cada estado */
  statePixelIndices: Record<number, Uint32Array>
  /** Indicador de si es el mapa de demostración procedural */
  isDemoMap: boolean
  /** Conteo de colores no encontrados en definition.csv */
  missingColorCount?: number
}
