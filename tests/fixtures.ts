// Proyectos de ejemplo compartidos por las pruebas
import type { Project } from '../src/renderer/src/types'
import { createFocus } from '../src/renderer/src/ui/projectOps'

export function emptyProject(): Project {
  return {
    version: 2,
    modName: 'Mi Mod',
    tag: 'MEX',
    focuses: [],
    ideas: [],
    icons: [],
    countryFlags: []
  }
}

/** 2 focos: B tiene "completó el foco A", pone la marca "reforma" y depende de A */
export function withRefs(): Project {
  let p = createFocus(emptyProject(), 0, 0, 'Industrializar').project
  p = createFocus(p, 0, 1, 'Segundo').project
  const [a, b] = p.focuses
  const blocks = {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'slot_available',
          inputs: { BODY: { block: { type: 'cond_has_completed_focus', fields: { FOCUS: a.id } } } }
        },
        {
          type: 'slot_reward',
          inputs: { BODY: { block: { type: 'eff_set_country_flag', fields: { FLAG: 'reforma' } } } }
        }
      ]
    }
  }
  p.focuses[1] = {
    ...b,
    prerequisites: [a.uid],
    blocks,
    scripts: {
      available: `\thas_completed_focus = ${a.id}\n`,
      bypass: '',
      reward: '\tset_country_flag = reforma\n'
    }
  }
  return p
}
