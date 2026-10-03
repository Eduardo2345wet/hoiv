// Proyecto de ejemplo con contenido en todas las secciones (lo usan la prueba de regresión del
// rediseño y las pruebas de la interfaz).
import { emptyProjectFor } from '../src/renderer/src/templates'
import { addCountry, newCountry } from '../src/renderer/src/countries/countryOps'
import { createEvent } from '../src/renderer/src/sections/events'
import { createIdea } from '../src/renderer/src/ui/projectOps'
import { createCharacter } from '../src/renderer/src/sections/characters'
import { newTrack } from '../src/renderer/src/sections/extras'
import { createSuperEvent } from '../src/renderer/src/sections/superEvents'
import { createCategory, createDecision } from '../src/renderer/src/sections/decisions'
import { newDivision, newTemplate, updateOob } from '../src/renderer/src/sections/oob'
import { createIdeology, createTech } from '../src/renderer/src/sections/technologies'
import type { Project } from '../src/renderer/src/types'

const script = (code: string): { blocks: null; code: string } => ({ blocks: null, code })

export function sample(): Project {
  let p = { ...emptyProjectFor('Mi Mod', 'content'), techAdvanced: true }
  p = addCountry(p, newCountry({ mode: 'nuevo', tag: 'NVG', name: 'Nueva' }))
  p = createEvent(p, {
    namespace: 'guerra',
    number: 1,
    title: 'Estalla la guerra',
    description: 'Todo\\nempieza.',
    picture: { kind: 'game', gfx: 'GFX_report_event_generic' },
    immediate: script('\tadd_stability = -0.1\n'),
    options: [
      {
        uid: 'o1',
        name: 'Resistir',
        trigger: script(''),
        effects: script('\tadd_war_support = 0.1\n'),
        aiBase: 2
      },
      { uid: 'o2', name: 'Huir', trigger: script(''), effects: script(''), aiBase: 0 }
    ],
    flags: {
      triggeredOnly: true,
      fireOnlyOnce: true,
      major: false,
      hidden: false,
      minorFlavor: false
    }
  }).project
  p = createEvent(p, {
    type: 'news_event',
    namespace: 'guerra',
    number: 2,
    title: 'Noticia',
    description: 'Se supo.',
    flags: {
      triggeredOnly: true,
      fireOnlyOnce: false,
      major: true,
      hidden: false,
      minorFlavor: false
    }
  }).project
  p = createSuperEvent(p, {
    title: 'Caída',
    quote: 'Adiós',
    author: 'Alguien',
    button: 'Seguir'
  }).project
  p = createCategory(p, { name: 'Política', description: 'Cosas' }).project
  const cat = p.decisionCategories[0]
  p = createDecision(p, {
    name: 'Reformar',
    categoryUid: cat.uid,
    cost: { mode: 'pp', pp: 50, customTrigger: script(''), customText: '', aiHintPp: 0 },
    complete: script('\tadd_stability = 0.05\n'),
    aiBase: 1
  }).project
  p = createDecision(p, {
    name: 'Misión',
    categoryUid: cat.uid,
    kind: 'mission',
    missionTimeoutDays: 60
  }).project
  p = updateOob(p, 'NVG', (o) => {
    const t = {
      ...newTemplate(o, 'Infantería'),
      regiments: [
        { type: 'infantry', x: 0, y: 0 },
        { type: 'infantry', x: 0, y: 1 }
      ],
      support: [{ type: 'engineer', y: 0 }]
    }
    return {
      ...o,
      templates: [t],
      divisions: [newDivision({ ...o, templates: [t] }, 3030, { name: '1ª' })]
    }
  })
  p = createTech(p, {
    name: 'Fusil',
    folder: 'infantry_folder',
    x: 1,
    y: 2,
    cost: 2,
    year: 1938
  }).project
  p = createIdeology(p, {
    name: 'Liberal social',
    group: 'democratic',
    color: [10, 20, 30]
  }).project
  p = createIdea(p, 'Industria nacional').project
  // Personajes, música e idiomas (secciones sin cambios de formato en el rediseño)
  p = createCharacter(p, {
    name: 'Ana Torres',
    country: 'NVG',
    roles: ['advisor', 'corps_commander', 'country_leader', 'navy_leader']
  }).project
  p = {
    ...p,
    music: [newTrack({ name: 'Marcha', ogg: { name: 'a.ogg', base64: 'T2dnUwACAAAAAAAAAAA=' } })],
    languages: [{ code: 'english' }, { code: 'spanish', strings: { a: 'b' } }]
  }
  return p
}
