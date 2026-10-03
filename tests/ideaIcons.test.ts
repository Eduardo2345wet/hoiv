import { describe, expect, it } from 'vitest'
import { emptyProjectFor } from '../src/renderer/src/templates'
import { createIdea, setIdeaGameSprite, setIdeaIcon } from '../src/renderer/src/ui/projectOps'
import { generateIdeas } from '../src/renderer/src/generator/ideas'
import { buildExtraFiles } from '../src/renderer/src/export/exportMod'
import { validateProject } from '../src/renderer/src/export/validator'

const base = () => createIdea(emptyProjectFor('Mi Mod', 'content'), 'Austeridad')

describe('íconos del juego para espíritus', () => {
  it('picture = nombre del sprite sin GFX_idea_ y no se copia ningún archivo del juego', async () => {
    const { project, idea } = base()
    const p = setIdeaGameSprite(project, idea.uid, 'GFX_idea_generic_tax_cuts')
    const i = p.ideas[0]
    expect(i.picture).toBe('generic_tax_cuts')
    expect(i.icon).toBeNull()
    expect(i.iconAuto).toBe(false)
    expect(p.icons.some((a) => a.id === `auto_${idea.uid}`)).toBe(false) // el automático se descarta
    expect(generateIdeas(p)).toContain('picture = generic_tax_cuts')
    const files = await buildExtraFiles(p, async () => ({
      width: 1,
      height: 1,
      rgba: new Uint8Array(4)
    }))
    const paths = files.map((f) => f.path)
    expect(paths.some((x) => x.endsWith('.dds') || x.endsWith('.gfx'))).toBe(false)
    expect(paths).toContain('common/ideas/mi_mod_ideas.txt')
  })

  it('elegir después un ícono propio limpia el picture', () => {
    const { project, idea } = base()
    let p = setIdeaGameSprite(project, idea.uid, 'GFX_idea_x')
    p = setIdeaIcon(p, idea.uid, { kind: 'asset', assetId: 'a1' })
    expect(p.ideas[0].picture).toBeUndefined()
  })

  it('el validador avisa si el sprite no existe en la versión del juego', () => {
    const { project, idea } = base()
    const p = setIdeaGameSprite(project, idea.uid, 'GFX_idea_se_borro')
    const game = { countries: [], ideaSprites: ['GFX_idea_otro'] } as never
    const w = validateProject(p, game).filter((i) => /no existe en esta versión/.test(i.message))
    expect(w).toHaveLength(1)
    expect(w[0].severity).toBe('aviso')
    const ok = validateProject(p, { countries: [], ideaSprites: ['GFX_idea_se_borro'] } as never)
    expect(ok.some((i) => /no existe en esta versión/.test(i.message))).toBe(false)
  })
})
