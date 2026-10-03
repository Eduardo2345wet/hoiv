// Lectura de history/states/*.txt con jomini (el parser de archivos de Paradox).
// Se toman owner, add_core_of y victory_points del bloque history de NIVEL SUPERIOR,
// y se marcan los bloques con fecha que cambian owner o cores.
import type { MapState } from './types'

/** Lo mínimo que usamos de jomini (así las pruebas y el proceso principal comparten código) */
export interface JominiParser {
  parseText(data: string | Uint8Array): unknown
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const asArray = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v]
const DATE_KEY = /^\d{1,4}\.\d{1,2}\.\d{1,2}$/
// Patrón real (HOI4 1.19.3): 1938.10.25 = { if = { limit = { … } remove_core_of = GXC  CHI = { transfer_state = PREV } } }
// por verificar: que no haya otras claves de "cambio con fecha" de dueño o cores
const CHANGE_KEYS = ['owner', 'add_core_of', 'remove_core_of', 'controller', 'transfer_state']

/** ¿Hay un cambio de dueño/cores en el bloque, aunque esté dentro de if o de TAG = { }? (sin mirar limit) */
function hasChange(blk: any): boolean {
  if (!blk || typeof blk !== 'object' || Array.isArray(blk)) return false
  for (const [k, v] of Object.entries(blk)) {
    if (k === 'limit') continue
    if (CHANGE_KEYS.includes(k)) return true
    if (asArray<any>(v).some((x) => hasChange(x))) return true
  }
  return false
}

export function statesFromParsed(parsed: any, file: string): MapState[] {
  const out: MapState[] = []
  for (const st of asArray<any>(parsed?.state)) {
    const id = Number(st?.id)
    if (!Number.isInteger(id) || id <= 0) continue
    const history = asArray<any>(st.history)[0] ?? {}
    const vps = asArray<any>(history.victory_points)
    // jomini: un solo par = [prov, val]; varios = [[prov, val], ...]
    const pairs: [number, number][] = (vps.length && !Array.isArray(vps[0]) ? [vps] : vps)
      .filter((p: any) => Array.isArray(p) && p.length >= 2)
      .map((p: any) => [Number(p[0]), Number(p[1])])
    const hasDatedChanges = Object.keys(history).some(
      (k) => DATE_KEY.test(k) && asArray<any>(history[k]).some((blk) => hasChange(blk))
    )
    const num = (o: any): Record<string, number> => {
      const r: Record<string, number> = {}
      for (const [k, v] of Object.entries(o ?? {})) if (typeof v === 'number') r[k] = v
      return r
    }
    const bl = asArray<any>(history.buildings)[0] ?? {}
    const provinceBuildings: Record<number, Record<string, number>> = {}
    for (const [k, v] of Object.entries(bl))
      if (/^\d+$/.test(k) && v && typeof v === 'object' && !Array.isArray(v))
        provinceBuildings[Number(k)] = num(v)
    const nameKey = String(st.name ?? `STATE_${id}`)
    out.push({
      id,
      nameKey,
      name: nameKey,
      file,
      provinces: asArray<any>(st.provinces)
        .map(Number)
        .filter((n) => Number.isInteger(n)),
      owner: String(history.owner ?? ''),
      cores: [...new Set(asArray<any>(history.add_core_of).map(String))].sort(),
      victoryPoints: pairs,
      category: String(st.state_category ?? ''),
      manpower: Number.isFinite(Number(st.manpower)) ? Number(st.manpower) : undefined,
      resources: num(asArray<any>(st.resources)[0]),
      buildings: num(bl),
      provinceBuildings,
      hasDatedChanges
    })
  }
  return out
}

export function parseStateFile(parser: JominiParser, text: string, file: string): MapState[] {
  return statesFromParsed(parser.parseText(text), file)
}
