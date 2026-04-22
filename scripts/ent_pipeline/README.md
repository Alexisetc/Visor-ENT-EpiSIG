# Pipeline ENT — del dato crudo INEC al Visor EpiSIG

Paquete Python que procesa los microdatos de egresos hospitalarios y
defunciones generales del INEC (2013-2024), calcula tasas parroquiales y
tendencias MK + Sen + FDR, y regenera los JSON que consume el visor React.

## Cómo correrlo

```bash
# 1. Instalar dependencias (una sola vez)
pip install -r scripts/ent_pipeline/requirements.txt

# 2. Fase 1 — perfilado de calidad (HTML como insumo)
python -m scripts.ent_pipeline.01_profile          # ambos (egresos + defunciones)
python -m scripts.ent_pipeline.01_profile --tipo egresos
python -m scripts.ent_pipeline.01_profile --no-cache  # fuerza rebuild del parquet

# 3. Abrir los HTML en navegador
# intermediate/profile_egresos.html
# intermediate/profile_defunciones.html
```

La primera corrida tarda ~5–15 min (lee 12 años de `.sav`, construye cache
`intermediate/egresos_all.parquet` de ~200 MB). Corridas siguientes son
instantáneas: reusan el parquet.

## Estructura del paquete

```
scripts/ent_pipeline/
├── __init__.py                 metadata + docstring de fases
├── config.py                   rutas, columnas comunes, reglas CIE-10 Morales
├── io_inec.py                  loaders unificados .sav/.csv + cache parquet
├── 01_profile.py               Fase 1: perfilado → HTML
├── templates/
│   └── profile_report.html.j2  template Jinja2 del reporte HTML
├── cache/                      (reservado)
├── requirements.txt
└── README.md
```

## Inputs esperados

```
inputs/
├── egresos/raw/
│   ├── egresos_hospitalarios_2013.sav   (y 2014…2023)
│   └── egresos_hospitalarios_2024.csv
├── defunciones/raw/
│   ├── EDG_2013.sav                     (y 2014…2023)
│   └── EDG_2024.csv
├── egresos/diccionarios/                .ods INEC (referencia)
├── defunciones/diccionarios/            .ods INEC (referencia)
└── poblacion/
    └── 2022_CPV_NACIONAL_DENSIDAD_POBLACIONAL.xlsx
```

## Outputs (Fase 1)

```
intermediate/
├── profile_egresos.html           ← el reporte para revisar (Bloques A-G)
├── profile_defunciones.html
├── profile_egresos_data.json      ← datos sin imágenes, para diff
├── profile_defunciones_data.json
├── egresos_all.parquet            ← cache 12 años concatenados (~200 MB)
├── defunciones_all.parquet        ← cache (~30 MB)
├── egresos_info.json              ← hashes + rows/year + schema changes
└── defunciones_info.json
```

## Contenido del HTML de perfilado

El reporte tiene siete bloques (A-G) diseñados como **insumo humano**
para decidir las reglas de limpieza de la Fase 2:

| Bloque | Pregunta que responde                                                   |
|--------|-------------------------------------------------------------------------|
| **A**  | ¿Cuántos registros hay por año? ¿Cuadran con INEC? ¿Cambió el schema?   |
| **B**  | ¿Qué columnas críticas tienen missing? ¿Qué valores dominan?           |
| **C**  | ¿Cuántas parroquias únicas? ¿Cruzan con el GeoJSON? Exclusiones Morales |
| **D**  | ¿Qué códigos CIE-10 dominan? ¿Qué % cae en los 5 grupos ENT?            |
| **E**  | Distribuciones por sexo, grupo etario, etnia                            |
| **F**  | ¿Hay meses-cero? ¿Cuánto cayó el volumen por la pandemia?               |
| **G**  | Ratio Defunciones/Egresos por grupo ENT (letalidad indirecta)           |

## Fases siguientes (pendientes)

- **Fase 2** `02_clean.py` — aplica reglas (decididas tras leer el HTML),
  clasifica CIE-10, produce `intermediate/{egresos,defunciones}_clean.parquet`.
- **Fase 3** `03_rates.py` — agrega por parroquia × grupo × año, cruza con
  población CPV 2022, produce `ent_parroquial.json`.
- **Fase 4** `04_trends.py` — Mann-Kendall + Theil-Sen + FDR Benjamini-Hochberg,
  produce `tendencias_parroquial.json`.
- **Fase 5** `05_export_visor.py` — merge final al JSON que consume el visor
  React (+ backup del actual a `_legacy/`).

## Reglas CIE-10 Morales (grupos ENT)

Replicadas exactamente desde `ENT_ART/codigo/codigo_limpio/metodos.R`
(`contar_causas_eg`, `contar_causas_def`), operando sobre prefijo 3-char:

| Grupo       | Regla                                              |
|-------------|----------------------------------------------------|
| neoplasia   | C00-C97 + D00-D48, excluyendo D64.9                |
| cardio      | I00-I99                                            |
| resp        | J30-J98, excluyendo J69 y J96                      |
| diabren     | E10-E14 + N00-N18                                  |
| digest      | K00-K92                                            |

## Reglas Morales fuera de esta fase (se aplican en Fase 2/4)

- Excluir `prov_res ∈ {20, 88, 90}` (Galápagos, Zonas No Delimitadas, No Esp.)
  — la Fase 1 solo **reporta** estos conteos.
- Filtrar por `anio_egr == año` (evita arrastre entre años del consolidado).
- Corrección Benjamini-Hochberg de p-valores (añadida, no estaba en Morales).
- Pendiente de Sen (Theil-Sen) como estimador robusto.
- Pre-test Ljung-Box de autocorrelación.
