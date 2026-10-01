import fs from 'fs'
import path from 'path'
import type { MapData, Province, State } from '../renderer/src/map/types'

export interface BmpParseResult {
  width: number
  height: number
  colorGrid: Uint32Array
}

export function parseProvincesBmp(buffer: Buffer): BmpParseResult {
  if (buffer.length < 54) {
    throw new Error('El archivo provinces.bmp es demasiado corto para ser un BMP válido.')
  }

  if (buffer[0] !== 0x42 || buffer[1] !== 0x4d) {
    throw new Error('El archivo provinces.bmp no tiene la cabecera "BM" esperada.')
  }

  const dataOffset = buffer.readUInt32LE(10)
  const headerSize = buffer.readUInt32LE(14)

  if (headerSize < 40) {
    throw new Error(`Cabecera BITMAPINFOHEADER no soportada (tamaño ${headerSize}).`)
  }

  const width = buffer.readInt32LE(18)
  const rawHeight = buffer.readInt32LE(22)
  const planes = buffer.readUInt16LE(26)
  const bpp = buffer.readUInt16LE(28)
  const compression = buffer.readUInt32LE(30)

  if (planes !== 1) {
    throw new Error(`BMP con planos inválidos: ${planes}`)
  }

  if (bpp !== 24) {
    throw new Error(`El mapa provinces.bmp debe ser de 24 bits por píxel (encontrado: ${bpp} bits).`)
  }

  if (compression !== 0) {
    throw new Error(`El mapa provinces.bmp debe estar sin compresión (compresión encontrada: ${compression}).`)
  }

  const height = Math.abs(rawHeight)
  const isBottomUp = rawHeight > 0

  const rowPadding = (4 - ((width * 3) % 4)) % 4
  const rowStride = width * 3 + rowPadding

  const expectedDataSize = rowStride * height
  if (dataOffset + expectedDataSize > buffer.length) {
    throw new Error('El archivo provinces.bmp está truncado o incompleto.')
  }

  const colorGrid = new Uint32Array(width * height)

  for (let y = 0; y < height; y++) {
    const fileRow = isBottomUp ? height - 1 - y : y
    const rowOffset = dataOffset + fileRow * rowStride

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + x * 3
      const b = buffer[pxOffset]
      const g = buffer[pxOffset + 1]
      const r = buffer[pxOffset + 2]

      const colorKey = (r << 16) | (g << 8) | b
      colorGrid[x + y * width] = colorKey >>> 0
    }
  }

  return { width, height, colorGrid }
}

export interface DefinitionCsvResult {
  colorToProvince: Map<number, Province>
}

export function parseDefinitionCsv(csvText: string): DefinitionCsvResult {
  const colorToProvince = new Map<number, Province>()
  const lines = csvText.split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue

    const cols = line.split(';')
    if (cols.length < 5) continue

    const id = parseInt(cols[0], 10)
    const r = parseInt(cols[1], 10)
    const g = parseInt(cols[2], 10)
    const b = parseInt(cols[3], 10)

    if (isNaN(id) || isNaN(r) || isNaN(g) || isNaN(b)) continue

    const rawType = (cols[4] || 'land').trim().toLowerCase()
    const type = rawType === 'sea' ? 'sea' : rawType === 'lake' ? 'lake' : 'land'
    const coastalStr = (cols[5] || 'false').trim().toLowerCase()
    const coastal = coastalStr === 'true' || coastalStr === '1'
    const terrain = cols[6] ? cols[6].trim() : undefined
    const continent = cols[7] ? parseInt(cols[7].trim(), 10) : undefined

    const colorKey = ((r << 16) | (g << 8) | b) >>> 0

    colorToProvince.set(colorKey, {
      id,
      type,
      coastal,
      color: [r, g, b],
      terrain,
      continent: isNaN(continent as number) ? undefined : continent
    })
  }

  return { colorToProvince }
}

export function decodeTextBuffer(buf: Buffer): string {
  try {
    const utf8Str = buf.toString('utf-8')
    if (!utf8Str.includes('\uFFFD')) {
      return utf8Str
    }
  } catch {
    // fallback
  }
  return new TextDecoder('windows-1252').decode(buf)
}

export interface ParsedStateFile {
  id: number
  nameKey: string
  provinces: number[]
  owner: string
  cores: string[]
  victoryPoints: Array<[number, number]>
  category: string
  hasDateChanges: boolean
  dateChanges: Record<string, { owner?: string; addCores?: string[]; removeCores?: string[] }>
  fileName: string
}

export function parseStateText(text: string, fileName = ''): ParsedStateFile | null {
  const idMatch = text.match(/\bid\s*=\s*(\d+)/)
  if (!idMatch) return null
  const id = parseInt(idMatch[1], 10)

  const nameMatch = text.match(/\bname\s*=\s*"?([^"\r\n#]+)"?/)
  const nameKey = nameMatch ? nameMatch[1].trim() : `Estado ${id}`

  const catMatch = text.match(/\bstate_category\s*=\s*"?([a-zA-Z0-9_]+)"?/)
  const category = catMatch ? catMatch[1].trim() : 'rural'

  const provsMatch = text.match(/\bprovinces\s*=\s*\{([^}]+)\}/)
  const provinces: number[] = []
  if (provsMatch) {
    const tokens = provsMatch[1].trim().split(/\s+/)
    tokens.forEach((t) => {
      const p = parseInt(t, 10)
      if (!isNaN(p)) provinces.push(p)
    })
  }

  let owner = ''
  const cores: string[] = []
  const victoryPoints: Array<[number, number]> = []

  const historyStart = text.indexOf('history')
  let historyBlock = ''
  if (historyStart !== -1) {
    const openBrace = text.indexOf('{', historyStart)
    if (openBrace !== -1) {
      let depth = 1
      let endPos = openBrace + 1
      while (endPos < text.length && depth > 0) {
        if (text[endPos] === '{') depth++
        else if (text[endPos] === '}') depth--
        endPos++
      }
      historyBlock = text.slice(openBrace + 1, endPos - 1)
    }
  }

  const dateBlockRegex = /\b\d{4}\.\d{1,2}\.\d{1,2}\s*=\s*\{([^}]+)\}/g
  const topHistoryOnly = historyBlock.replace(dateBlockRegex, '')

  const ownerMatch = topHistoryOnly.match(/\bowner\s*=\s*([A-Z][A-Z0-9]{2})\b/)
  if (ownerMatch) {
    owner = ownerMatch[1]
  }

  const coreMatches = topHistoryOnly.matchAll(/\badd_core_of\s*=\s*([A-Z][A-Z0-9]{2})\b/g)
  for (const cm of coreMatches) {
    if (!cores.includes(cm[1])) {
      cores.push(cm[1])
    }
  }

  const vpMatches = topHistoryOnly.matchAll(/\bvictory_points\s*=\s*\{\s*(\d+)\s+(\d+)\s*\}/g)
  for (const vpm of vpMatches) {
    const p = parseInt(vpm[1], 10)
    const pts = parseInt(vpm[2], 10)
    if (!isNaN(p) && !isNaN(pts)) {
      victoryPoints.push([p, pts])
    }
  }

  let hasDateChanges = false
  const dateChanges: Record<string, { owner?: string; addCores?: string[]; removeCores?: string[] }> = {}

  let dateMatch: RegExpExecArray | null
  const dateRegex = /\b(\d{4}\.\d{1,2}\.\d{1,2})\s*=\s*\{([^}]+)\}/g
  while ((dateMatch = dateRegex.exec(historyBlock)) !== null) {
    const dateStr = dateMatch[1]
    const content = dateMatch[2]

    const dOwner = content.match(/\bowner\s*=\s*([A-Z][A-Z0-9]{2})\b/)
    const dAddCores = [...content.matchAll(/\badd_core_of\s*=\s*([A-Z][A-Z0-9]{2})\b/g)].map((m) => m[1])
    const dRemCores = [...content.matchAll(/\bremove_core_of\s*=\s*([A-Z][A-Z0-9]{2})\b/g)].map((m) => m[1])

    if (dOwner || dAddCores.length > 0 || dRemCores.length > 0) {
      hasDateChanges = true
      dateChanges[dateStr] = {
        owner: dOwner ? dOwner[1] : undefined,
        addCores: dAddCores.length > 0 ? dAddCores : undefined,
        removeCores: dRemCores.length > 0 ? dRemCores : undefined
      }
    }
  }

  return {
    id,
    nameKey,
    provinces,
    owner,
    cores,
    victoryPoints,
    category,
    hasDateChanges,
    dateChanges,
    fileName
  }
}

export interface LoadRealMapResult {
  mapData: MapData
  missingColorCount: number
}

export async function loadRealMap(
  gamePath: string,
  cacheDir: string,
  onProgress?: (progress: number, message: string) => void
): Promise<LoadRealMapResult> {
  const provincesBmpPath = path.join(gamePath, 'map', 'provinces.bmp')
  const definitionCsvPath = path.join(gamePath, 'map', 'definition.csv')
  const statesDir = path.join(gamePath, 'history', 'states')

  if (!fs.existsSync(provincesBmpPath)) {
    throw new Error(`No se encontró el archivo de mapa: ${provincesBmpPath}`)
  }
  if (!fs.existsSync(definitionCsvPath)) {
    throw new Error(`No se encontró la definición de mapa: ${definitionCsvPath}`)
  }
  if (!fs.existsSync(statesDir)) {
    throw new Error(`No se encontró la carpeta de estados: ${statesDir}`)
  }

  // 1. Calcular clave de caché basada en estadísticas de archivos
  const statBmp = fs.statSync(provincesBmpPath)
  const statCsv = fs.statSync(definitionCsvPath)

  const cacheKeyRaw = `${gamePath}_${statBmp.size}_${statBmp.mtimeMs}_${statCsv.size}_${statCsv.mtimeMs}`
  const cacheKey = Buffer.from(cacheKeyRaw).toString('hex').slice(0, 32)
  const cacheFilePath = path.join(cacheDir, `map_cache_${cacheKey}.json`)

  if (fs.existsSync(cacheFilePath)) {
    try {
      onProgress?.(10, 'Cargando mapa desde caché...')
      const rawCache = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'))
      // Reconstruir TypedArrays
      rawCache.mapData.provinceIndex = new Uint16Array(rawCache.mapData.provinceIndex)
      rawCache.mapData.provinceToState = new Uint16Array(rawCache.mapData.provinceToState)

      const newPixelIndices: Record<number, Uint32Array> = {}
      for (const [sid, arr] of Object.entries(rawCache.mapData.statePixelIndices as Record<string, number[]>)) {
        newPixelIndices[Number(sid)] = new Uint32Array(arr)
      }
      rawCache.mapData.statePixelIndices = newPixelIndices

      onProgress?.(100, 'Mapa cargado')
      return rawCache as LoadRealMapResult
    } catch {
      // Si la caché falla, regenerar
    }
  }

  // 2. Parsear provinces.bmp
  onProgress?.(15, 'Leyendo provincias.bmp...')
  const bmpBuf = fs.readFileSync(provincesBmpPath)
  const { width, height, colorGrid } = parseProvincesBmp(bmpBuf)

  // 3. Parsear definition.csv
  onProgress?.(35, 'Leyendo definition.csv...')
  const csvText = decodeTextBuffer(fs.readFileSync(definitionCsvPath))
  const { colorToProvince } = parseDefinitionCsv(csvText)

  // Asignar ID de provincia por píxel
  const provinceIndex = new Uint16Array(width * height)
  const provinces: Record<number, Province> = {}

  let missingColorCount = 0
  const unknownColors = new Set<number>()

  for (let i = 0; i < colorGrid.length; i++) {
    const cKey = colorGrid[i]
    const prov = colorToProvince.get(cKey)
    if (prov) {
      provinceIndex[i] = prov.id
      if (!provinces[prov.id]) {
        provinces[prov.id] = prov
      }
    } else {
      provinceIndex[i] = 0
      if (!unknownColors.has(cKey)) {
        unknownColors.add(cKey)
        missingColorCount++
      }
    }
  }

  // 4. Leer localización de estados
  onProgress?.(50, 'Leyendo localización y estados...')
  const locMap = new Map<string, string>()
  const locEngDir = path.join(gamePath, 'localisation', 'english')
  if (fs.existsSync(locEngDir)) {
    const locFiles = fs.readdirSync(locEngDir).filter((f) => f.endsWith('.yml'))
    for (const lf of locFiles) {
      if (/state_names|localisation/.test(lf)) {
        const text = decodeTextBuffer(fs.readFileSync(path.join(locEngDir, lf)))
        for (const r of text.matchAll(/^\s*([A-Za-z0-9_.-]+):\d*\s*"(.*)"\s*$/gm)) {
          locMap.set(r[1], r[2])
        }
      }
    }
  }

  // 5. Parsear todos los estados en history/states/
  const stateFiles = fs.readdirSync(statesDir).filter((f) => f.endsWith('.txt'))
  const states: Record<number, State> = {}
  const provinceToState = new Uint16Array(65536)

  let processedFiles = 0
  for (const sf of stateFiles) {
    processedFiles++
    if (processedFiles % 50 === 0) {
      const pct = 50 + Math.floor((processedFiles / stateFiles.length) * 30)
      onProgress?.(pct, `Procesando estados (${processedFiles}/${stateFiles.length})...`)
    }

    const sfPath = path.join(statesDir, sf)
    const sfText = decodeTextBuffer(fs.readFileSync(sfPath))
    const parsedState = parseStateText(sfText, sf)
    if (parsedState) {
      const name = locMap.get(parsedState.nameKey) || parsedState.nameKey || `Estado ${parsedState.id}`

      states[parsedState.id] = {
        id: parsedState.id,
        name,
        sourceFile: sf,
        provinces: parsedState.provinces,
        originalOwner: parsedState.owner,
        originalCores: parsedState.cores,
        victoryPoints: parsedState.victoryPoints,
        category: parsedState.category,
        hasDateChanges: parsedState.hasDateChanges,
        dateChanges: parsedState.dateChanges
      }

      parsedState.provinces.forEach((pid) => {
        if (pid < 65536) {
          provinceToState[pid] = parsedState.id
        }
      })
    }
  }

  // 6. Adyacencia entre estados
  onProgress?.(85, 'Calculando adyacencias...')
  const adjacencyMap: Record<number, Set<number>> = {}
  Object.keys(states).forEach((s) => {
    adjacencyMap[Number(s)] = new Set<number>()
  })

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const idx = x + y * width
      const p1 = provinceIndex[idx]
      const p2 = provinceIndex[idx + 1]
      const p3 = provinceIndex[idx + width]

      const s1 = provinceToState[p1]
      const s2 = provinceToState[p2]
      const s3 = provinceToState[p3]

      if (s1 > 0 && s2 > 0 && s1 !== s2) {
        adjacencyMap[s1]?.add(s2)
        adjacencyMap[s2]?.add(s1)
      }
      if (s1 > 0 && s3 > 0 && s1 !== s3) {
        adjacencyMap[s1]?.add(s3)
        adjacencyMap[s3]?.add(s1)
      }
    }
  }

  const stateAdjacency: Record<number, number[]> = {}
  Object.entries(adjacencyMap).forEach(([sid, set]) => {
    stateAdjacency[Number(sid)] = Array.from(set)
  })

  // 7. Índices de píxeles por estado
  onProgress?.(92, 'Indexando píxeles de estados...')
  const pixelCounts: Record<number, number> = {}
  for (let i = 0; i < provinceIndex.length; i++) {
    const provId = provinceIndex[i]
    const stId = provinceToState[provId]
    if (stId > 0) {
      pixelCounts[stId] = (pixelCounts[stId] || 0) + 1
    }
  }

  const statePixelIndices: Record<number, Uint32Array> = {}
  const writeIndices: Record<number, number> = {}
  Object.keys(states).forEach((sidStr) => {
    const sid = Number(sidStr)
    const count = pixelCounts[sid] || 0
    statePixelIndices[sid] = new Uint32Array(count)
    writeIndices[sid] = 0
  })

  for (let i = 0; i < provinceIndex.length; i++) {
    const provId = provinceIndex[i]
    const stId = provinceToState[provId]
    if (stId > 0 && statePixelIndices[stId]) {
      const pos = writeIndices[stId]
      statePixelIndices[stId][pos] = i
      writeIndices[stId] = pos + 1
    }
  }

  const mapData: MapData = {
    width,
    height,
    provinceIndex,
    provinces,
    provinceToState,
    states,
    stateAdjacency,
    statePixelIndices,
    isDemoMap: false,
    missingColorCount
  }

  const result: LoadRealMapResult = {
    mapData,
    missingColorCount
  }

  // Guardar en caché
  try {
    fs.mkdirSync(cacheDir, { recursive: true })
    const serializableIndices: Record<number, number[]> = {}
    for (const [sid, arr] of Object.entries(statePixelIndices)) {
      serializableIndices[Number(sid)] = Array.from(arr)
    }

    const serializable = {
      mapData: {
        ...mapData,
        provinceIndex: Array.from(provinceIndex),
        provinceToState: Array.from(provinceToState),
        statePixelIndices: serializableIndices
      },
      missingColorCount
    }
    fs.writeFileSync(cacheFilePath, JSON.stringify(serializable), 'utf-8')
  } catch {
    // Si la caché falla al guardar, ignorar
  }

  onProgress?.(100, 'Mapa cargado')
  return result
}
