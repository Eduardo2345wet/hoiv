// Caja de herramientas (panel lateral de Blockly) con los bloques agrupados por categoría.

import { COLOURS } from './definitions'

const blocks = (types: string[]): { kind: 'block'; type: string }[] =>
  types.map((type) => ({ kind: 'block', type }))

export const TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Condiciones',
      colour: COLOURS.condition,
      contents: blocks([
        'pdx_has_government',
        'pdx_has_completed_focus',
        'pdx_has_war',
        'pdx_is_in_faction',
        'pdx_tag',
        'pdx_has_idea',
        'pdx_owns_state',
        'pdx_has_country_flag',
        'pdx_date',
        'pdx_has_political_power'
      ])
    },
    {
      kind: 'category',
      name: 'Lógica (NO / O / Y)',
      colour: COLOURS.logic,
      contents: blocks(['pdx_not', 'pdx_or', 'pdx_and'])
    },
    {
      kind: 'category',
      name: 'Efectos',
      colour: COLOURS.effect,
      contents: blocks([
        'pdx_add_political_power',
        'pdx_add_stability',
        'pdx_add_war_support',
        'pdx_add_manpower',
        'pdx_army_experience',
        'pdx_add_research_slot',
        'pdx_add_ideas',
        'pdx_add_equipment_to_stockpile',
        'pdx_add_building_construction',
        'pdx_set_country_flag',
        'pdx_country_event'
      ])
    },
    {
      kind: 'category',
      name: 'Territorio y guerra',
      colour: COLOURS.effect,
      contents: blocks([
        'pdx_add_state_core',
        'pdx_add_state_claim',
        'pdx_transfer_state',
        'pdx_create_wargoal',
        'pdx_declare_war_on',
        'pdx_puppet',
        'pdx_create_faction',
        'pdx_add_to_faction'
      ])
    },
    {
      kind: 'category',
      name: 'Si / entonces',
      colour: COLOURS.control,
      contents: blocks(['pdx_if'])
    }
  ]
}
