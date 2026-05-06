// Store global del visor (zustand). Centraliza filtros, parroquia seleccionada
// y los 8 datasets cargados por useDataLoader.

import { create } from 'zustand'

// Dada una parroquia seleccionada y un nuevo provFilter, devuelve true si la
// parroquia PERTENECE al nuevo filtro (o no hay filtro).
function parrInsideProv(selectedDpa, newProvFilter) {
  if (!newProvFilter) return true                  // sin filtro: todo cabe
  if (!selectedDpa)   return true                  // nada seleccionado: nada que limpiar
  const code = String(selectedDpa).padStart(6, '0')
  return code.slice(0, 2) === newProvFilter
}

export const useStore = create((set, get) => ({
  // ====== FILTROS ======
  module:        'carga',         // carga | determinantes | mcda
  ent:           'todas',         // todas | circulatorio | neoplasia | metabolica | respiratorio | nervioso
  year:          2024,            // 2013..2024 (default = año más reciente)
  layerType:     'coropleta',     // coropleta | heatmap
  mapMetric:     'morbilidad',    // morbilidad | mortalidad — qué tasa grafica el mapa
  provFilter:    null,            // '01'..'24' o null
  selectedDpa:   null,            // '170150' (Iñaquito) o null
  selectedProps: null,            // props del feature seleccionado
  playing:       false,
  modalOpen:     null,            // 'metodologia' | 'welcome' | null
  sidebarCollapsed: false,        // si true, el panel izquierdo de configuración se oculta

  setModule:        (m)        => set({ module: m }),
  setEnt:           (e)        => set({ ent: e }),
  setYear:          (y)        => set({ year: y }),
  setLayerType:     (t)        => set({ layerType: t }),
  setMapMetric:     (m)        => set({ mapMetric: m }),

  // Al cambiar de provincia, si la parroquia seleccionada NO pertenece a la
  // nueva provincia se limpia (antes la ficha mostraba datos de una parroquia
  // inconsistente con el filtro geográfico).
  setProvFilter:    (p)        => {
    const { selectedDpa } = get()
    if (!parrInsideProv(selectedDpa, p)) {
      set({ provFilter: p, selectedDpa: null, selectedProps: null })
    } else {
      set({ provFilter: p })
    }
  },
  setSelected:      (dpa, pr)  => set({ selectedDpa: dpa, selectedProps: pr }),
  clearSelected:    ()         => set({ selectedDpa: null, selectedProps: null }),
  togglePlay:       ()         => set(s => ({ playing: !s.playing })),
  setPlaying:       (p)        => set({ playing: p }),
  openModal:        (m)        => set({ modalOpen: m }),
  closeModal:       ()         => set({ modalOpen: null }),
  toggleSidebar:    ()         => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // ====== DATASETS (cargados por useDataLoader) ======
  entData:     null,
  pobData:     null,
  geoParr:     null,
  geoProv:     null,
  mcdaData:    null,
  mgwrData:    null,
  detData:     null,
  estudioData: null,  // estudio ENT 2017-2023 (mortalidad + prevalencia + sexo + área + tendencia)

  loading: true,
  error:   null,

  setDataset: (key, value) => set({ [key]: value }),
  setLoading: (v)          => set({ loading: v }),
  setError:   (e)          => set({ error: e }),
}))

// Selector útil: ¿están listos los datasets críticos para renderizar el mapa?
export const selectMapReady = (s) => Boolean(s.geoParr && s.entData && s.pobData)
