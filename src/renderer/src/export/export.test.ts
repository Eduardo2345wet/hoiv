import { describe, expect, it } from 'vitest'
import {
  addFocus,
  createProject,
  removeFocus,
  toggleMutuallyExclusive,
  togglePrerequisite,
  updateFocus,
  type Project
} from '../model/project'
import type { FocusScripts } from '../generator/focusScripts'
import { buildFocusBlocks, buildFocusTreeFile } from './focusTree'
import { buildLocalisation } from './localisation'
import { bracesBalanced, validateProject } from './validator'

const noScripts = (): FocusScripts => ({ available: '', bypass: '', completion_reward: '' })

function sampleProject(): Project {
  let p = createProject('Mi Mod', 'GER')
  const a = addFocus(p, 0, 0)
  p = a.project
  const b = addFocus(p, 0, 1)
  p = b.project
  const c = addFocus(p, 1, 1)
  p = c.project
  p = updateFocus(p, a.focus.uid, { id: 'GER_a', name: 'Foco A', description: 'Línea 1\nLínea 2' })
  p = updateFocus(p, b.focus.uid, { id: 'GER_b', name: 'Foco B' })
  p = updateFocus(p, c.focus.uid, { id: 'GER_c', name: 'Foco C' })
  p = togglePrerequisite(p, a.focus.uid, b.focus.uid)
  p = togglePrerequisite(p, a.focus.uid, c.focus.uid)
  p = toggleMutuallyExclusive(p, b.focus.uid, c.focus.uid)
  return p
}

describe('árbol de focos', () => {
  it('genera focus_tree con country, default y focos', () => {
    const p = sampleProject()
    const file = buildFocusTreeFile(p, buildFocusBlocks(p, noScripts))
    expect(file).toContain('focus_tree = {\n\tid = GER_focus_tree\n')
    expect(file).toContain('\tcountry = {\n\t\tfactor = 0\n\t\tmodifier = {\n\t\t\tadd = 10\n\t\t\ttag = GER\n\t\t}\n\t}\n')
    expect(file).toContain('\tdefault = no\n')
    expect(file).toContain('\t\tprerequisite = { focus = GER_a }\n')
    expect(file).toContain('\t\tmutually_exclusive = { focus = GER_c }\n')
    expect(file).toContain('\t\tmutually_exclusive = { focus = GER_b }\n')
    expect(file).toContain('\t\tcompletion_reward = {\n\t\t}\n')
    expect(file).not.toContain('available')
    expect(bracesBalanced(file)).toBe(true)
  })

  it('prerrequisitos "cualquiera" van en un solo bloque', () => {
    let p = sampleProject()
    const [a, b, c] = p.foci
    p = togglePrerequisite(p, b.uid, c.uid)
    p = updateFocus(p, c.uid, { prerequisiteMode: 'any' })
    const file = buildFocusTreeFile(p, buildFocusBlocks(p, noScripts))
    expect(file).toContain(`prerequisite = { focus = ${a.id} focus = ${b.id} }`)
  })

  it('al borrar un foco se limpian sus conexiones', () => {
    const p = sampleProject()
    const cleaned = removeFocus(p, p.foci[0].uid)
    expect(cleaned.foci.every((f) => f.prerequisites.length === 0)).toBe(true)
  })
})

describe('localización', () => {
  it('empieza con l_english: y escribe nombre y descripción', () => {
    const loc = buildLocalisation(sampleProject())
    expect(loc.startsWith('l_english:\n')).toBe(true)
    expect(loc).toContain(' GER_a:0 "Foco A"\n')
    expect(loc).toContain(' GER_a_desc:0 "Línea 1\\nLínea 2"\n')
  })
})

describe('validador', () => {
  const run = (p: Project): string[] => {
    const blocks = buildFocusBlocks(p, noScripts)
    return validateProject(p, blocks, buildFocusTreeFile(p, blocks)).map((i) => `${i.level}: ${i.message}`)
  }

  it('un proyecto correcto no tiene errores', () => {
    expect(run(sampleProject())).toEqual([])
  })

  it('detecta ids duplicados, focos sin nombre y prerrequisitos rotos', () => {
    let p = sampleProject()
    p = updateFocus(p, p.foci[1].uid, { id: 'GER_a' })
    p = updateFocus(p, p.foci[2].uid, { name: '' })
    p = updateFocus(p, p.foci[2].uid, { prerequisites: ['borrado'] })
    const issues = run(p)
    expect(issues.some((i) => i.includes('repetido'))).toBe(true)
    expect(issues.some((i) => i.includes('no tiene nombre'))).toBe(true)
    expect(issues.some((i) => i.includes('foco borrado'))).toBe(true)
  })

  it('detecta llaves desbalanceadas', () => {
    expect(bracesBalanced('a = { b = { }')).toBe(false)
    expect(bracesBalanced('a = } {')).toBe(false)
    expect(bracesBalanced('a = { name = "{" } # }')).toBe(true)
    const p = sampleProject()
    const blocks = buildFocusBlocks(p, () => ({ available: '', bypass: '', completion_reward: 'x = {\n' }))
    const issues = validateProject(p, blocks, buildFocusTreeFile(p, blocks))
    expect(issues.some((i) => i.message.includes('desbalanceadas'))).toBe(true)
  })

  it('detecta ciclos de prerrequisitos', () => {
    let p = sampleProject()
    p = togglePrerequisite(p, p.foci[1].uid, p.foci[0].uid)
    expect(run(p).some((i) => i.includes('ciclo'))).toBe(true)
  })
})
