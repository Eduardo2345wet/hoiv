// Carpeta de datos de HOI4 en Documentos (con OneDrive). SOLO para mostrar rutas e instrucciones:
// la app nunca escribe ahí.
import fs from 'fs'
import path from 'path'

/** Posibles carpetas "Documents/Paradox Interactive/Hearts of Iron IV" (con OneDrive) */
export function hoi4DocumentsCandidates(
  documents: string,
  env: Record<string, string | undefined>,
  join: (...p: string[]) => string = path.join
): string[] {
  const tail = ['Paradox Interactive', 'Hearts of Iron IV']
  const roots = [documents]
  for (const od of [env.OneDrive, env.OneDriveConsumer, env.OneDriveCommercial])
    if (od) roots.push(join(od, 'Documents'), join(od, 'Documentos'))
  if (env.USERPROFILE)
    roots.push(
      join(env.USERPROFILE, 'OneDrive', 'Documents'),
      join(env.USERPROFILE, 'OneDrive', 'Documentos')
    )
  return [...new Set(roots)].map((r) => join(r, ...tail))
}

/** La primera candidata que existe (donde HOI4 guarda sus datos); null si ninguna */
export function findHoi4Documents(
  candidates: string[],
  exists: (p: string) => boolean = fs.existsSync
): string | null {
  return candidates.find((c) => exists(c)) ?? null
}
