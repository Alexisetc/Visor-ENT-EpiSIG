// Store global del visor (zustand). Centraliza filtros, parroquia seleccionada
// y los 6 datasets cargados por useDataLoader.

import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // ====== FILTROS ======
  module:        'carga',         // carga | determinantes | mcda
  ent:           'todas',         // todas | circulatorio | neoplasia | metabolica | respiratorio | nervioso
  year:          2023,            // 2013..2023
  layerType:     'coropleta',     // coropleta | heatmap | priorizacion
  provFilter:    null,            // '01'..'24' o null
  selectedDpa:   null,            // '170150' (Iñaquito) o null
  selectedProps: null,            // props del feature seleccionado
  playing:       false,
  modalOpen:     null,            // 'metodologia' | 'export' | null

  setModule:        (m)        => set({ module: m }),
  setEnt:           (e)        => set({ ent: e }),
  setYear:          (y)        => set({ year: y }),
  setLayerType:     (t)        => set({ layerType: t }),
  setProvFilter:    (p)        => set({ provFilter: p }),
  setSelected:      (dpa, pr)  => set({ selectedDpa: dpa, selectedProps: pr }),
  clearSelected:    ()         => set({ selectedDpa: null, selectedProps: null }),
  togglePlay:       ()         => set(s => ({ playing: !s.playing })),
  setPlaying:       (p)        => set({ playing: p }),
  openModal:        (m)        => set({ modalOpen: m }),
  closeModal:       ()         => set({ modalOpen: null }),

  // ====== DATASETS (cargados por useDataLoader) ======
  entData:  null,
  pobData:  null,
  geoParr:  null,
  geoProv:  null,
  mcdaData: null,
  mgwrData: null,
  detData:  null,

  loading: true,
  error:   null,

  setDataset: (key, value) => set({ [key]: value }),
  setLoading: (v)          => set({ loading: v }),
  setError:   (e)          => set({ error: e }),
}))

// Selector útil: ¿están listos los datasets críticos para renderizar el mapa?
export const selectMapReady = (s) => Boolean(s.geoParr && s.entData && s.pobData)
