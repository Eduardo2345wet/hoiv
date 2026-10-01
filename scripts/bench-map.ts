// Mide el cálculo del mapa con un mapa SINTÉTICO del tamaño del real (5632×2048, ~13 000
// provincias, ~1 300 estados). No es el mapa de HOI4 (no hay juego aquí); sirve para ver la
// escala del trabajo. Uso: npx vite-node scripts/bench-map.ts
import { generateDemoMap } from '../src/shared/map/demo'
import { serializeMap } from '../src/shared/map/serialize'
import { segmentCount } from '../src/shared/map/vector'

const t0 = performance.now()
const map = generateDemoMap(1936, 5632, 2048, { states: 1300, cell: [30, 28] })
const total = performance.now() - t0
const b = map.borderStats
console.log(`mapa sintético ${map.width}×${map.height}, ${map.states.length} estados`)
console.log(`construir todo (incluye generar el mapa): ${total.toFixed(0)} ms`)
console.log(`vectorizar fronteras: ${b.ms.toFixed(0)} ms`)
console.log(
  `polilíneas ${b.polylines} (costa ${b.coastPolylines}), puntos ${b.rawPoints} → ${b.points}, ` +
    `segmentos ${segmentCount(map.borders)}, revertidas ${b.reverted}`
)
const bytes =
  map.borders.points.byteLength +
  map.borders.starts.byteLength +
  map.borders.a.byteLength +
  map.borders.b.byteLength
console.log(`fronteras en la caché: ${(bytes / 1024).toFixed(0)} KB`)
const t1 = performance.now()
const bin = serializeMap(map)
console.log(
  `caché completa: ${(bin.length / 1048576).toFixed(1)} MB (${(performance.now() - t1).toFixed(0)} ms)`
)
