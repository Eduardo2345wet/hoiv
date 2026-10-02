// Seguridad de nombres: un proyecto "." exportó un mod que apuntaba a toda la carpeta de mods
import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { validateProjectName, modSlug } from '../src/shared/names'
import { handleExportMod } from '../src/main/export'
import { createProjectFolder } from '../src/main/projectFiles'
import { findInvalidLeftovers } from '../src/main/reviewInstalled'
import { validateProject } from '../src/renderer/src/export/validator'
import { emptyProject } from './fixtures'

const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'hoi-names-'))
const payload = (dir: string, modName: string): Parameters<typeof handleExportMod>[0] => ({
  exportPath: dir,
  modName,
  tag: '',
  focusTreeScript: '',
  locYaml: 'l_english:\n',
  files: [{ path: 'common/x.txt', text: 'x' }],
  gameModsDir: 'C:/Docs/mod',
  supportedVersion: '1.19.*'
})

describe('nombres de proyecto', () => {
  it('rechaza vacío, ".", "..", "///" y caracteres prohibidos; acepta nombres normales', () => {
    for (const bad of [
      '',
      '   ',
      '.',
      '..',
      '///',
      'a/b',
      'a\\b',
      'a:b',
      'a*b',
      'a?b',
      'a"b',
      'a<b',
      'a>b',
      'a|b',
      'CON'
    ])
      expect(validateProjectName(bad), JSON.stringify(bad)).toBeTypeOf('string')
    for (const ok of ['Mi Mod México', 'mod-1', 'Prueba (2)', '.hidden mod'])
      expect(validateProjectName(ok), ok).toBeNull()
  })
  it('createProjectFolder rechaza nombres inválidos y no crea nada', () => {
    const parent = tmp()
    for (const bad of ['.', '..', '///', ''])
      expect(createProjectFolder(parent, bad, '{}').ok, bad).toBe(false)
    expect(fs.readdirSync(parent)).toEqual([])
  })
})

describe('slug del mod', () => {
  it('nunca es "", "." ni ".."', () => {
    for (const bad of ['', '.', '..', '///', '   ', '¡¡¡']) expect(modSlug(bad), bad).toBeNull()
    expect(modSlug('Mi Mod México')).toBe('mi_mod_mexico')
    expect(modSlug('a-b')).toMatch(/^[a-z0-9_-]+$/)
  })
  it('un proyecto con nombre inválido no se puede exportar (error del validador)', () => {
    for (const name of ['.', '..', '', '///']) {
      const issues = validateProject({ ...emptyProject(), modName: name })
      expect(
        issues.some(
          (i) => i.severity === 'error' && /nombre del mod|no tiene nombre/i.test(i.message)
        ),
        name
      ).toBe(true)
    }
    expect(
      validateProject({ ...emptyProject(), modName: 'Bueno' }).some((i) =>
        /nombre del mod no es válido/i.test(i.message)
      )
    ).toBe(false)
  })
  it('handleExportMod se niega y no escribe nada con "." ".." "" "///"', async () => {
    for (const name of ['.', '..', '', '///']) {
      const dir = tmp()
      fs.writeFileSync(path.join(dir, 'intacto.txt'), 'x')
      const r = await handleExportMod(payload(dir, name))
      expect(r.success, name).toBe(false)
      expect(fs.readdirSync(dir)).toEqual(['intacto.txt'])
    }
  })
  it('solo escribe y borra dentro de <carpeta>/<slug> y <slug>.mod', async () => {
    const dir = tmp()
    fs.mkdirSync(path.join(dir, 'vecino'))
    fs.writeFileSync(path.join(dir, 'vecino', 'a.txt'), 'a')
    const r1 = await handleExportMod(payload(dir, 'Mi Mod'))
    expect(r1.success).toBe(true)
    const r2 = await handleExportMod({ ...payload(dir, 'Mi Mod'), replacePrevious: true })
    expect(r2.success).toBe(true)
    expect(fs.readdirSync(dir).sort()).toEqual(['mi_mod', 'mi_mod.mod', 'vecino'])
    expect(fs.readFileSync(path.join(dir, 'vecino', 'a.txt'), 'utf-8')).toBe('a')
    const mod = fs.readFileSync(path.join(dir, 'mi_mod.mod'), 'utf-8')
    expect(mod).toMatch(/path="[^"]*\/mod\/mi_mod"/)
  })
})

describe('restos de un mod inválido en la carpeta de mods (solo lectura)', () => {
  it('detecta common/gfx/interface/localisation/history sueltas y .mod sin nombre', () => {
    const mods = tmp()
    for (const d of ['common', 'gfx', 'interface', 'localisation', 'history', 'bueno'])
      fs.mkdirSync(path.join(mods, d))
    fs.writeFileSync(path.join(mods, '..mod'), 'x')
    fs.writeFileSync(path.join(mods, '.mod'), 'x')
    fs.writeFileSync(path.join(mods, 'bueno.mod'), 'x')
    const before = fs.readdirSync(mods).sort()
    const r = findInvalidLeftovers(mods)
    expect(r.sort()).toEqual(
      ['.mod', '..mod', 'common', 'gfx', 'history', 'interface', 'localisation'].sort()
    )
    expect(fs.readdirSync(mods).sort()).toEqual(before) // no borra nada
    expect(findInvalidLeftovers(path.join(mods, 'nada'))).toEqual([])
  })
})
