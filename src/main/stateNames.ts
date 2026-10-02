// Nombres de estado (STATE_N): se buscan en TODOS los .yml de localisation/english, incluidas las
// carpetas replace/ y las de DLC.
import fs from 'fs'
import path from 'path'
import { decodeGameText } from '../shared/map/text'
import type { ModLayer } from './mods'

function parseLoc(text: string): Map<string, string> {
  const m = new Map<string, string>()
  for (const r of text.matchAll(/^\s*([A-Za-z0-9_.-]+):\d*\s*"(.*)"\s*$/gm)) m.set(r[1], r[2])
  return m
}

/** Todos los .yml de localisation/english (juego y luego mod); replace/ va al final y gana */
export function listLocFiles(gamePath: string, mod: ModLayer | null | undefined): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    try {
      for (const it of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, it.name)
        if (it.isDirectory()) walk(full)
        else if (it.name.endsWith('.yml')) out.push(full)
      }
    } catch {
      // carpeta inexistente
    }
  }
  walk(path.join(gamePath, 'localisation', 'english'))
  if (mod) walk(path.join(mod.path, 'localisation', 'english'))
  const isReplace = (f: string): boolean => /[\\/]replace[\\/]/i.test(f)
  return [...out.filter((f) => !isReplace(f)), ...out.filter(isReplace)]
}

/** STATE_N → nombre, leído de todos los archivos (el último gana) */
export function collectStateNames(files: string[]): Map<string, string> {
  const loc = new Map<string, string>()
  for (const f of files)
    try {
      const text = decodeGameText(new Uint8Array(fs.readFileSync(f)))
      if (!text.includes('STATE_')) continue
      for (const [k, v] of parseLoc(text)) if (k.startsWith('STATE_')) loc.set(k, v)
    } catch {
      // archivo ilegible
    }
  return loc
}
