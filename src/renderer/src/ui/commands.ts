// Registro de comandos: la cinta llama por nombre a acciones que viven en otros componentes
// (el mapa, el editor de focos…). Cada componente registra las suyas mientras está montado.
type Cmd = () => void
const cmds = new Map<string, Cmd>()

export function registerCommands(map: Record<string, Cmd>): () => void {
  for (const [k, f] of Object.entries(map)) cmds.set(k, f)
  return () => {
    for (const [k, f] of Object.entries(map)) if (cmds.get(k) === f) cmds.delete(k)
  }
}

export function runCommand(id: string): void {
  cmds.get(id)?.()
}

export const hasCommand = (id: string): boolean => cmds.has(id)
