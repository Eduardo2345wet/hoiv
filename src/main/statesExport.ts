// Exportación de estados: lee los BYTES originales del juego, aplica el parche mínimo
// y comprueba el resultado con jomini. Nunca reescribe el archivo con un serializador.
import fs from 'fs'
import path from 'path'
import { patchStateText, type StateTarget } from '../shared/map/statePatch'
import { decodeGameText } from '../shared/map/text'
import { statesFromParsed, type JominiParser } from '../shared/map/stateFile'
import { getJomini } from './mapLoader'
import { resolveGameFile, type ModLayer } from './mods'

export interface StatePatchRequest {
  /** Nombre del archivo en history/states (el mismo que se exportará) */
  file: string
  targets: StateTarget[]
}

export interface StatePatchResult {
  files: { path: string; data: Uint8Array }[]
  errors: { file: string; id?: number; message: string }[]
}

export async function planStatePatches(
  gamePath: string,
  requests: StatePatchRequest[],
  jomini?: JominiParser,
  /** Mod usado como base: se parcha A PARTIR de sus archivos (si los tiene) */
  mod: ModLayer | null = null,
  onProgress?: (done: number, total: number) => void
): Promise<StatePatchResult> {
  const parser = jomini ?? (await getJomini())
  const out: StatePatchResult = { files: [], errors: [] }
  let done = 0
  for (const req of requests) {
    onProgress?.(done++, requests.length)
    const err = (message: string, id?: number): void => {
      out.errors.push({ file: req.file, id, message })
    }
    if (req.file !== path.basename(req.file) || !req.file.endsWith('.txt')) {
      err('Nombre de archivo de estado no válido.')
      continue
    }
    let bytes: Buffer
    const src = resolveGameFile(gamePath, mod, `history/states/${req.file}`)
    try {
      if (!src) throw new Error()
      bytes = fs.readFileSync(src)
    } catch {
      err(`No se encontró el archivo en la carpeta del juego${mod ? ' ni en el mod' : ''}.`)
      continue
    }
    // latin1: 1 byte = 1 carácter, así los bytes que no tocamos quedan idénticos
    const res = patchStateText(bytes.toString('latin1'), req.targets)
    if (res.errors.length) {
      for (const e of res.errors) err(e.message, e.id)
      continue
    }
    const data = Buffer.from(res.text, 'latin1')

    // Comprobación: volver a leer con jomini y comparar owner y cores
    let ok = true
    try {
      const parsed = statesFromParsed(
        parser.parseText(decodeGameText(new Uint8Array(data))),
        req.file
      )
      for (const t of req.targets) {
        const s = parsed.find((x) => x.id === t.id)
        const want = [...new Set(t.cores)].sort().join(',')
        const pr = t.props
        const badProps =
          !!s &&
          !!pr &&
          ((pr.manpower !== undefined && s.manpower !== Math.round(pr.manpower)) ||
            (pr.category !== undefined && s.category !== pr.category) ||
            Object.entries(pr.resources ?? {}).some(([k, v]) => (s.resources?.[k] ?? 0) !== v) ||
            Object.entries(pr.buildings ?? {}).some(([k, v]) => (s.buildings?.[k] ?? 0) !== v) ||
            Object.entries(pr.provinceBuildings ?? {}).some(([p, b]) =>
              Object.entries(b).some(([k, v]) => (s.provinceBuildings?.[Number(p)]?.[k] ?? 0) !== v)
            ) ||
            Object.entries(pr.victoryPoints ?? {}).some(
              ([p, v]) => (s.victoryPoints.find((x) => x[0] === Number(p))?.[1] ?? 0) !== v
            ))
        if (badProps) {
          ok = false
          err(`Tras el parche, el estado ${t.id} no quedó con los datos esperados.`, t.id)
        }
        if (!s || s.owner !== t.owner || s.cores.join(',') !== want) {
          ok = false
          err(
            `Tras el parche, el estado ${t.id} no quedó como se esperaba (dueño ${s?.owner ?? '?'}, cores ${s?.cores.join(', ') || '—'}).`,
            t.id
          )
        }
      }
    } catch (e) {
      ok = false
      err(`El archivo parchado no se puede leer: ${e instanceof Error ? e.message : e}`)
    }
    if (ok) out.files.push({ path: `history/states/${req.file}`, data: new Uint8Array(data) })
  }
  return out
}
