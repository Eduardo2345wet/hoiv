import { describe, expect, it } from 'vitest'
import { cleanLoc } from '../src/shared/locText'
import { modifierLines, modifierSummary } from '../src/renderer/src/catalog/gameIdeas'
import { MODIFIERS, modifierLabel } from '../src/renderer/src/catalog/modifiers'
import type { GameIdea } from '../src/shared/ideasParse'

const dict: Record<string, string> = {
  AFG_shah: 'Zahir Shah',
  A: 'Hola $B$',
  B: 'mundo §Yamarillo§!',
  LOOP: '$LOOP$ otra vez'
}
const look = (k: string): string | undefined => dict[k]

describe('textos de localización del juego', () => {
  it('resuelve $CLAVE$ de forma recursiva, quita § y [ ] y nunca deja $…$', () => {
    expect(
      cleanLoc('$AFG_mohammad_zahir_shah_ns$', (k) =>
        k === 'AFG_mohammad_zahir_shah_ns' ? '$AFG_shah$' : dict[k]
      )
    ).toBe('Zahir Shah')
    expect(cleanLoc('$A$', look)).toBe('Hola mundo amarillo')
    expect(cleanLoc('§RAlerta§! en [Root.GetName]', look)).toBe('Alerta en')
    expect(cleanLoc('$NO_EXISTE$ y más', look)).toBe('y más')
    expect(cleanLoc('$LOOP$', look)).not.toMatch(/\$/) // límite de profundidad
    expect(cleanLoc('Precio $VALOR|Y$', look)).not.toMatch(/\$/)
  })
})

describe('modificadores en español', () => {
  it('las etiquetas no llevan nombres de código', () => {
    for (const m of MODIFIERS) expect(m.label).not.toMatch(/_|\(/)
    expect(modifierLabel('stability_factor')).toBe('Estabilidad')
    expect(modifierLabel('algo_raro_del_juego')).toBeNull()
  })
  it('el resumen sale como "Estabilidad +10 %" y cuenta los desconocidos', () => {
    const idea = {
      id: 'x',
      modifiers: [['stability_factor', 10]],
      extraModifierText: 'army_attack_factor = 0.05\nalgo_raro = 3'
    } as unknown as GameIdea
    const l = modifierLines(idea)
    expect(l.rows).toEqual(['Estabilidad +10 %', 'Ataque del ejército +5 %'])
    expect(l.others).toBe(1)
    expect(modifierSummary(idea)).toBe('Estabilidad +10 % · Ataque del ejército +5 % · +1 más')
    expect(modifierSummary(idea)).not.toMatch(/_factor/)
  })
})
