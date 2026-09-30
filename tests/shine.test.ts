// Sprites _shine de los focos (sin ellos el árbol del juego muestra "?" con laureles)
import { describe, expect, it } from 'vitest'
import { createFocus, setFocusIcon } from '../src/renderer/src/ui/projectOps'
import { planIconExport } from '../src/renderer/src/export/gfx'
import { buildExtraFiles } from '../src/renderer/src/export/exportMod'
import { validateProject } from '../src/renderer/src/export/validator'
import { SHINE_TEMPLATE, shineShape } from '../src/shared/shine'
import { setIconRenderer } from '../src/renderer/src/icons/renderer'
import type { Project } from '../src/renderer/src/types'
import { emptyProject } from './fixtures'

setIconRenderer((r, t) => `fake:${t}:${r.emoji}`)

/** 2 focos con ícono propio (emoji automático) y 1 con ícono del juego */
function project(): Project {
  let p = createFocus(emptyProject(), 0, 0, 'Industrializar').project
  p = createFocus(p, 1, 0, 'Gran flota').project
  const r = createFocus(p, 2, 0, 'Genérico')
  return setFocusIcon(r.project, r.focus.uid, { kind: 'game', gfx: 'GFX_goal_generic_production' })
}

describe('sprites _shine de los focos', () => {
  it('uno por cada ícono propio, con el mismo texturefile y animationmaskfile; ninguno para los del juego', async () => {
    const plan = planIconExport(project())
    expect(plan.focusSprites).toHaveLength(2)
    expect(plan.shineSprites.map((s) => s.name)).toEqual(plan.focusSprites.map((n) => `${n}_shine`))
    expect(plan.shinePath).toBe('interface/mi_mod_goals_shine.gfx')
    expect(plan.shineGfx).not.toContain('GFX_goal_generic_production')

    // Cada _shine usa el MISMO .dds que su sprite normal
    const normal = new Map<string, string>()
    for (const m of plan.gfx.matchAll(/name = "([^"]+)"\n\t\ttexturefile = "([^"]+)"/g))
      normal.set(m[1], m[2])
    const entries = plan.shineGfx.split('\tspriteType = {').slice(1)
    expect(entries).toHaveLength(2)
    for (const e of entries) {
      const name = e.match(/name = "([^"]+)_shine"/)![1]
      const file = normal.get(name)!
      expect(file).toMatch(/^gfx\/interface\/goals\/.+\.dds$/)
      expect(e).toContain(`texturefile = "${file}"`)
      expect(e.match(/animationmaskfile = "([^"]+)"/g)).toEqual([
        `animationmaskfile = "${file}"`,
        `animationmaskfile = "${file}"`
      ])
      expect(e).toContain('animationtexturefile = "gfx/interface/goals/shine_overlay.dds"')
      expect(e).toContain('effectFile = "gfx/FX/buttonstate.lua"')
      expect(e).toContain('legacy_lazy_load = no')
    }
    expect(plan.shineGfx.match(/\{/g)!.length).toBe(plan.shineGfx.match(/\}/g)!.length)

    // La exportación escribe el archivo y NO copia shine_overlay.dds
    const files = await buildExtraFiles(project(), async () => ({
      width: 100,
      height: 88,
      rgba: new Uint8Array(100 * 88 * 4)
    }))
    expect(files.find((f) => f.path === 'interface/mi_mod_goals_shine.gfx')?.text).toBe(
      plan.shineGfx
    )
    expect(files.some((f) => f.path.includes('shine_overlay'))).toBe(false)
  })

  it('sin íconos propios no se genera el archivo', () => {
    let p = createFocus(emptyProject(), 0, 0, 'X')
    const q = setFocusIcon(p.project, p.focus.uid, { kind: 'game', gfx: 'GFX_goal_generic_trade' })
    expect(planIconExport(q).shineGfx).toBe('')
    void p
  })

  it('validador: _shine repetido es ERROR; plantilla distinta a la del juego es AVISO', () => {
    let p = createFocus(emptyProject(), 0, 0, 'Uno').project
    p = createFocus(p, 1, 0, 'Dos').project
    p.focuses[0].id = 'MEX_abc'
    p.focuses[1].id = 'mex_ABC'
    const errs = validateProject(p)
      .filter((i) => i.severity === 'error')
      .map((i) => i.message)
    expect(errs.some((m) => m.includes('_shine" se repite'))).toBe(true)

    const ok = project()
    const same = { countries: [], ideas: [], goalsShineShape: shineShape(SHINE_TEMPLATE) }
    const diff = { ...same, goalsShineShape: 'spritetype name texturefile' }
    const aviso = (g: typeof same): boolean =>
      validateProject(ok, g).some((i) => i.message.includes('plantilla de brillo'))
    expect(aviso(same)).toBe(false)
    expect(aviso(diff)).toBe(true)
  })

  it('la forma de la plantilla coincide con la de una entrada escrita como en el juego', () => {
    const real = SHINE_TEMPLATE.replaceAll('{NAME}', 'GFX_goal_generic_production').replaceAll(
      '{FILE}',
      'gfx/interface/goals/goal_generic_production.dds'
    )
    expect(shineShape(real)).toBe(shineShape(SHINE_TEMPLATE))
    expect(shineShape(SHINE_TEMPLATE)).toMatch(
      /^spritetype name texturefile effectfile animation animationmaskfile/
    )
  })
})
