// Lectura (SOLO LECTURA) de la carpeta de un mod para importarlo. Nunca escribe ni borra nada.
import fs from 'fs'
import path from 'path'

const DIRS = ['events', 'common/national_focus', 'common/ideas', 'common/decisions', 'localisation']
const MAX_FILES = 4000
const MAX_BYTES = 4 * 1024 * 1024

export interface ModReadResult {
  files: { path: string; text: string }[]
  /** name="…" del descriptor.mod, si existe */
  name: string | null
  skipped: number
}

export function readModFolder(folder: string): ModReadResult {
  const out: ModReadResult = { files: [], name: null, skipped: 0 }
  try {
    const d = fs.readFileSync(path.join(folder, 'descriptor.mod'), 'utf-8')
    out.name = /^\s*name\s*=\s*"([^"]*)"/m.exec(d)?.[1] ?? null
  } catch {
    // sin descriptor: se importa igual
  }
  const walk = (dir: string, rel: string): void => {
    let items: fs.Dirent[] = []
    try {
      items = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const it of items) {
      if (out.files.length >= MAX_FILES) return
      const r = `${rel}/${it.name}`
      const abs = path.join(dir, it.name)
      if (it.isSymbolicLink()) continue
      if (it.isDirectory()) walk(abs, r)
      else if (/\.(txt|yml)$/i.test(it.name)) {
        try {
          if (fs.statSync(abs).size > MAX_BYTES) {
            out.skipped++
            continue
          }
          out.files.push({ path: r, text: fs.readFileSync(abs, 'utf-8').replace(/^﻿/, '') })
        } catch {
          out.skipped++
        }
      }
    }
  }
  for (const d of DIRS) walk(path.join(folder, ...d.split('/')), d)
  return out
}
