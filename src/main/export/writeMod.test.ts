import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { handleExportMod } from './writeMod'

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-export-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const payload = () => ({
  exportPath: dir,
  modName: 'Mi Mod "España"',
  tag: 'SPR',
  focusTreeScript: 'focus_tree = {\n}\n',
  locYaml: 'l_english:\n SPR_a:0 "A"\n'
})

describe('handleExportMod', () => {
  it('crea los 4 archivos con la codificación correcta', async () => {
    const result = await handleExportMod(payload())
    expect(result.success).toBe(true)

    const modFile = fs.readFileSync(path.join(dir, 'mi_mod_espana.mod'), 'utf-8')
    expect(modFile.charCodeAt(0)).not.toBe(0xfeff)
    expect(modFile).toContain(`name="Mi Mod 'España'"`)
    expect(modFile).toContain(`path="${path.join(dir, 'mi_mod_espana').replace(/\\/g, '/')}"`)

    const descriptor = fs.readFileSync(path.join(dir, 'mi_mod_espana', 'descriptor.mod'), 'utf-8')
    expect(descriptor.charCodeAt(0)).not.toBe(0xfeff)
    expect(descriptor).not.toContain('path=')

    const focus = fs.readFileSync(
      path.join(dir, 'mi_mod_espana', 'common', 'national_focus', 'SPR_focus.txt'),
      'utf-8'
    )
    expect(focus).toBe('focus_tree = {\n}\n')

    const loc = fs.readFileSync(
      path.join(dir, 'mi_mod_espana', 'localisation', 'english', 'mi_mod_espana_l_english.yml'),
      'utf-8'
    )
    expect(loc.charCodeAt(0)).toBe(0xfeff)
    expect(loc.slice(1).startsWith('l_english:')).toBe(true)
  })

  it('rechaza tags inválidos', async () => {
    const result = await handleExportMod({ ...payload(), tag: 'NOT' })
    expect(result.success).toBe(false)
  })

  it('nunca escribe en la carpeta del juego', async () => {
    fs.writeFileSync(path.join(dir, 'hoi4.exe'), '')
    const result = await handleExportMod(payload())
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/instalación del juego/)
  })
})
