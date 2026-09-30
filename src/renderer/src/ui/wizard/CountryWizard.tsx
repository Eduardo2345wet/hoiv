// (Provisional, se reemplaza en la Parte 2) Crear país con valores por defecto
import { useEffect } from 'react'
import type { Project } from '../../types'
import { store } from '../../store/appStore'
import { addCountry, newCountry } from '../../countries/countryOps'
import { suggestTag } from '../../countries/tags'
import { getCatalogOptions } from '../../catalog/catalog'

interface Props {
  project: Project
  countryUid?: string
  initialStep?: number
  onClose: () => void
}

export default function CountryWizard({ project, countryUid, onClose }: Props): null {
  useEffect(() => {
    if (!countryUid) {
      const taken = getCatalogOptions('country', project, store.get().game).map((o) => o.id)
      store.updateProject((p) =>
        addCountry(
          p,
          newCountry({ mode: 'nuevo', tag: suggestTag('Nuevo país', taken), name: 'Nuevo país' })
        )
      )
    }
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
