// Sprites "_shine" de los focos: HOI4 necesita, para cada ícono de foco, un segundo sprite
// con el mismo nombre + "_shine" (el brillo de los focos disponibles). Si falta, el árbol
// muestra el ícono por defecto ("?" con laureles).

/**
 * Plantilla copiada de interface/goals_shine.gfx del juego base.
 * shine_overlay.dds es del juego base: NO se copia al mod, solo se referencia.
 */
export const SHINE_TEMPLATE = `\tspriteType = {
\t\tname = "{NAME}_shine"
\t\ttexturefile = "{FILE}"
\t\teffectFile = "gfx/FX/buttonstate.lua"
\t\tanimation = {
\t\t\tanimationmaskfile = "{FILE}"
\t\t\tanimationtexturefile = "gfx/interface/goals/shine_overlay.dds"
\t\t\tanimationrotation = -90.0
\t\t\tanimationlooping = no
\t\t\tanimationtime = 0.75
\t\t\tanimationdelay = 0
\t\t\tanimationblendmode = "add"
\t\t\tanimationtype = "scrolling"
\t\t\tanimationrotationoffset = { x = 0.0 y = 0.0 }
\t\t\tanimationtexturescale = { x = 1.0 y = 1.0 }
\t\t}
\t\tanimation = {
\t\t\tanimationmaskfile = "{FILE}"
\t\t\tanimationtexturefile = "gfx/interface/goals/shine_overlay.dds"
\t\t\tanimationrotation = 90.0
\t\t\tanimationlooping = no
\t\t\tanimationtime = 0.75
\t\t\tanimationdelay = 0
\t\t\tanimationblendmode = "add"
\t\t\tanimationtype = "scrolling"
\t\t\tanimationrotationoffset = { x = 0.0 y = 0.0 }
\t\t\tanimationtexturescale = { x = 1.0 y = 1.0 }
\t\t}
\t\tlegacy_lazy_load = no
\t}`

export function shineSprite(name: string, file: string): string {
  return SHINE_TEMPLATE.replaceAll('{NAME}', name).replaceAll('{FILE}', file)
}

/**
 * "Forma" de una entrada spriteType: las claves en orden (sin valores que dependen del ícono).
 * Sirve para comparar nuestra plantilla con una entrada real de goals_shine.gfx.
 */
export function shineShape(entry: string): string {
  return (entry.replace(/#[^\n]*/g, '').match(/[A-Za-z_]+(?=\s*=)/g) ?? []).join(' ').toLowerCase()
}
