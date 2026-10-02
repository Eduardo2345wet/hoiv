// Exportar a mano: la app NUNCA escribe en la carpeta de mods del juego
import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { handleExportMod, exportPreviousExists, type ExportModPayload } from '../src/main/export'
import {
  defaultExportDir,
  hoi4ModsDir,
  supportedVersionFromLauncher,
  DEFAULT_SUPPORTED_VERSION
} from '../src/main/exportInfo'
import { findHoi4Documents, hoi4DocumentsCandidates } from '../src/main/hoi4Docs'

const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'hoi-exp-'))
const payload = (dir: string, extra: Partial<ExportModPayload> = {}): ExportModPayload => ({
  exportPath: dir,
  modName: 'Mi Mod',
  tag: '',
  focusTreeScript: '',
  locYaml: 'l_english:\n A:0 "a"\n',
  files: [{ path: 'common/ideas/x.txt', text: 'ideas = { }\n' }],
  gameModsDir: 'C:/Users/yo/Documents/Paradox Interactive/Hearts of Iron IV/mod',
  supportedVersion: '1.19.*',
  ...extra
})

describe('Exportar mod: carpeta elegida con dos cosas', () => {
  it('crea EXACTAMENTE <slug>/ y <slug>.mod, sin manifiesto', async () => {
    const dir = tmp()
    const r = await handleExportMod(payload(dir))
    expect(r.success).toBe(true)
    expect(fs.readdirSync(dir).sort()).toEqual(['mi_mod', 'mi_mod.mod'])
    const all = fs.readdirSync(path.join(dir, 'mi_mod'), { recursive: true }).map(String)
    expect(all.some((f) => f.includes('hoi4modstudio'))).toBe(false)
  })
  it('el .mod apunta a donde quedará DESPUÉS de copiar; descriptor.mod sin path ni BOM', async () => {
    const dir = tmp()
    await handleExportMod(payload(dir))
    const outer = fs.readFileSync(path.join(dir, 'mi_mod.mod'), 'utf-8')
    expect(outer).toContain(
      'path="C:/Users/yo/Documents/Paradox Interactive/Hearts of Iron IV/mod/mi_mod"'
    )
    expect(outer).not.toContain(dir.replace(/\\/g, '/'))
    expect(outer).toContain('supported_version="1.19.*"')
    const desc = fs.readFileSync(path.join(dir, 'mi_mod', 'descriptor.mod'))
    expect(desc.toString('utf-8')).not.toContain('path=')
    expect(desc.toString('utf-8')).toContain('supported_version="1.19.*"')
    expect([desc[0], desc[1], desc[2]]).not.toEqual([0xef, 0xbb, 0xbf])
    expect(outer.charCodeAt(0)).not.toBe(0xfeff)
  })
  it('si ya hay una exportación anterior, pide permiso; con permiso la borra COMPLETA', async () => {
    const dir = tmp()
    await handleExportMod(payload(dir))
    fs.writeFileSync(path.join(dir, 'mi_mod', 'viejo.txt'), 'x')
    fs.writeFileSync(path.join(dir, 'otro.txt'), 'no tocar')
    fs.mkdirSync(path.join(dir, 'otro_mod'))
    expect(exportPreviousExists(dir, 'Mi Mod')).toBe(true)
    const sin = await handleExportMod(payload(dir))
    expect(sin.success).toBe(false)
    expect(fs.existsSync(path.join(dir, 'mi_mod', 'viejo.txt'))).toBe(true)
    const con = await handleExportMod(payload(dir, { replacePrevious: true }))
    expect(con.success).toBe(true)
    expect(fs.existsSync(path.join(dir, 'mi_mod', 'viejo.txt'))).toBe(false)
    expect(fs.readFileSync(path.join(dir, 'otro.txt'), 'utf-8')).toBe('no tocar')
    expect(fs.existsSync(path.join(dir, 'otro_mod'))).toBe(true)
    expect(exportPreviousExists(tmp(), 'Mi Mod')).toBe(false)
  })
  it('nunca escribe en Documentos/Paradox Interactive/Hearts of Iron IV', async () => {
    const dir = path.join(tmp(), 'Paradox Interactive', 'Hearts of Iron IV', 'mod')
    fs.mkdirSync(dir, { recursive: true })
    const r = await handleExportMod(payload(dir))
    expect(r.success).toBe(false)
    expect(fs.readdirSync(dir)).toEqual([])
  })
})

describe('rutas y versión', () => {
  it('carpeta por defecto en el Escritorio y mods de HOI4 con "/"', () => {
    expect(defaultExportDir('C:\\Users\\yo\\Desktop', (...p) => p.join('\\'))).toBe(
      'C:\\Users\\yo\\Desktop\\HOI4 Mod Studio - Exportados'
    )
    expect(hoi4ModsDir('C:\\Users\\yo\\Documents\\Paradox Interactive\\Hearts of Iron IV')).toBe(
      'C:/Users/yo/Documents/Paradox Interactive/Hearts of Iron IV/mod'
    )
  })
  it('supported_version sale del launcher como "mayor.menor.*"', () => {
    expect(supportedVersionFromLauncher('{"version":"1.14.8"}')).toBe('1.14.*')
    expect(supportedVersionFromLauncher('{"rawVersion":"v1.19.2 (abcd)"}')).toBe('1.19.*')
    expect(supportedVersionFromLauncher('nada')).toBeNull()
    expect(DEFAULT_SUPPORTED_VERSION).toMatch(/^\d+\.\d+\.\*$/)
  })
  it('la detección de Documentos (solo para mostrar rutas) sigue considerando OneDrive', () => {
    const c = hoi4DocumentsCandidates(
      'C:\\Users\\a\\Documents',
      { OneDrive: 'C:\\Users\\a\\OneDrive' },
      (...p) => p.join('\\')
    )
    expect(findHoi4Documents(c, (p) => p.includes('OneDrive\\Documents'))).toContain('OneDrive')
  })
})

import { plannedPaths } from '../src/renderer/src/export/exportMod'
import { createFocus, deleteFocus } from '../src/renderer/src/ui/projectOps'
import { setIconRenderer } from '../src/renderer/src/icons/renderer'
import { emptyProject } from './fixtures'

describe('borrar un foco con ícono propio', () => {
  it('su .dds ya no se exporta', () => {
    setIconRenderer(() => 'data:image/png;base64,AAAA')
    let p = { ...emptyProject(), modName: 'Mi Mod' }
    p = createFocus(p, 0, 0, 'Industria', 'arbol_1').project
    p = createFocus(p, 0, 1, 'Ejército', 'arbol_1').project
    const dds = (q: typeof p): string[] => plannedPaths(q).filter((x) => x.endsWith('.dds'))
    expect(dds(p).length).toBe(2)
    expect(dds(deleteFocus(p, p.focuses[0].uid)).length).toBe(1)
  })
})
