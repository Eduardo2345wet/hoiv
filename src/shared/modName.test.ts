import { describe, expect, it } from 'vitest'
import { modFolderName } from './modName'
import { validateTag } from './tag'

describe('validateTag', () => {
  it('acepta tags válidos', () => {
    expect(validateTag('GER')).toBeNull()
    expect(validateTag('X01')).toBeNull()
  })
  it('rechaza formatos inválidos', () => {
    expect(validateTag('ger')).not.toBeNull()
    expect(validateTag('1AB')).not.toBeNull()
    expect(validateTag('GERM')).not.toBeNull()
    expect(validateTag('')).not.toBeNull()
  })
  it('rechaza palabras reservadas', () => {
    for (const t of ['NOT', 'AND', 'TAG', 'OOB', 'LOG', 'NUM', 'RED']) {
      expect(validateTag(t)).toMatch(/reservada/)
    }
  })
})

describe('modFolderName', () => {
  it('quita tildes, espacios y pasa a minúsculas', () => {
    expect(modFolderName('Mi Mod España')).toBe('mi_mod_espana')
  })
  it('usa un nombre por defecto si queda vacío', () => {
    expect(modFolderName('¡¡¡')).toBe('mi_mod')
  })
})
