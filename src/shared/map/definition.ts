// map/definition.csv: id;R;G;B;tipo;costera;terreno;continente
import { PROVINCE_TYPE } from './types'

export interface DefinitionRow {
  id: number
  r: number
  g: number
  b: number
  type: number
  coastal: boolean
  terrain: string
  continent: number
}

export const colorKey = (r: number, g: number, b: number): number => (r << 16) | (g << 8) | b

export function parseDefinitionCsv(text: string): DefinitionRow[] {
  const rows: DefinitionRow[] = []
  for (const line of text.split(/\r?\n/)) {
    const cols = line.split(';')
    if (cols.length < 5) continue
    const id = Number(cols[0])
    // La fila 0 es "sin provincia"; las cabeceras o líneas raras no son números
    if (!Number.isInteger(id) || id <= 0) continue
    const [r, g, b] = [Number(cols[1]), Number(cols[2]), Number(cols[3])]
    if (![r, g, b].every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) continue
    const t = cols[4].trim().toLowerCase()
    rows.push({
      id,
      r,
      g,
      b,
      type:
        t === 'land'
          ? PROVINCE_TYPE.land
          : t === 'sea'
            ? PROVINCE_TYPE.sea
            : t === 'lake'
              ? PROVINCE_TYPE.lake
              : PROVINCE_TYPE.none,
      coastal: (cols[5] ?? '').trim().toLowerCase() === 'true',
      terrain: (cols[6] ?? '').trim(),
      continent: Number(cols[7] ?? 0) || 0
    })
  }
  return rows
}
