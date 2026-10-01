import React, { useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import type { Country, Project } from '../../types'
import FlagThumb from '../FlagThumb'

interface ActiveCountryCardProps {
  project: Project
  activeCountry: Country | null
  onSelectCountry: (tag: string | null) => void
  onEditCountry: (countryUid: string) => void
  onCreateCountry: () => void
  onCenterState?: (stateId: number) => void
}

export default function ActiveCountryCard({
  project,
  activeCountry,
  onSelectCountry,
  onEditCountry,
  onCreateCountry,
  onCenterState
}: ActiveCountryCardProps): JSX.Element {
  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredCountries = project.countries.filter(
    (c) =>
      c.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.names.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="absolute left-4 top-4 z-10 w-72 rounded-lg border border-hoi-border bg-hoi-panel/95 p-3 shadow-xl backdrop-blur-sm text-hoi-text">
      {activeCountry ? (
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-[52px] w-[82px] shrink-0 overflow-hidden rounded border border-hoi-border bg-black">
                <FlagThumb country={activeCountry} size="main" />
              </div>
              <div>
                <div className="font-bold text-hoi-accent">{activeCountry.names.name}</div>
                <div className="flex items-center gap-2 text-xs text-hoi-muted">
                  <span className="font-mono bg-hoi-bg px-1 rounded">{activeCountry.tag}</span>
                  <span className="capitalize">{activeCountry.politics.ruling}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => onSelectCountry(null)}
              className="rounded p-1 text-hoi-muted hover:bg-hoi-bg hover:text-hoi-text"
              title="Deseleccionar país"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-hoi-border/50 pt-2 text-xs">
            <div>
              <span className="text-hoi-muted">Capital: </span>
              {activeCountry.capital ? (
                <button
                  onClick={() => activeCountry.capital && onCenterState?.(activeCountry.capital)}
                  className="font-medium text-hoi-accent hover:underline"
                >
                  Estado #{activeCountry.capital}
                </button>
              ) : (
                <span className="text-amber-400">Sin capital</span>
              )}
            </div>
            <button
              onClick={() => onEditCountry(activeCountry.uid)}
              className="btn text-xs py-0.5 px-2"
            >
              Editar país
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-hoi-muted">NINGÚN PAÍS SELECCIONADO</div>
          <div className="text-xs text-hoi-muted/80">
            Elige o crea un país activo para pintar estados, fijar capitales o agregar cores.
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowSearch(true)}
              className="btn flex-1 justify-center text-xs"
            >
              <Search size={14} /> Elegir país
            </button>
            <button
              onClick={onCreateCountry}
              className="btn-primary flex-1 justify-center text-xs"
            >
              <Plus size={14} /> Crear país
            </button>
          </div>
        </div>
      )}

      {/* Modal / Popup de búsqueda de país */}
      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-80 rounded-lg border border-hoi-border bg-hoi-panel p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2">
              <h3 className="font-bold text-hoi-accent">Elegir País Activo</h3>
              <button
                onClick={() => setShowSearch(false)}
                className="text-hoi-muted hover:text-hoi-text"
              >
                <X size={18} />
              </button>
            </div>
            <input
              type="text"
              placeholder="Buscar por tag o nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-3 w-full rounded border border-hoi-border bg-hoi-bg px-3 py-1.5 text-sm"
              autoFocus
            />
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredCountries.map((c) => (
                <button
                  key={c.uid}
                  onClick={() => {
                    onSelectCountry(c.tag)
                    setShowSearch(false)
                  }}
                  className="flex w-full items-center gap-3 rounded p-2 text-left hover:bg-hoi-bg"
                >
                  <div className="h-6 w-9 shrink-0 overflow-hidden rounded border border-hoi-border bg-black">
                    <FlagThumb country={c} size="small" />
                  </div>
                  <div className="flex-1 truncate">
                    <div className="text-sm font-semibold">{c.names.name}</div>
                    <div className="text-xs font-mono text-hoi-muted">{c.tag}</div>
                  </div>
                </button>
              ))}
              {filteredCountries.length === 0 && (
                <div className="py-4 text-center text-xs text-hoi-muted">No se encontraron países.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
