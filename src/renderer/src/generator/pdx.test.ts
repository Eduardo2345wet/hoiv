import { describe, expect, it } from 'vitest'
import type { BlocklyState } from '../model/project'
import { generateFocusScripts } from './focusScripts'

// Estado de Blockly escrito a mano, igual que el que guarda el editor.
const state: BlocklyState = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'pdx_slot_available',
        inputs: {
          STACK: {
            block: {
              type: 'pdx_has_government',
              fields: { GOV: 'fascism' },
              next: {
                block: {
                  type: 'pdx_not',
                  inputs: {
                    STACK: { block: { type: 'pdx_has_war', fields: { VALUE: 'yes' } } }
                  }
                }
              }
            }
          }
        }
      },
      { type: 'pdx_slot_bypass' },
      {
        type: 'pdx_slot_reward',
        inputs: {
          STACK: {
            block: {
              type: 'pdx_add_political_power',
              fields: { AMOUNT: 150 },
              next: {
                block: {
                  type: 'pdx_add_stability',
                  fields: { PERCENT: 5 },
                  next: {
                    block: {
                      type: 'pdx_add_building_construction',
                      fields: { STATE: 64, LEVEL: 2, BUILDING: 'arms_factory', INSTANT: 'yes' },
                      next: {
                        block: {
                          type: 'pdx_if',
                          inputs: {
                            LIMIT: { block: { type: 'pdx_tag', fields: { TAG: 'GER' } } },
                            DO: { block: { type: 'pdx_country_event', fields: { EVENT: 'mi.1', DAYS: 3 } } }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    ]
  }
}

describe('generador PDX', () => {
  it('genera el script de las 3 ranuras', () => {
    const scripts = generateFocusScripts(state)
    expect(scripts.available).toBe('has_government = fascism\nNOT = {\n\thas_war = yes\n}\n')
    expect(scripts.bypass).toBe('')
    expect(scripts.completion_reward).toBe(
      [
        'add_political_power = 150',
        'add_stability = 0.05',
        '64 = {',
        '\tadd_building_construction = {',
        '\t\ttype = arms_factory',
        '\t\tlevel = 2',
        '\t\tinstant_build = yes',
        '\t}',
        '}',
        'if = {',
        '\tlimit = {',
        '\t\ttag = GER',
        '\t}',
        '\tcountry_event = {',
        '\t\tid = mi.1',
        '\t\tdays = 3',
        '\t}',
        '}',
        ''
      ].join('\n')
    )
  })

  it('devuelve ranuras vacías sin bloques', () => {
    expect(generateFocusScripts(null)).toEqual({ available: '', bypass: '', completion_reward: '' })
  })
})
