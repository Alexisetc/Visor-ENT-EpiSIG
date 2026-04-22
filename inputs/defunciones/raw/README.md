# inputs/defunciones/raw/

Archivos INEC de Estadísticas de Defunciones Generales (EDG), uno por año:

- `EDG_2013.sav` … `EDG_2023.sav` — SPSS, lectura via
  `pyreadstat.read_sav(..., encoding='LATIN1')`.
- `EDG_2024.csv` — CSV `;` latin1 (datos abiertos INEC 2024).

**Estos archivos NO están en git** (~200 MB total). Se descargan de
<https://www.ecuadorencifras.gob.ec/defunciones-generales/>. Hashes SHA256
persisten en `intermediate/defunciones_info.json`.

## Esquema

- **2013-2016**: ~52 columnas; incluye `cant_res` y `parr_res` (granularidad parroquial).
- **2017-2023**: ~45 columnas; **PIERDE `cant_res` y `parr_res`** — solo `prov_res` queda.
  Para análisis parroquial post-2016 debe usarse `prov_fall/cant_fall/parr_fall`
  (lugar de fallecimiento, no residencia).
- **2024 (CSV)**: similar a 2023.

Las columnas **comunes a todos los años** que el pipeline conserva están en
`scripts/ent_pipeline/config.py:COMMON_DEF_COLS`.
