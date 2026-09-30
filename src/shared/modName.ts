// Utilidades para el nombre del mod.

/**
 * Convierte el nombre del mod en un nombre de carpeta/archivo seguro:
 * sin tildes, sin espacios y en minúsculas. "Mi Mod España" -> "mi_mod_espana".
 */
export function modFolderName(modName: string): string {
  const base = modName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  return base || 'mi_mod'
}
