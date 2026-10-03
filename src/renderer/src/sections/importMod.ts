// Importar un mod existente (SOLO LECTURA): trae focos, eventos, decisiones y espíritus al proyecto.
// Lo que no se entiende se guarda como texto (extraText) y se exporta tal cual. Nunca escribe en la
// carpeta del mod original: recibe los archivos ya leídos.
import type { Focus, Idea, Project } from '../types'
import { newUid } from '../types'
import {
  find,
  findAll,
  parseYml,
  restCode,
  codeOf,
  scan,
  val,
  type Stmt
} from '../../../shared/modScan'
import { parseGameIdeas } from '../../../shared/ideasParse'
import { newEvent } from './events'
import { newCategory, newDecision } from './decisions'
import type { BlockScript, Decision, DecisionCategory, EventOption, GameEvent } from './types'

export interface ImportFile {
  /** Ruta relativa dentro del mod, con "/" */
  path: string
  text: string
}

export interface ImportReport {
  focusTrees: number
  focuses: number
  events: number
  decisions: number
  categories: number
  ideas: number
  /** Cosas que se saltaron o que quedaron como texto avanzado */
  notes: string[]
}

const script = (stmt: Stmt | undefined): BlockScript => ({ blocks: null, code: codeOf(stmt) })
const num = (s: string | undefined, d = 0): number =>
  s !== undefined && Number.isFinite(Number(s)) ? Number(s) : d
const yes = (s: string | undefined): boolean => s === 'yes'

/** Localización en inglés de todos los .yml del mod (claves repetidas: gana la última) */
export function importLoc(files: ImportFile[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of files)
    if (/^localisation\/.+\.yml$/i.test(f.path) && /^\s*l_english:/m.test(f.text.replace(/^\uFEFF/, '')))
      Object.assign(out, parseYml(f.text))
  return out
}

const under = (files: ImportFile[], dir: string): ImportFile[] =>
  files.filter((f) => f.path.startsWith(dir) && f.path.endsWith('.txt'))

// ---------------------------------------------------------------- eventos

function importEvents(
  p: Project,
  files: ImportFile[],
  loc: Record<string, string>,
  rep: ImportReport
): Project {
  let out = p
  for (const f of under(files, 'events/')) {
    const top = scan(f.text)
    if (!top) {
      rep.notes.push(`${f.path}: no se pudo leer (llaves desbalanceadas).`)
      continue
    }
    for (const ev of top) {
      if (!ev.block || !['country_event', 'news_event', 'state_event'].includes(ev.key)) continue
      const id = val(ev.block, 'id') ?? ''
      const m = /^(.+)\.(\d+)$/.exec(id)
      if (!m) {
        rep.notes.push(`${f.path}: evento con id "${id}" no válido (se espera namespace.número).`)
        continue
      }
      const [, namespace, number] = m
      if (out.events.some((e) => e.namespace === namespace && e.number === Number(number))) {
        rep.notes.push(`Evento ${id}: ya existe en el proyecto (se saltó).`)
        continue
      }
      const text = (key: string | undefined): string => (key ? (loc[key] ?? key) : '')
      const variants = (key: string): GameEvent['titleVariants'] =>
        findAll(ev.block, key)
          .filter((x) => x.block)
          .map((x) => ({
            text: text(val(x.block, 'text')),
            trigger: script(find(x.block, 'trigger'))
          }))
      const plain = (key: string): string | undefined =>
        findAll(ev.block, key).find((x) => !x.block)?.value ?? undefined
      const h = (k: string): boolean => yes(val(ev.block, k))
      const options: EventOption[] = findAll(ev.block, 'option')
        .filter((o) => o.block)
        .map((o) => {
          const ai = find(o.block, 'ai_chance')
          return {
            uid: newUid(),
            name: text(val(o.block, 'name')),
            trigger: script(find(o.block, 'trigger')),
            effects: {
              blocks: null,
              code: restCode(f.text, o.block, ['name', 'trigger', 'ai_chance'])
            },
            aiBase: num(val(ai?.block, 'base'), ai ? 1 : 1)
          }
        })
      const mtth = find(ev.block, 'mean_time_to_happen')
      const pic = plain('picture')
      const handled = [
        'id',
        'title',
        'desc',
        'picture',
        'is_triggered_only',
        'fire_only_once',
        'major',
        'hidden',
        'minor_flavor',
        'trigger',
        'immediate',
        'after',
        'mean_time_to_happen',
        'timeout_days',
        'option'
      ]
      const extra = restCode(f.text, ev.block, handled)
      const event = newEvent(out, {
        type: ev.key as GameEvent['type'],
        namespace,
        number: Number(number),
        title: text(plain('title')),
        description: text(plain('desc')),
        titleVariants: variants('title'),
        descVariants: variants('desc'),
        picture: pic ? { kind: 'game', gfx: pic } : null,
        trigger: script(find(ev.block, 'trigger')),
        immediate: script(find(ev.block, 'immediate')),
        after: script(find(ev.block, 'after')),
        options: options.length ? options : [],
        mtthDays: mtth ? num(val(mtth.block, 'days')) : 0,
        timeoutDays: num(val(ev.block, 'timeout_days')),
        extraText: extra || undefined,
        flags: {
          triggeredOnly: h('is_triggered_only'),
          fireOnlyOnce: h('fire_only_once'),
          major: h('major'),
          hidden: h('hidden'),
          minorFlavor: h('minor_flavor')
        }
      })
      if (extra) rep.notes.push(`Evento ${id}: algunas sentencias quedaron como texto avanzado.`)
      out = { ...out, events: [...out.events, event] }
      rep.events++
    }
  }
  return out
}

// ---------------------------------------------------------------- decisiones

function tagsOf(allowed: Stmt | undefined): string[] | null {
  if (!allowed?.block) return null
  const k = allowed.block
  const tag = (s: Stmt): string | null =>
    (s.key === 'original_tag' || s.key === 'tag') && s.block === null ? s.value : null
  if (k.length === 1 && tag(k[0])) return [tag(k[0])!]
  if (k.length === 1 && k[0].key === 'OR' && k[0].block?.every((x) => tag(x)))
    return k[0].block.map((x) => tag(x)!)
  return null
}

function importDecisions(
  p: Project,
  files: ImportFile[],
  loc: Record<string, string>,
  rep: ImportReport
): Project {
  let out = p
  const cats = new Map<string, DecisionCategory>()
  for (const c of out.decisionCategories) cats.set(c.id, c)
  const ensureCat = (id: string): DecisionCategory => {
    let c = cats.get(id)
    if (!c) {
      c = newCategory(out, { id, name: loc[id] ?? id, description: loc[`${id}_desc`] ?? '' })
      c.id = id
      cats.set(id, c)
      out = { ...out, decisionCategories: [...out.decisionCategories, c] }
      rep.categories++
    }
    return c
  }
  // Categorías declaradas
  for (const f of under(files, 'common/decisions/categories/')) {
    const top = scan(f.text)
    if (!top) {
      rep.notes.push(`${f.path}: no se pudo leer.`)
      continue
    }
    for (const c of top) {
      if (!c.block || cats.has(c.key)) continue
      const icon = val(c.block, 'icon')
      const pic = val(c.block, 'picture')
      const area = find(c.block, 'on_map_area')
      const cat = newCategory(out, {
        name: loc[c.key] ?? c.key,
        description: loc[`${c.key}_desc`] ?? '',
        icon: icon ? { kind: 'game', gfx: `GFX_decision_category_${icon}` } : null,
        picture: pic ? { kind: 'game', gfx: pic } : null,
        priority: num(val(c.block, 'priority')),
        visibleWhenEmpty: yes(val(c.block, 'visible_when_empty')),
        mapArea: area?.block
          ? {
              x: num(val(area.block, 'x')),
              y: num(val(area.block, 'y')),
              zoom: num(val(area.block, 'zoom'), 100)
            }
          : null,
        highlightStates: (find(find(c.block, 'highlight_states')?.block, 'states')?.block ?? [])
          .map((s) => Number(s.key))
          .filter(Number.isFinite)
      })
      cat.id = c.key
      cats.set(c.key, cat)
      out = { ...out, decisionCategories: [...out.decisionCategories, cat] }
      rep.categories++
    }
  }
  // Decisiones
  for (const f of files.filter(
    (x) =>
      x.path.startsWith('common/decisions/') &&
      !x.path.startsWith('common/decisions/categories/') &&
      x.path.endsWith('.txt')
  )) {
    const top = scan(f.text)
    if (!top) {
      rep.notes.push(`${f.path}: no se pudo leer.`)
      continue
    }
    for (const catStmt of top) {
      if (!catStmt.block) continue
      const cat = ensureCat(catStmt.key)
      for (const d of catStmt.block) {
        if (!d.block) continue
        if (out.decisions.some((x) => x.id === d.key)) {
          rep.notes.push(`Decisión ${d.key}: ya existe en el proyecto (se saltó).`)
          continue
        }
        const b = d.block
        const tags = tagsOf(find(b, 'allowed'))
        const hasAllowed = !!find(b, 'allowed')
        const cost = val(b, 'cost')
        const customTrig = find(b, 'custom_cost_trigger')
        const ai = find(b, 'ai_will_do')
        const mods = find(b, 'modifier')
        const modsOk =
          !!mods?.block &&
          mods.block.every((m) => m.block === null && Number.isFinite(Number(m.value)))
        const stateTarget = yes(val(b, 'state_target'))
        const targets = (find(b, 'targets')?.block ?? []).map((x) => x.key)
        const handled = [
          'icon',
          'priority',
          'cost',
          'custom_cost_trigger',
          'custom_cost_text',
          'ai_hint_pp_cost',
          'days_re_enable',
          'fire_only_once',
          'days_remove',
          'visible',
          'available',
          'complete_effect',
          'remove_effect',
          'timeout_effect',
          'cancel_effect',
          'cancel_trigger',
          'activation',
          'days_mission_timeout',
          'selectable_mission',
          'is_good',
          'state_target',
          'targets',
          'target_trigger',
          'on_map_mode',
          'war_with_on_complete',
          'war_with_on_remove',
          'ai_will_do'
        ]
        if (tags || !hasAllowed) handled.push('allowed')
        if (modsOk) handled.push('modifier')
        const icon = val(b, 'icon')
        const extra = restCode(f.text, b, handled)
        const kind: Decision['kind'] =
          val(b, 'days_mission_timeout') !== undefined
            ? 'mission'
            : stateTarget
              ? 'target-state'
              : find(b, 'targets') || find(b, 'target_trigger')
                ? 'target-country'
                : 'normal'
        const dec = newDecision(out, {
          categoryUid: cat.uid,
          kind,
          name: loc[d.key] ?? d.key,
          description: loc[`${d.key}_desc`] ?? '',
          icon: icon ? { kind: 'game', gfx: `GFX_decision_${icon}` } : null,
          priority: num(val(b, 'priority')),
          countries: tags ?? [],
          visible: script(find(b, 'visible')),
          available: script(find(b, 'available')),
          complete: script(find(b, 'complete_effect')),
          remove: script(find(b, 'remove_effect')),
          timeout: script(find(b, 'timeout_effect')),
          cancel: script(find(b, 'cancel_effect')),
          cancelTrigger: script(find(b, 'cancel_trigger')),
          cost: {
            mode: customTrig
              ? 'custom'
              : cost !== undefined && Number.isFinite(Number(cost))
                ? 'pp'
                : 'none',
            pp: num(cost),
            customTrigger: script(customTrig),
            customText: loc[val(b, 'custom_cost_text') ?? ''] ?? '',
            aiHintPp: num(val(b, 'ai_hint_pp_cost'))
          },
          daysReEnable: num(val(b, 'days_re_enable')),
          fireOnlyOnce: yes(val(b, 'fire_only_once')),
          daysRemove: num(val(b, 'days_remove')),
          modifiers: modsOk
            ? mods!.block!.map((m) => ({ key: m.key, value: Number(m.value) }))
            : [],
          aiBase: num(val(ai?.block, 'base')),
          aiModifiers: findAll(ai?.block, 'modifier').map((m) => ({
            factor: num(val(m.block, 'factor'), 1),
            trigger: { blocks: null, code: restCode(f.text, m.block, ['factor']) }
          })),
          missionTimeoutDays: num(val(b, 'days_mission_timeout')),
          selectableMission: yes(val(b, 'selectable_mission')),
          isGood: val(b, 'is_good') !== 'no',
          activation: script(find(b, 'activation')),
          targetCountries: stateTarget ? [] : targets,
          targetStates: stateTarget ? targets.map(Number).filter(Number.isFinite) : [],
          targetTrigger: script(find(b, 'target_trigger')),
          onMapMode: val(b, 'on_map_mode') ?? '',
          warWithOnComplete: val(b, 'war_with_on_complete') ?? '',
          warWithOnRemove: val(b, 'war_with_on_remove') ?? '',
          extraText: extra || undefined
        })
        dec.id = d.key
        if (extra)
          rep.notes.push(`Decisión ${d.key}: algunas sentencias quedaron como texto avanzado.`)
        out = { ...out, decisions: [...out.decisions, dec] }
        rep.decisions++
      }
    }
  }
  return out
}

// ---------------------------------------------------------------- espíritus

function importIdeas(
  p: Project,
  files: ImportFile[],
  loc: Record<string, string>,
  rep: ImportReport
): Project {
  let out = p
  for (const f of under(files, 'common/ideas/')) {
    let list
    try {
      list = parseGameIdeas(f.text, f.path)
    } catch {
      rep.notes.push(`${f.path}: no se pudo leer.`)
      continue
    }
    for (const g of list) {
      if (g.tab !== 'espiritus') {
        rep.notes.push(
          `Idea ${g.id}: es de la categoría "${g.category}" (solo se importan los espíritus nacionales).`
        )
        continue
      }
      if (out.ideas.some((i) => i.id === g.id)) {
        rep.notes.push(`Espíritu ${g.id}: ya existe en el proyecto (se saltó).`)
        continue
      }
      const idea: Idea = {
        uid: newUid(),
        id: g.id,
        idAuto: false,
        name: loc[g.id] ?? g.id,
        description: loc[`${g.id}_desc`] ?? '',
        modifiers: g.modifiers.map(([key, value]) => ({ key, value })),
        icon: null,
        iconAuto: false,
        picture: g.picture || undefined,
        extraModifierText: g.extraModifierText || undefined,
        extraText: g.extraText || undefined
      }
      out = { ...out, ideas: [...out.ideas, idea] }
      rep.ideas++
    }
  }
  return out
}

// ---------------------------------------------------------------- focos

function importFocuses(
  p: Project,
  files: ImportFile[],
  loc: Record<string, string>,
  rep: ImportReport
): Project {
  let out = p
  for (const f of under(files, 'common/national_focus/')) {
    const top = scan(f.text)
    if (!top) {
      rep.notes.push(`${f.path}: no se pudo leer.`)
      continue
    }
    for (const tree of top) {
      if (tree.key === 'shared_focus') {
        rep.notes.push(`${f.path}: shared_focus no se importa (solo árboles focus_tree).`)
        continue
      }
      if (tree.key !== 'focus_tree' || !tree.block) continue
      const treeId = val(tree.block, 'id') ?? ''
      if (!treeId || out.focusTrees.some((t) => t.id === treeId)) {
        rep.notes.push(`Árbol ${treeId || '(sin id)'}: ya existe o no tiene id (se saltó).`)
        continue
      }
      out = { ...out, focusTrees: [...out.focusTrees, { id: treeId, name: loc[treeId] ?? treeId }] }
      rep.focusTrees++
      const stmts = findAll(tree.block, 'focus').filter((x) => x.block)
      const made: { stmt: Stmt; focus: Focus; rel?: string }[] = []
      const uidOf = new Map<string, string>()
      for (const s of stmts) {
        const b = s.block!
        const id = val(b, 'id') ?? ''
        if (!id || out.focuses.some((x) => x.id === id) || uidOf.has(id)) {
          rep.notes.push(`Foco ${id || '(sin id)'}: ya existe o no tiene id (se saltó).`)
          continue
        }
        const icon = val(b, 'icon')
        const extra = restCode(f.text, b, [
          'id',
          'icon',
          'x',
          'y',
          'cost',
          'prerequisite',
          'mutually_exclusive',
          'available',
          'bypass',
          'completion_reward',
          'relative_position_id'
        ])
        const focus: Focus = {
          uid: newUid(),
          treeId,
          id,
          name: loc[id] ?? id,
          description: loc[`${id}_desc`] ?? '',
          cost: num(val(b, 'cost'), 10),
          icon: { kind: 'game', gfx: icon ?? 'GFX_goal_unknown' },
          iconAuto: false,
          x: num(val(b, 'x')),
          y: num(val(b, 'y')),
          prerequisites: [],
          mutuallyExclusive: [],
          blocks: null,
          scripts: {
            available: codeOf(find(b, 'available')),
            bypass: codeOf(find(b, 'bypass')),
            reward: codeOf(find(b, 'completion_reward'))
          },
          extraText: extra || undefined
        }
        if (extra) rep.notes.push(`Foco ${id}: algunas sentencias quedaron como texto avanzado.`)
        made.push({ stmt: s, focus, rel: val(b, 'relative_position_id') })
        uidOf.set(id, focus.uid)
      }
      // Enlaces (prerrequisitos y exclusiones por id)
      for (const m of made) {
        for (const pre of findAll(m.stmt.block, 'prerequisite')) {
          const ids = findAll(pre.block, 'focus').map((x) => x.value ?? '')
          if (ids.length > 1)
            rep.notes.push(
              `Foco ${m.focus.id}: un prerrequisito "O" se importó como varios prerrequisitos (Y).`
            )
          for (const id of ids)
            if (uidOf.has(id)) m.focus.prerequisites.push(uidOf.get(id)!)
            else rep.notes.push(`Foco ${m.focus.id}: prerrequisito ${id} no está en el árbol.`)
        }
        for (const ex of findAll(m.stmt.block, 'mutually_exclusive'))
          for (const id of findAll(ex.block, 'focus').map((x) => x.value ?? ''))
            if (uidOf.has(id)) m.focus.mutuallyExclusive.push(uidOf.get(id)!)
      }
      // Posiciones relativas → absolutas (varias pasadas por las cadenas)
      const abs = new Map(made.filter((m) => !m.rel).map((m) => [m.focus.id, m.focus]))
      let pending = made.filter((m) => m.rel)
      for (let guard = 0; pending.length && guard < 50; guard++) {
        const rest: typeof pending = []
        for (const m of pending) {
          const base = abs.get(m.rel!)
          if (base) {
            m.focus.x += base.x
            m.focus.y += base.y
            abs.set(m.focus.id, m.focus)
          } else rest.push(m)
        }
        if (rest.length === pending.length) break
        pending = rest
      }
      for (const m of pending)
        rep.notes.push(`Foco ${m.focus.id}: su posición relativa a ${m.rel} no se pudo resolver.`)
      out = { ...out, focuses: [...out.focuses, ...made.map((m) => m.focus)] }
      rep.focuses += made.length
    }
  }
  return out
}

/** Importa los archivos de un mod al proyecto (devuelve un proyecto nuevo y el informe) */
export function importMod(
  p: Project,
  files: ImportFile[]
): { project: Project; report: ImportReport } {
  const rep: ImportReport = {
    focusTrees: 0,
    focuses: 0,
    events: 0,
    decisions: 0,
    categories: 0,
    ideas: 0,
    notes: []
  }
  const loc = importLoc(files)
  let out = importFocuses(p, files, loc, rep)
  out = importEvents(out, files, loc, rep)
  out = importDecisions(out, files, loc, rep)
  out = importIdeas(out, files, loc, rep)
  return { project: out, report: rep }
}
