import { emptySections } from '../src/renderer/src/sections/types'
// Proyectos de ejemplo compartidos por las pruebas
import { migrateFocusBlocks } from '../src/renderer/src/blocks/slots'
import { DEFAULT_MAP_SETTINGS, type Project } from '../src/renderer/src/types'
import { createFocus } from '../src/renderer/src/ui/projectOps'
import { newCountry } from '../src/renderer/src/countries/countryOps'

export function emptyProject(): Project {
  // Un país (MEX, nuevo) con su árbol de focos
  const country = {
    ...newCountry({ mode: 'existente', tag: 'MEX', name: 'México' }),
    focusTreeId: 'arbol_1'
  }
  return {
    ...emptySections(),
    version: 9,
    modName: 'Mi Mod',
    tag: 'MEX',
    countries: [country],
    focusTrees: [{ id: 'arbol_1', name: 'Árbol de MEX' }],
    focuses: [],
    ideas: [],
    icons: [],
    countryFlags: [],
    stateEdits: {},
    mapSettings: {
      ...DEFAULT_MAP_SETTINGS,
      base: 'game',
      noNation: { ...DEFAULT_MAP_SETTINGS.noNation }
    }
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
    blocks: migrateFocusBlocks(blocks),
    scripts: {
      available: `\thas_completed_focus = ${a.id}\n`,
      bypass: '',
      reward: '\tset_country_flag = reforma\n'
    }
  }
  return p
}
