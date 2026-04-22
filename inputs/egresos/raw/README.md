# inputs/egresos/raw/

Archivos INEC de Egresos Hospitalarios (EGH), uno por año:

- `egresos_hospitalarios_2013.sav` … `egresos_hospitalarios_2023.sav` — SPSS, lectura
  via `pyreadstat.read_sav(..., encoding='LATIN1')`.
- `egresos_hospitalarios_2024.csv` — CSV `;` latin1 (formato publicado en
  datos abiertos INEC 2024).

**Estos archivos NO están en git** (2.3 GB en total). Se reconstruyen descargando
de <https://www.ecuadorencifras.gob.ec/camas-y-egresos-hospitalarios/>. El pipeline
registra los hashes SHA256 en `intermediate/egresos_info.json` para reproducibilidad.

## Esquema

- **2013-2016**: ~30 columnas, sin `etnia` ni `area_res`.
- **2017-2023**: 36 columnas, con `etnia`, `area_res`.
- **2024 (CSV)**: 38 columnas, agrega `tipo_seg` y `dis_pac`.

Las columnas **comunes a todos los años** que el pipeline conserva están definidas
en `scripts/ent_pipeline/config.py:COMMON_EGR_COLS`.
