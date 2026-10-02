// Carga del mapa REAL desde la carpeta del juego (en el proceso principal, por partes para
// poder informar el progreso). Resultado en caché en la carpeta de datos de la app.
import { collectStateNames, listLocFiles } from './stateNames'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getJomini } from './jominiInit'
import { parseBmp24 } from '../shared/map/bmp'
import { colorKey, parseDefinitionCsv } from '../shared/map/definition'
import { decodeGameText } from '../shared/map/text'
import { parseStateFile } from '../shared/map/stateFile'
import { buildMapData } from '../shared/map/build'
import { deserializeMap, serializeMap } from '../shared/map/serialize'
import type { MapData, MapState } from '../shared/map/types'
import { listGameDir, resolveGameFile, type ModLayer } from './mods'

export type Progress = (pct: number, message: string) => void

export { getJomini }

const pause = (): Promise<void> => new Promise((r) => setImmediate(r))

function statFiles(files: string[]): string {
  return files
    .map((f) => {
      try {
        const st = fs.statSync(f)
        return `${f}|${st.size}|${st.mtimeMs}`
      } catch {
        return `${f}|-`
      }
    })
    .join('\n')
}

export async function loadRealMap(
  gamePath: string,
  cacheDir: string,
  progress: Progress,
  /** Mod usado como base: sus archivos se cargan ENCIMA de los del juego */
  mod: ModLayer | null = null
): Promise<MapData> {
  const bmpPath = resolveGameFile(gamePath, mod, 'map/provinces.bmp')
  const csvPath = resolveGameFile(gamePath, mod, 'map/definition.csv')
  if (!bmpPath || !csvPath)
    throw new Error(
      `No se encontró map/provinces.bmp o map/definition.csv en la carpeta del juego${mod ? ' ni en el mod' : ''}.`
    )
  const stateEntries = listGameDir(gamePath, mod, 'history/states', (f) => f.endsWith('.txt'))
  const stateFiles = stateEntries.map((e) => e.name)
  const statePath = new Map(stateEntries.map((e) => [e.name, e.abs]))
  // Nombres de estado: STATE_N en TODOS los .yml de localisation/english (incluidas las carpetas
  // replace/ y las de DLC). por verificar: que los nombres de estado vivan en esas carpetas
  const locFiles = listLocFiles(gamePath, mod)

  // ---- Caché: clave = rutas + tamaños + fechas de modificación ----
  progress(1, 'Revisando la caché…')
  const key = crypto
    .createHash('sha1')
    .update(`v2|${statFiles([bmpPath, csvPath, ...stateEntries.map((e) => e.abs), ...locFiles])}`)
    .digest('hex')
  const cacheFile = path.join(cacheDir, `mapa-${key}.bin`)
  if (fs.existsSync(cacheFile)) {
    const cached = deserializeMap(new Uint8Array(fs.readFileSync(cacheFile)))
    if (cached) {
      progress(100, 'Mapa cargado desde la caché')
      return cached
    }
  }

  progress(3, 'Leyendo provinces.bmp…')
  await pause()
  const bmp = parseBmp24(new Uint8Array(fs.readFileSync(bmpPath)))

  progress(12, 'Leyendo definition.csv…')
  await pause()
  const rows = parseDefinitionCsv(decodeGameText(new Uint8Array(fs.readFileSync(csvPath))))
  const maxId = rows.reduce((m, r) => Math.max(m, r.id), 0)
  if (maxId > 65535) throw new Error('definition.csv tiene IDs de provincia mayores que 65535.')
  const provinceType = new Uint8Array(maxId + 1)
  const provinceCoastal = new Uint8Array(maxId + 1)
  const provinceColor = new Uint32Array(maxId + 1)
  // Tabla color→ID directa (16 M entradas, 32 MB) para que el recorrido de píxeles sea rápido
  const colorToId = new Uint16Array(1 << 24)
  for (const r of rows) {
    const k = colorKey(r.r, r.g, r.b)
    colorToId[k] = r.id
    provinceType[r.id] = r.type
    provinceCoastal[r.id] = r.coastal ? 1 : 0
    provinceColor[r.id] = k
  }

  // ---- Índice de provincia por píxel ----
  const total = bmp.width * bmp.height
  const provinceIndex = new Uint16Array(total)
  let unknown = 0
  const chunk = 1 << 20
  for (let start = 0; start < total; start += chunk) {
    const end = Math.min(total, start + chunk)
    for (let i = start; i < end; i++) {
      const s = i * 3
      const id = colorToId[(bmp.rgb[s] << 16) | (bmp.rgb[s + 1] << 8) | bmp.rgb[s + 2]]
      provinceIndex[i] = id
      if (!id) unknown++
    }
    progress(
      15 + Math.round((end / total) * 35),
      `Leyendo provincias… ${Math.round((end / total) * 100)} %`
    )
    await pause()
  }

  // ---- Estados ----
  const jomini = await getJomini()
  const loc = collectStateNames(locFiles)
  const states: MapState[] = []
  for (let n = 0; n < stateFiles.length; n++) {
    const f = stateFiles[n]
    try {
      const text = decodeGameText(new Uint8Array(fs.readFileSync(statePath.get(f)!)))
      for (const s of parseStateFile(jomini, text, f)) {
        s.name = loc.get(s.nameKey) ?? `Estado ${s.id}`
        states.push(s)
      }
    } catch {
      // Un archivo que no se puede leer no rompe la carga (su estado quedará sin datos)
    }
    if (n % 50 === 0) {
      progress(
        50 + Math.round((n / stateFiles.length) * 35),
        `Leyendo estados… ${n}/${stateFiles.length}`
      )
      await pause()
    }
  }
  states.sort((a, b) => a.id - b.id)

  progress(88, 'Calculando vecinos y fronteras vectoriales…')
  await pause()
  const map = buildMapData({
    source: 'real',
    width: bmp.width,
    height: bmp.height,
    provinceIndex,
    provinceType,
    provinceCoastal,
    provinceColor,
    states,
    unknownColorPixels: unknown
  })

  progress(96, 'Guardando en caché…')
  try {
    fs.mkdirSync(cacheDir, { recursive: true })
    for (const old of fs.readdirSync(cacheDir))
      if (old.startsWith('mapa-')) fs.rmSync(path.join(cacheDir, old))
    fs.writeFileSync(cacheFile, serializeMap(map))
  } catch {
    // Sin caché no pasa nada: la próxima vez se vuelve a leer
  }
  progress(100, 'Mapa cargado')
  return map
}
