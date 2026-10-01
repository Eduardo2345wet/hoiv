import type { MapData, Province, State } from './types'

function createPRNG(seed: number) {
  let s = seed
  return function () {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

export function generateDemoMap(): MapData {
  const width = 1200
  const height = 600
  const rng = createPRNG(123456)

  const numProvinces = 300
  const numStates = 40

  // 1. Generar puntos semilla para Voronoi
  const seeds: Array<{ id: number; x: number; y: number; isSea: boolean; r: number; g: number; b: number }> = []

  for (let id = 1; id <= numProvinces; id++) {
    const x = Math.floor(rng() * (width - 20)) + 10
    const y = Math.floor(rng() * (height - 20)) + 10

    // Mar en los bordes y algunas zonas
    const isSea = x < 80 || x > width - 80 || y < 60 || y > height - 60 || (x > 500 && x < 700 && y > 200 && y < 400 && id % 7 === 0)

    const r = Math.floor(rng() * 230) + 10
    const g = Math.floor(rng() * 230) + 10
    const b = Math.floor(rng() * 230) + 10

    seeds.push({ id, x, y, isSea, r, g, b })
  }

  // Grid de provincias
  const provinceIndex = new Uint16Array(width * height)

  // Asignar Voronoi optimizado por bloques/cuadrícula pequeña para velocidad
  const gridCellSize = 60
  const gridCols = Math.ceil(width / gridCellSize)
  const gridRows = Math.ceil(height / gridCellSize)
  const spatialGrid: number[][][] = Array.from({ length: gridCols }, () =>
    Array.from({ length: gridRows }, () => [])
  )

  seeds.forEach((s) => {
    const gx = Math.min(gridCols - 1, Math.max(0, Math.floor(s.x / gridCellSize)))
    const gy = Math.min(gridRows - 1, Math.max(0, Math.floor(s.y / gridCellSize)))
    spatialGrid[gx][gy].push(s.id)
  })

  for (let y = 0; y < height; y++) {
    const gy = Math.min(gridRows - 1, Math.max(0, Math.floor(y / gridCellSize)))
    for (let x = 0; x < width; x++) {
      const gx = Math.min(gridCols - 1, Math.max(0, Math.floor(x / gridCellSize)))

      let closestId = 1
      let minDistSq = Infinity

      for (let dgx = -1; dgx <= 1; dgx++) {
        const cx = gx + dgx
        if (cx < 0 || cx >= gridCols) continue
        for (let dgy = -1; dgy <= 1; dgy++) {
          const cy = gy + dgy
          if (cy < 0 || cy >= gridRows) continue
          const candidateIds = spatialGrid[cx][cy]
          for (let i = 0; i < candidateIds.length; i++) {
            const sid = candidateIds[i]
            const s = seeds[sid - 1]
            const dx = x - s.x
            const dy = y - s.y
            const distSq = dx * dx + dy * dy
            if (distSq < minDistSq) {
              minDistSq = distSq
              closestId = sid
            }
          }
        }
      }

      provinceIndex[x + y * width] = closestId
    }
  }

  // Detectar provincias costeras y llenar objeto provinces
  const provinces: Record<number, Province> = {}
  const landProvinceIds: number[] = []

  const isSeaProv = new Uint8Array(numProvinces + 1)
  seeds.forEach((s) => {
    isSeaProv[s.id] = s.isSea ? 1 : 0
  })

  // Detectar adyacencia costera
  const coastalProvs = new Set<number>()
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const p1 = provinceIndex[x + y * width]
      const p2 = provinceIndex[x + 1 + y * width]
      const p3 = provinceIndex[x + (y + 1) * width]
      if (p1 !== p2) {
        if (isSeaProv[p1] !== isSeaProv[p2]) {
          if (!isSeaProv[p1]) coastalProvs.add(p1)
          if (!isSeaProv[p2]) coastalProvs.add(p2)
        }
      }
      if (p1 !== p3) {
        if (isSeaProv[p1] !== isSeaProv[p3]) {
          if (!isSeaProv[p1]) coastalProvs.add(p1)
          if (!isSeaProv[p3]) coastalProvs.add(p3)
        }
      }
    }
  }

  seeds.forEach((s) => {
    const isLand = !s.isSea
    if (isLand) landProvinceIds.push(s.id)

    provinces[s.id] = {
      id: s.id,
      type: isLand ? 'land' : 'sea',
      coastal: coastalProvs.has(s.id),
      color: [s.r, s.g, s.b],
      terrain: isLand ? 'plains' : 'ocean',
      continent: 1
    }
  })

  // 2. Asignar las provincias de tierra a ~40 estados
  const provinceToState = new Uint16Array(numProvinces + 1)
  const states: Record<number, State> = {}

  const tags = ['DMA', 'DMB', 'DMC', 'DMD']
  const tagNames: Record<string, string> = {
    DMA: 'Dominio Alpha',
    DMB: 'Dominio Beta',
    DMC: 'Dominio Gamma',
    DMD: 'Dominio Delta'
  }

  // Agrupar provincias de tierra secuencialmente en estados
  const landCount = landProvinceIds.length
  const provsPerState = Math.max(1, Math.floor(landCount / numStates))

  let stateIdCounter = 1
  for (let i = 0; i < landCount; i += provsPerState) {
    if (stateIdCounter > numStates) break
    const currentProvGroup = landProvinceIds.slice(i, i + provsPerState)
    if (i + provsPerState >= landCount && stateIdCounter === numStates) {
      // Agregar resto
      currentProvGroup.push(...landProvinceIds.slice(i + provsPerState))
    }

    const stateId = stateIdCounter++
    currentProvGroup.forEach((pid) => {
      provinceToState[pid] = stateId
    })

    // Dueño y cores ficticios
    const ownerIndex = (stateId - 1) % (tags.length + 1) // 0..3 países, 4 neutral
    const owner = ownerIndex < tags.length ? tags[ownerIndex] : ''
    const cores = owner ? [owner] : []

    // Victory point en la primera provincia
    const vpProv = currentProvGroup[0]
    const victoryPoints: Array<[number, number]> = vpProv ? [[vpProv, 10]] : []

    states[stateId] = {
      id: stateId,
      name: `Estado ${stateId}`,
      sourceFile: `demo_${stateId}.txt`,
      provinces: currentProvGroup,
      originalOwner: owner,
      originalCores: cores,
      victoryPoints,
      category: stateId % 3 === 0 ? 'town' : stateId % 5 === 0 ? 'city' : 'rural',
      hasDateChanges: false
    }
  }

  // 3. Adyacencia entre estados por tierra
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

  // 4. Índices de píxeles por estado para repintado rápido
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

  return {
    width,
    height,
    provinceIndex,
    provinces,
    provinceToState,
    states,
    stateAdjacency,
    statePixelIndices,
    isDemoMap: true
  }
}
