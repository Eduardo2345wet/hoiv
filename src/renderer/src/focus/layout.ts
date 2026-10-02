// Cuadrícula del árbol de focos: reglas de colocación, ramas, intercambio al soltar y orden
// automático por capas (estilo Sugiyama, propio). Todo son funciones puras sobre el proyecto.
import type { Focus, Project } from '../types'

export interface Cell {
  x: number
  y: number
}

const inTree = (p: Project, treeId: string): Focus[] => p.focuses.filter((f) => f.treeId === treeId)

/** Primera fila válida de un foco: una más que la fila más baja de sus prerrequisitos */
export function minRow(f: Focus, byUid: Map<string, Focus>, ignore?: Set<string>): number {
  let m = 0
  for (const u of f.prerequisites) {
    if (ignore?.has(u)) continue
    const pre = byUid.get(u)
    if (pre && pre.treeId === f.treeId) m = Math.max(m, pre.y + 1)
  }
  return m
}

/** Focos de un árbol en orden topológico (prerrequisitos primero); tolera ciclos */
function topo(list: Focus[]): Focus[] {
  const byUid = new Map(list.map((f) => [f.uid, f]))
  const done = new Set<string>()
  const out: Focus[] = []
  const visit = (f: Focus, stack: Set<string>): void => {
    if (done.has(f.uid) || stack.has(f.uid)) return
    stack.add(f.uid)
    for (const u of f.prerequisites) {
      const pre = byUid.get(u)
      if (pre) visit(pre, stack)
    }
    stack.delete(f.uid)
    done.add(f.uid)
    out.push(f)
  }
  for (const f of [...list].sort((a, b) => a.y - b.y || a.x - b.x)) visit(f, new Set())
  return out
}

/** La rama de un foco: él y los focos que dependen SOLO de él (directa o indirectamente) */
export function branchOf(p: Project, uid: string): string[] {
  const f = p.focuses.find((x) => x.uid === uid)
  if (!f) return []
  const tree = inTree(p, f.treeId)
  const set = new Set([uid])
  let grew = true
  while (grew) {
    grew = false
    for (const g of tree)
      if (!set.has(g.uid) && g.prerequisites.length && g.prerequisites.every((u) => set.has(u))) {
        set.add(g.uid)
        grew = true
      }
  }
  return [...set]
}

/**
 * Deja el árbol cumpliendo las reglas: ningún foco en la fila de sus prerrequisitos ni arriba, y
 * nunca dos focos en la misma casilla (el que estorba baja a la siguiente casilla libre).
 */
export function repairTree(p: Project, treeId: string): Project {
  const list = topo(inTree(p, treeId))
  const byUid = new Map(list.map((f) => [f.uid, { ...f }]))
  const taken = new Set<string>()
  for (const f of list) {
    const cur = byUid.get(f.uid)!
    cur.y = Math.max(cur.y, minRow(cur, byUid))
    cur.x = Math.max(0, cur.x)
    while (taken.has(`${cur.x},${cur.y}`)) cur.y++
    taken.add(`${cur.x},${cur.y}`)
  }
  let changed = false
  const focuses = p.focuses.map((f) => {
    const n = byUid.get(f.uid)
    if (!n || (n.x === f.x && n.y === f.y)) return f
    changed = true
    return { ...f, x: n.x, y: n.y }
  })
  return changed ? { ...p, focuses } : p
}

export interface DropInfo {
  /** Casilla donde quedará el foco arrastrado */
  cell: Cell
  /** false = la casilla pedida estaba en una fila no válida (se baja a la primera válida) */
  valid: boolean
  /** Focos que se mueven con él */
  moved: string[]
  /** Foco con el que intercambia lugar (casilla ocupada), si lo hay */
  swapWith: string | null
}

/** Qué pasaría al soltar `uid` en la casilla (gx, gy) */
export function dropInfo(
  p: Project,
  uid: string,
  gx: number,
  gy: number,
  opts: { branch?: boolean; also?: string[] } = {}
): DropInfo {
  const f = p.focuses.find((x) => x.uid === uid)!
  const tree = inTree(p, f.treeId)
  const byUid = new Map(tree.map((x) => [x.uid, x]))
  const moved = new Set<string>(
    opts.also?.length ? [uid, ...opts.also] : opts.branch === false ? [uid] : branchOf(p, uid)
  )
  let x = Math.max(0, Math.round(gx))
  let y = Math.max(0, Math.round(gy))
  const floor = minRow(f, byUid, moved)
  const valid = y >= floor
  if (!valid) y = floor
  // Ningún foco movido puede quedar con coordenadas negativas
  const dx = Math.max(x - f.x, -Math.min(...[...moved].map((u) => byUid.get(u)!.x)))
  const dy = Math.max(y - f.y, -Math.min(...[...moved].map((u) => byUid.get(u)!.y)))
  x = f.x + dx
  y = f.y + dy
  const other =
    moved.size === 1
      ? tree.find((o) => o.uid !== uid && !moved.has(o.uid) && o.x === x && o.y === y)
      : undefined
  return { cell: { x, y }, valid, moved: [...moved], swapWith: other?.uid ?? null }
}

/** Suelta un foco (y su rama) en una casilla: intercambia si está ocupada y repara el árbol */
export function dropFocus(
  p: Project,
  uid: string,
  gx: number,
  gy: number,
  opts: { branch?: boolean; also?: string[] } = {}
): Project {
  const f = p.focuses.find((x) => x.uid === uid)
  if (!f) return p
  const info = dropInfo(p, uid, gx, gy, opts)
  const dx = info.cell.x - f.x
  const dy = info.cell.y - f.y
  const moved = new Set(info.moved)
  const swap = info.swapWith ? p.focuses.find((o) => o.uid === info.swapWith) : undefined
  const next: Project = {
    ...p,
    focuses: p.focuses.map((o) => {
      if (moved.has(o.uid)) return { ...o, x: o.x + dx, y: o.y + dy }
      if (swap && o.uid === swap.uid) return { ...o, x: f.x, y: f.y }
      return o
    })
  }
  return repairTree(next, f.treeId)
}

// ===================== Ordenar automáticamente =====================

/** Pares excluyentes (a < b) dentro de un conjunto de uids */
function exclusivePairs(list: Focus[]): [string, string][] {
  const ids = new Set(list.map((f) => f.uid))
  const out: [string, string][] = []
  for (const f of list)
    for (const o of f.mutuallyExclusive) if (ids.has(o) && f.uid < o) out.push([f.uid, o])
  return out
}

/**
 * Ordena el árbol por capas:
 * - fila = la más baja de sus prerrequisitos + 1 (raíces en la 0); los excluyentes, en la misma fila
 * - orden en la fila por baricentro (menos cruces); hijos centrados bajo sus padres
 * - ramas independientes lado a lado, con 2 columnas entre ellas; 1 columna entre focos no
 *   relacionados dentro de una misma fila
 * - los focos fijados (pinned) y los que no tienen ninguna conexión no se mueven
 * - al final todo se redondea a enteros y el mínimo de x e y es 0 (salvo que haya fijados)
 */
export function autoLayout(p: Project, treeId: string): Project {
  const list = inTree(p, treeId)
  if (!list.length) return p
  const byUid = new Map(list.map((f) => [f.uid, f]))
  const childrenOf = new Map<string, string[]>(list.map((f) => [f.uid, []]))
  for (const f of list)
    for (const u of f.prerequisites) if (byUid.has(u)) childrenOf.get(u)!.push(f.uid)
  const pairs = exclusivePairs(list)
  const connected = new Set<string>()
  for (const f of list) {
    for (const u of f.prerequisites) if (byUid.has(u)) (connected.add(f.uid), connected.add(u))
  }
  for (const [a, b] of pairs) (connected.add(a), connected.add(b))
  const fixed = list.filter((f) => f.pinned || !connected.has(f.uid))
  const fixedIds = new Set(fixed.map((f) => f.uid))
  const nodes = list.filter((f) => !fixedIds.has(f.uid))
  if (!nodes.length) return repairTree(p, treeId)
  const nodeIds = new Set(nodes.map((f) => f.uid))
  const parentsOf = (u: string): string[] =>
    byUid.get(u)!.prerequisites.filter((x) => byUid.has(x) && (nodeIds.has(x) || fixedIds.has(x)))

  // ---- 1. Filas ----
  const order = topo(nodes)
  const row = new Map<string, number>()
  const relax = (): boolean => {
    let changed = false
    for (const f of order) {
      let r = row.get(f.uid) ?? 0
      for (const u of parentsOf(f.uid)) {
        const pr = nodeIds.has(u) ? (row.get(u) ?? 0) : byUid.get(u)!.y
        r = Math.max(r, pr + 1)
      }
      if (r !== (row.get(f.uid) ?? -1)) (row.set(f.uid, r), (changed = true))
    }
    return changed
  }
  for (const f of order) row.set(f.uid, 0)
  for (let i = 0; i < 50; i++) {
    let changed = relax()
    for (const [a, b] of pairs) {
      if (!nodeIds.has(a) || !nodeIds.has(b)) continue
      const r = Math.max(row.get(a)!, row.get(b)!)
      if (row.get(a) !== r || row.get(b) !== r) (row.set(a, r), row.set(b, r), (changed = true))
    }
    if (!changed) break
  }

  // ---- 2. Componentes (por conexiones entre nodos móviles) ----
  const comp = new Map<string, number>()
  const adj = new Map<string, string[]>(nodes.map((f) => [f.uid, []]))
  for (const f of nodes) {
    for (const u of f.prerequisites)
      if (nodeIds.has(u)) (adj.get(f.uid)!.push(u), adj.get(u)!.push(f.uid))
  }
  for (const [a, b] of pairs)
    if (nodeIds.has(a) && nodeIds.has(b)) (adj.get(a)!.push(b), adj.get(b)!.push(a))
  const comps: string[][] = []
  for (const f of [...nodes].sort((a, b) => a.x - b.x || a.y - b.y)) {
    if (comp.has(f.uid)) continue
    const stack = [f.uid]
    const members: string[] = []
    comp.set(f.uid, comps.length)
    while (stack.length) {
      const u = stack.pop()!
      members.push(u)
      for (const v of adj.get(u)!) if (!comp.has(v)) (comp.set(v, comps.length), stack.push(v))
    }
    comps.push(members)
  }

  // Casillas ocupadas por focos que no se mueven
  const blocked = new Set(fixed.map((f) => `${f.x},${f.y}`))
  const pos = new Map<string, Cell>()
  let startX = 0

  for (const members of comps) {
    const mset = new Set(members)
    const rows = new Map<number, string[]>()
    for (const u of members) {
      const r = row.get(u)!
      rows.set(r, [...(rows.get(r) ?? []), u])
    }
    const rowKeys = [...rows.keys()].sort((a, b) => a - b)
    const idx = new Map<string, number>()
    const orig = (u: string): number => byUid.get(u)!.x
    for (const r of rowKeys) {
      rows.get(r)!.sort((a, b) => orig(a) - orig(b) || byUid.get(a)!.y - byUid.get(b)!.y)
      rows.get(r)!.forEach((u, i) => idx.set(u, i))
    }
    const bary = (u: string, others: string[]): number | null => {
      const v = others.filter((o) => mset.has(o) && row.get(o) !== row.get(u))
      return v.length ? v.reduce((s, o) => s + (idx.get(o) ?? 0), 0) / v.length : null
    }
    const sortRow = (r: number, keyOf: (u: string) => number | null): void => {
      const cur = rows.get(r)!
      const keys = new Map(cur.map((u, i) => [u, keyOf(u) ?? i]))
      cur.sort((a, b) => keys.get(a)! - keys.get(b)! || idx.get(a)! - idx.get(b)!)
      cur.forEach((u, i) => idx.set(u, i))
    }
    for (let it = 0; it < 4; it++) {
      for (const r of rowKeys) sortRow(r, (u) => bary(u, parentsOf(u)))
      for (const r of [...rowKeys].reverse()) sortRow(r, (u) => bary(u, childrenOf.get(u) ?? []))
    }
    // Los excluyentes juntos: el segundo se pega al primero
    for (const r of rowKeys) {
      const cur = rows.get(r)!
      for (const [a, b] of pairs) {
        const ia = cur.indexOf(a)
        const ib = cur.indexOf(b)
        if (ia < 0 || ib < 0 || Math.abs(ia - ib) === 1) continue
        cur.splice(ib, 1)
        cur.splice(cur.indexOf(a) + 1, 0, b)
      }
      cur.forEach((u, i) => idx.set(u, i))
    }
    // ---- 3. Coordenadas ----
    const x = new Map<string, number>()
    const excl = new Set(pairs.map(([a, b]) => `${a}|${b}`))
    const gap = (a: string, b: string): number => {
      const pa = new Set(byUid.get(a)!.prerequisites)
      const sib = byUid.get(b)!.prerequisites.some((u) => pa.has(u))
      return sib || excl.has(`${a}|${b}`) || excl.has(`${b}|${a}`) ? 1 : 2
    }
    const place = (r: number, want: (u: string) => number | null): void => {
      const cur = rows.get(r)!
      let prev: string | null = null
      for (const u of cur) {
        const w = want(u)
        let xv = w === null ? (prev ? x.get(prev)! + gap(prev, u) : 0) : Math.round(w)
        if (prev) xv = Math.max(xv, x.get(prev)! + gap(prev, u))
        x.set(u, xv)
        prev = u
      }
    }
    const avg = (us: string[]): number | null => {
      const v = us.filter((o) => x.has(o))
      return v.length ? v.reduce((s, o) => s + x.get(o)!, 0) / v.length : null
    }
    const downPass = (): void => {
      for (const r of rowKeys) place(r, (u) => avg(parentsOf(u).filter((o) => mset.has(o))))
    }
    const upPass = (): void => {
      for (const r of [...rowKeys].reverse()) {
        const cur = rows.get(r)!
        place(r, (u) => {
          const ch = (childrenOf.get(u) ?? []).filter((o) => mset.has(o))
          return ch.length ? avg(ch) : (x.get(u) ?? null)
        })
        void cur
      }
    }
    downPass()
    upPass()
    downPass()
    upPass()
    // Los hijos únicos quedan justo debajo de su padre cuando cabe
    // Normaliza el componente a x ≥ 0 y lo coloca a la derecha del anterior (2 columnas de por medio)
    const minX = Math.min(...members.map((u) => x.get(u)!))
    const maxX = Math.max(...members.map((u) => x.get(u)!))
    for (const u of members) pos.set(u, { x: x.get(u)! - minX + startX, y: row.get(u)! })
    startX += maxX - minX + 3
  }

  // Los focos fijos o sueltos ocupan su casilla: lo que choque se corre a la derecha
  const used = new Set(blocked)
  const sorted = [...nodes].sort(
    (a, b) => pos.get(a.uid)!.y - pos.get(b.uid)!.y || pos.get(a.uid)!.x - pos.get(b.uid)!.x
  )
  for (const f of sorted) {
    const c = pos.get(f.uid)!
    while (used.has(`${c.x},${c.y}`)) c.x++
    used.add(`${c.x},${c.y}`)
  }
  // Mínimo 0 en x e y (si hay fijados no se desplaza nada)
  let dx = 0
  let dy = 0
  if (!fixed.some((f) => f.pinned)) {
    const all: Cell[] = [...pos.values(), ...fixed.map((f) => ({ x: f.x, y: f.y }))]
    dx = -Math.min(...all.map((c) => c.x))
    dy = -Math.min(...all.map((c) => c.y))
  }
  let changed = false
  const focuses = p.focuses.map((f) => {
    if (f.treeId !== treeId) return f
    const c = pos.get(f.uid)
    const nx = (c ? c.x : f.x) + dx
    const ny = (c ? c.y : f.y) + dy
    if (nx === f.x && ny === f.y) return f
    changed = true
    return { ...f, x: nx, y: ny }
  })
  return repairTree(changed ? { ...p, focuses } : p, treeId)
}
