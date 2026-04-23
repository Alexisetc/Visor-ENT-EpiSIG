# Visor ENT EpiSIG — Nota Conceptual Técnica y Científica

*Metodología de análisis espacio-temporal de Enfermedades No Transmisibles a nivel parroquial, Ecuador 2013-2024*

| Campo | Valor |
|---|---|
| **Autor** | Alexis Núñez |
| **Afiliación** | EpiSIG · Instituto Nacional de Investigación en Salud Pública (INSPI), Ecuador |
| **Contacto** | alexislopez6732@gmail.com |
| **Fecha** | 2026-04-22 |
| **Versión** | 1.0 (Fase 6 — pipeline consolidado con población anual y hot-spot IDW) |
| **Commits de referencia** | `9d82cf9` (Fase 0-1), `8a447a5` (Fase 2), `cb92e83` (Fase 3), Fase 4-5 (2026-04-22) |

---

## Índice

1. [Marco general y objetivos](#1-marco-general-y-objetivos)
2. [Fuentes de datos](#2-fuentes-de-datos)
3. [Pipeline de limpieza y armonización (Fases 0-2)](#3-pipeline-de-limpieza-y-armonizacion-fases-0-2)
4. [Clasificación CIE-10 — esquema Morales + esquemas de auditoría](#4-clasificacion-cie-10--esquema-morales--esquemas-de-auditoria)
5. [Denominador poblacional — método log-share 2010→2022 × proyecciones cantonales](#5-denominador-poblacional--metodo-log-share-20102022--proyecciones-cantonales)
6. [Cálculo de tasas parroquiales (Fase 3)](#6-calculo-de-tasas-parroquiales-fase-3)
7. [Análisis de tendencias (Fase 4) — Mann-Kendall + Sen + FDR-BH](#7-analisis-de-tendencias-fase-4--mann-kendall--sen--fdr-bh)
8. [Simulación de determinantes (MGWR) y priorización MCDA](#8-simulacion-de-determinantes-mgwr-y-priorizacion-mcda)
9. [Visualización cartográfica — coropleta y hot-spot (KDE + Turbo + IDW)](#9-visualizacion-cartografica--coropleta-y-hot-spot-kde--turbo--idw)
10. [Tratamiento de parroquias sin dato / creadas por CONALI](#10-tratamiento-de-parroquias-sin-dato--creadas-por-conali)
11. [Limitaciones, sesgos y consideraciones éticas](#11-limitaciones-sesgos-y-consideraciones-eticas)
12. [Reproducibilidad y trazabilidad](#12-reproducibilidad-y-trazabilidad)
13. [Referencias](#13-referencias)

---

## 1. Marco general y objetivos

### 1.1. Qué es el Visor ENT EpiSIG

El **Visor ENT EpiSIG** es una plataforma de visualización geoespacial web (React 18 + Leaflet 1.9) desarrollada por el Grupo de Epidemiología Espacial (EpiSIG) del Instituto Nacional de Investigación en Salud Pública (INSPI, Ecuador) para el análisis espacio-temporal de las **Enfermedades No Transmisibles (ENT)** a escala parroquial. Su objetivo es operacionalizar el monitoreo epidemiológico integrando microdatos del Instituto Nacional de Estadística y Censos (INEC) con técnicas cuantitativas de tendencias no paramétricas, análisis espacial y priorización multicriterio.

El visor está diseñado como **producto de referencia institucional** para tres audiencias:

1. **Tomadores de decisión en salud pública** (Ministerio de Salud Pública, direcciones zonales, INSPI) — priorización de territorios y ENT para intervención.
2. **Investigadores** — insumo documental para proyectos de investigación EpiSIG (F-I+D+i-075 de Priorización MCDA con CZ9 Duque 2026-2028; Proyecto Econométrico Espacial Núñez-ESPE 2026-2027).
3. **Equipos académicos y docentes** — material reproducible con microdatos abiertos INEC.

### 1.2. Alcance temporal y geográfico

| Dimensión | Cobertura |
|---|---|
| **Ventana temporal** | 2013-2024 (12 años) |
| **Unidad geográfica primaria** | Parroquia (División Político-Administrativa de 6 dígitos, DPA6) |
| **Base cartográfica** | CONALI 2025 (1 050 features — parroquias rurales + cabeceras cantonales urbanas agregadas) |
| **Cobertura nacional** | Ecuador continental (24 provincias; se excluye Galápagos, Zonas No Delimitadas y No Especificada — ver §3.3) |

La ventana 2013-2024 fue seleccionada por tres razones: (a) 2013 es el primer año donde los microdatos INEC de egresos hospitalarios están disponibles en formato `.sav` digital reutilizable; (b) 2024 es el último año con datos publicados al corte 2026-04; (c) permite una serie de 12 puntos temporales — suficiente para el análisis de tendencia Mann-Kendall con potencia estadística aceptable incluso tras excluir la ventana de pandemia 2020-2021 (ver §7).

### 1.3. Los cinco grupos ENT — esquema Morales

Siguiendo el precedente metodológico del estudio de **Morales (2017-2023)** sobre ENT en Ecuador, el visor agrupa las causas CIE-10 en cinco categorías amplias consolidadas en un único mapping declarativo (`scripts/ent_pipeline/config.py`):

| Grupo | Rango CIE-10 | Etiqueta visor | Paleta (ENT_COLOR) |
|---|---|---|---|
| Sist. circulatorio | I00–I99 | Circulatorio | `#ea1d2c` (rojo) |
| Neoplasias | C00–D48 | Neoplasias | `#756bb1` (púrpura) |
| Metabólicas | E00–E99 | Metabólica | `#e88a2c` (naranja) |
| Aparato respiratorio | J00–J99 | Respiratorio | `#31a354` (verde) |
| Sist. nervioso | G00–G99 | Nervioso | `#6c7a89` (gris azulado) |

Adicionalmente, un selector secundario de **12 sub-ENT clínicas** permite desagregar dentro o a través de los grupos principales: `dm1`, `dm2`, `hta`, `iam`, `ecv`, `erc`, `obesidad`, `ca_mama`, `ca_est`, `ca_prost`, `depresion`, `epoc` (ver `SUBENT_PATRONES` en `config.py`).

### 1.4. Los tres módulos analíticos

El visor articula tres módulos que comparten el mismo canvas cartográfico pero ofrecen vistas conceptualmente distintas del mismo territorio:

| Módulo | Pregunta que responde | Fuente primaria |
|---|---|---|
| **Carga de enfermedad** | ¿Dónde y cuándo se concentran casos/muertes por ENT? | Egresos INEC (RDACAA) + Defunciones Generales INEC (EDG) |
| **Determinantes sociales** | ¿Qué factores contextuales explican la distribución espacial? | Simulación MGWR sobre 7 determinantes (placeholder hasta Proyecto Econométrico ESPE 2026-2027) |
| **Priorización MCDA** | ¿Qué parroquia × ENT debe atenderse primero? | Suma ponderada multicriterio (Marsh/ISPOR 2016) sobre 6 criterios |

Cada módulo expone dos capas: **coropleta** (mapa temático por cuantiles o categorías) y **hot-spot** (superficie continua KDE + Turbo, con interpolación IDW para parroquias sin dato — ver §9).

---

## 2. Fuentes de datos

### 2.1. Registro sanitario — INEC

| Fuente | Cobertura | Formato | Volumen | Cobertura temática |
|---|---|---|---|---|
| Egresos Hospitalarios INEC (RDACAA) | 2013-2023 | `.sav` (SPSS) | ~2.3 GB | Todos los egresos hospitalarios nacionales |
| Egresos Hospitalarios INEC (datos abiertos) | 2024 | `.csv` (sep=`;`, UTF-8) | ~165 MB | Idéntico schema + `tipo_seg`, `dis_pac` |
| Defunciones Generales INEC (EDG) | 2013-2023 | `.sav` (SPSS) | ~180 MB | Registro Civil Ecuador (defunciones inscritas) |
| Defunciones Generales INEC (datos abiertos) | 2024 | `.csv` (sep=`;`, UTF-8) | ~15 MB | Schema EDG completo |

Los volúmenes consolidados 2013-2024 — tras lectura con `pyreadstat.read_sav()` y `pandas.read_csv()`, normalización de nombres de columna, y concatenación — son:

- **Egresos**: 13 544 354 filas (total input pre-limpieza).
- **Defunciones**: 980 617 filas (total input pre-limpieza).
- **Ratio defunciones/egresos**: 13,8 : 1.

Ambas tablas se cachean en `intermediate/egresos_all.parquet` (~200 MB) y `intermediate/defunciones_all.parquet` (~30 MB) para corridas posteriores del pipeline.

### 2.2. Bases poblacionales — INEC

| Fuente | Año | Formato | Volumen | Uso |
|---|---|---|---|---|
| CPV 2010 microdato de personas | 2010 | `.csv` | 3.66 GB / 14.48 M filas | Reconstrucción de share parroquial histórico |
| CPV 2022 Densidad Poblacional | 2022 | `.xlsx` | 3 hojas | Población parroquial ancla |
| Proyecciones cantonales INEC Rev. 2024 | 2010-2035 | `.xlsx` | 221 cantones × 26 años | Totales anuales para interpolación (§5) |
| Datos poblacionales provincial | 2010-2025 | `.xls` | | Validación cruzada |

### 2.3. Cartografía

| Fuente | Año | Formato | Features |
|---|---|---|---|
| Parroquias CONALI | 2025 | GeoJSON (EPSG:4326) | 1 050 (rurales + cabeceras cantonales agregadas) |
| Centroides parroquiales | 2025 | Shapefile (EPSG:32717, UTM 17S) | Derivados del polígono CONALI |
| Parroquias OTP simplificadas | 2025 | GeoJSON | Variante topología simplificada para el web |

### 2.4. Diccionarios y metadatos

Adjuntos como material de apoyo (no consumidos por el pipeline automático):

- `inputs/egresos/diccionarios/Diccionario de Egresos Hospitalarios 2024.ods`
- `inputs/egresos/diccionarios/Metadatos de Egresos Hospitalarios 2024.ods`
- `inputs/defunciones/diccionarios/Diccionario-de-Defunciones-Generales-2024.ods`
- `inputs/defunciones/diccionarios/Metadatos_de_Defunciones_Generales_2024.ods`

---

## 3. Pipeline de limpieza y armonización (Fases 0-2)

El pipeline se organiza como paquete Python `scripts/ent_pipeline/` con cinco fases numeradas, cada una con entry-point CLI y documentación inline:

```
scripts/ent_pipeline/
├── __init__.py
├── config.py              ← constantes, esquemas, políticas
├── io_inec.py             ← load_egresos(year), load_defunciones(year), csv_names_to_codes
├── 01_profile.py          ← Fase 1 — HTML de calidad
├── 02_clean.py            ← Fase 2 — limpieza + 3 esquemas ENT
├── 03_rates.py            ← Fase 3 — tasas parroquiales + JSON
├── 04_trends.py           ← Fase 4 — MK + Sen + FDR
├── 05_export_visor.py     ← Fase 5 — merge final → visor
├── population/
│   └── build_pob_2010.py  ← denominador histórico CPV 2010
├── templates/
│   └── profile_report.html.j2
└── requirements.txt
```

### 3.1. Fase 0 — Reorganización de inputs

La Fase 0 consolida los microdatos crudos en una estructura coherente `inputs/{egresos,defunciones,poblacion,shapefiles}/` con subcarpetas `raw/` y `diccionarios/`. Los archivos `.sav` (2.5 GB) se mueven a nivel de filesystem desde `ENT_ART/datos/datos_originales/alexis_{egr,def}/` para no duplicar volumen en git. Resultado: 12 archivos en `inputs/egresos/raw/` (11 `.sav` + 1 `.csv`) e idéntico en `inputs/defunciones/raw/`.

### 3.2. Fase 1 — Perfilado HTML de calidad

`01_profile.py` emite dos HTML autoportables (`intermediate/profile_egresos.html` y `profile_defunciones.html`) con **siete bloques de calidad** renderizados vía Jinja2 + matplotlib inline (base64 PNG, sin dependencias JS externas):

| Bloque | Contenido |
|---|---|
| **A — Integridad y volumen** | Totales por año × fuente; evolución de columnas (cuándo aparecen/desaparecen); hash SHA256 de cada archivo |
| **B — Calidad por columna crítica** | Para prov_res, cant_res, parr_res, cau_cie10/causa4, sexo, edad, etnia, fechas: % missing, % válidos, top-5 valores, rango; heatmap año × columna de % missing |
| **C — Integridad referencial geográfica** | Match entre triples DPA6 observados y GeoJSON 1 050; reporte de no-matches; conteo de provincias 20/88/90 |
| **D — CIE-10** | Top-50 códigos; proporción no clasificable en los 5 grupos Morales; clasificación preliminar por regex |
| **E — Estratificación demográfica** | Distribuciones por sexo, grupo etario (<1, 1-4, 5-14, 15-44, 45-64, 65+), etnia, área |
| **F — Temporalidad** | Serie anual de volúmenes por grupo ENT tentativo; detección de rupturas pandémicas; meses con conteo 0 |
| **G — Defunciones vs Egresos** | Comparación lado a lado; proporción defunciones/egresos por grupo ENT como indicador indirecto de letalidad |

#### Cinco anomalías críticas detectadas en Fase 1

A partir del HTML se identificaron las **cinco anomalías fundamentales** que guiaron el diseño de las reglas de Fase 2:

1. **37,88 % de egresos son huérfanos (≈ 4,7 M registros)**: parroquias urbanas codificadas en INEC (ej. `090112` Tarqui en Guayaquil = 498 K egresos, `090114` Urdesa = 315 K) no existen en el GeoJSON CONALI 2025 que solo contiene las 1 050 parroquias rurales + cabeceras cantonales.
2. **Ruptura metodológica 2015+ en defunciones**: `cant_res` y `parr_res` pierden el 86,96 % de su cobertura desde 2015. `parr_fall` (lugar de fallecimiento, no residencia) sí existe desde 2013 con 9,36 % missing y se usa como fallback.
3. **70,29 % de egresos son "no-ENT"**: dominados por obstetricia (O80 parto vaginal 4,79 %, O82 cesárea 2,96 %), apendicitis K35 (1,95 %) y causas agudas. Esto es esperado porque los egresos hospitalarios incluyen toda patología. En defunciones "no-ENT" cae a 41,57 %.
4. **Edad sentinel 999**: los registros con `edad=999` son la codificación INEC de "no especificada" — se recodifican a `edad_invalida=True` sin descarte.
5. **383 meses con 0 defunciones en el rango 1898-1912**: `fecha_fall` contiene datos históricos espurios. Se filtra obligatoriamente por `anio_fall ∈ [2013, 2024]`.

### 3.3. Fase 2 — Limpieza con reglas declarativas

`02_clean.py` consume los parquet cacheados y aplica cinco políticas parametrizadas en `config.py`. Esto permite re-correr con diferentes combinaciones mediante un único flag CLI, sin tocar código.

#### 3.3.1. Reglas fijas (no controversiales)

1. **Rango anual válido**: `anio_egr ∈ [2013, 2024]` para egresos; `anio_fall ∈ [2013, 2024]` para defunciones.
2. **Edad válida**: `0 ≤ edad ≤ 120`. Sentinel 999 → `edad_invalida=True` (no se descarta).
3. **Causa no vacía**: `cau_cie10 ≠ ''` para egresos, `causa4 ≠ ''` para defunciones.
4. **Normalización CIE-10**: `upper() → strip() → replace('.','') → [:3]`. Ejemplo: `"I21.4"` → `"I21"`.
5. **Duplicados exactos**: fila idéntica en todas las columnas (posible en CSV 2024) se preserva una y se cuenta.

#### 3.3.2. Políticas parametrizadas (decisiones aprobadas)

| Política | Valor | Descripción |
|---|---|---|
| `ORPHAN_POLICY` | `'aggregate'` | DPA6 huérfanos → cabecera cantonal `prov(2)+cant(2)+'50'`. Preserva 4,7 M registros y columna de trazabilidad `parroquia_key_original`. |
| `DEF_GEO_SOURCE` | `'parr_res_or_fall'` | Usa `parr_res` cuando existe; cae a `parr_fall` 2015+. Documentado en `_meta.def_geo_nota`. |
| `PANDEMIC_POLICY` | `'flag'` | Añade columna `periodo ∈ {pre-pandemia, pandemia, post-pandemia}`. Fase 4 corre MK en dos variantes (con y sin 2020-2021). |
| `EXCLUDE_PROVS` | `{'20', '88', '90'}` | Excluye Galápagos, Zonas No Delimitadas y No Especificada — réplica Morales. |
| `VALID_YEAR_RANGE` | `(2013, 2024)` | Rango anual canónico. |

#### 3.3.3. Conteos observados (exclusion_log.json, ejecución 2026-04-21)

| Métrica | Egresos | Defunciones |
|---|---:|---:|
| total_input | 13 544 354 | 980 617 |
| removed_year_out_of_range | 0 | 6 039 |
| removed_cause_empty | 0 | 0 |
| removed_provincia_20/88/90 | 33 773 | 700 |
| flagged_edad_invalida (no drop) | 2 027 | 603 |
| orphans_aggregated_to_cab | 4 689 414 | 487 824 |
| no_geo_match_residual | 12 304 | 320 |
| **total_output** | **13 510 581** | **973 878** |

#### 3.3.4. Fuente de geo para defunciones (`DEF_GEO_SOURCE='parr_res_or_fall'`)

| geo_source | n | % |
|---|---:|---:|
| `parr_res` | 127 187 | 13,06 % |
| `parr_fall` | 756 049 | 77,64 % |
| (vacío) | 91 342 | 9,38 % |

Esta tabla confirma la ruptura metodológica INEC 2015+: 77,64 % de las defunciones 2013-2024 usan lugar de fallecimiento como proxy de residencia.

#### 3.3.5. CSV 2024 con text labels — bug crítico corregido

Los CSV 2024 abiertos (`egresos_hospitalarios_2024.csv` y `EDG_2024.csv`) traen **nombres en texto** (`prov_res="Guayas"`, `parr_res="Tarqui, Cabecera Cantonal"`) en lugar de códigos numéricos como los `.sav` 2013-2023, y encoding UTF-8 (no `latin1` como asumía `io_inec.py` inicialmente). El fix requirió:

1. Lectura `pd.read_csv(..., encoding='utf-8')`.
2. Construcción de lookup reverso `_norm_name(nombre) → DPA6` sobre los 1 050 triples únicos del GeoJSON.
3. Función `csv_names_to_codes()` con **3-tier fallback**:
   - Tier 1 `(prov, cant, parr)` triple completo → DPA6.
   - Tier 2 `(prov, cant)` → DPA4 + `'00'` (la política `orphan=aggregate` luego remapea a cabecera).
   - Tier 3 solo `prov` → DPA2 + `'0000'` (residual; para defunciones se usa `tier3_fill=False` para que caiga al fallback `parr_fall`).
4. 9 aliases declarativos para cantones cuyo nombre difiere entre CSV e INEC-GeoJSON (ej. `('PICHINCHA','QUITO')` → `('PICHINCHA','DISTRITO METROPOLITANO DE QUITO')`).

**Resultado**: 99,95 % match a nivel provincia; 99,86 % match cantón; 53,47 % match parroquia (los faltantes son urbanas, correctamente agregadas en Tier 2). Solo 13 373 registros (0,10 %) quedan como residual.

---

## 4. Clasificación CIE-10 — esquema Morales + esquemas de auditoría

El pipeline emite **tres esquemas paralelos** en el parquet limpio (columnas `grupo_morales`, `grupo_ncd`, `grupo_visor`/`chronic`) para permitir auditoría cruzada sin re-procesar los 13,5 M registros.

### 4.1. Esquema A — "Morales literal" (5 grupos amplios, primario del visor)

Réplica exacta de `codigo_new/Grupos_ent.R` del estudio Morales:

| Grupo | Regex sobre CIE-10 normalizado 3-char | Volumen egresos 2013-2024 | Volumen defunciones 2013-2024 |
|---|---|---:|---:|
| Neoplasias | `^(C\d{2}|D0\d|D1\d|D2\d|D3\d|D4[0-8])$` | 855 621 (6,33 %) | 147 430 (15,14 %) |
| Sist. circulatorio | `^I\d{2}$` (I00-I99) | 567 003 (4,20 %) | 249 868 (25,66 %) |
| Metabólicas | `^E[0-9]\d$` (E00-E99) | 355 512 (2,63 %) | 73 318 (7,53 %) |
| Aparato respiratorio | `^J\d{2}$` (J00-J99) | 937 520 (6,94 %) | 92 347 (9,48 %) |
| Sist. nervioso | `^G\d{2}$` (G00-G99) | 147 192 (1,09 %) | 21 897 (2,25 %) |
| no_ENT | — | 10 647 733 (78,81 %) | 389 018 (39,95 %) |

### 4.2. Esquema B — "NCD estricto OMS" (auditoría)

Excluye explícitamente neumonías agudas (J18), meningitis aguda, infecciones respiratorias agudas (J69/J96/J97/J99) y anemias (D64.9). Grupos: Neoplasias (excl. D64.9), Cardiovasculares I00-I99, Respiratorias crónicas J30-J99 excl. J69/J96/J97/J99, Diabetes + Renales crónicas E10-E14 + N00-N29, Digestivas crónicas K70-K77 + K25-K31.

### 4.3. Esquema C — "Chronic/Visor" (intermedio)

Variante que incluye digestivas completas K00-K92 (incluye apendicitis K35 y colelitiasis K80) y diabetes-renales acotadas E10-E14 + N00-N18. Usado como esquema de referencia del visor legacy.

### 4.4. Tabla comparativa de clasificación (egresos, 13,5 M filas)

| Grupo | morales | ncd | visor/chronic |
|---|---:|---:|---:|
| Circulatorio/Cardio | 567 003 | 567 003 | 567 003 |
| Neoplasia | 855 621 | 855 621 | 855 621 |
| Respiratorio (amplio vs crónico) | 937 520 | 296 412 | 296 412 |
| Metabólicas (E00-E99) vs Diabren+N | 355 512 | 560 296 | 415 554 |
| Digestivas (K-completo vs crónicas) | — | 127 953 | 1 879 769 |
| Nervioso (G00-G99) | 147 192 | — | — |

**Lecturas clave:**
- **Delta Morales vs NCD en respiratorio** (937 K − 296 K ≈ 641 K) = inflación por neumonías agudas J18 + influenza J10-J11 que OMS excluye de NCD.
- **Delta visor vs NCD en digestivas** (1,88 M − 128 K ≈ 1,75 M) = inclusión de K35 apendicitis + K80 colelitiasis en el visor chronic.
- **Cero delta** entre los 3 esquemas en Circulatorio (I00-I99) y Neoplasia (C00-D48) — la definición es idéntica.

### 4.5. Sub-ENT clínicas

Paralelamente a los 5 grupos, se clasifican 12 sub-ENT con regex sobre el mismo CIE-10 normalizado (ver `SUBENT_PATRONES` en `config.py`):

| sub-ID | Regex | Descripción |
|---|---|---|
| `dm1` | `^E10$` | Diabetes tipo 1 |
| `dm2` | `^E1[14]$` | Diabetes tipo 2 / no-insulino-dependiente |
| `hta` | `^I1[0-5]$` | Hipertensión arterial |
| `iam` | `^I2[12]$` | Infarto agudo de miocardio |
| `ecv` | `^I6[0-9]$` | Enfermedad cerebrovascular |
| `erc` | `^N18$` | Enfermedad renal crónica |
| `obesidad` | `^E66$` | Obesidad |
| `ca_mama` | `^C50$` | Cáncer de mama |
| `ca_est` | `^C16$` | Cáncer de estómago |
| `ca_prost` | `^C61$` | Cáncer de próstata |
| `depresion` | `^F3[23]$` | Trastornos depresivos recurrentes |
| `epoc` | `^J44$` | EPOC |

Ejemplo de conteos 2024: dm2=10 423, hta=7 304, erc=9 718, ca_mama=5 693, iam=4 199, epoc=3 626. Órdenes de magnitud coincidentes con proporciones GBD Ecuador.

---

## 5. Denominador poblacional — método log-share 2010→2022 × proyecciones cantonales

**Contribución original de la Fase 6**. Hasta Fase 5 el visor utilizaba el CPV 2022 como denominador estático para todos los años 2013-2024, lo cual introduce un sesgo de hasta ±15 % en parroquias con tasas de crecimiento divergentes (urbanas en expansión vs rurales con emigración). La Fase 6 sustituye ese denominador estático por una **interpolación logarítmica de shares intra-cantonales** anclada en dos censos reales (CPV 2010 y CPV 2022) y escalada anualmente por las **proyecciones cantonales INEC Rev. 2024**.

### 5.1. Motivación

El CPV 2022 único induce tres problemas:

1. **Parroquias en crecimiento rápido** (conurbaciones Quito-Calderón, Guayaquil-Durán, Ambato-Ficoa) aparecen con tasas infladas 2013-2019 porque la población real era menor.
2. **Parroquias con emigración** (rurales de Loja, Manabí, Cotopaxi) aparecen con tasas subestimadas en años tardíos.
3. **Parroquias post-CONALI** (creadas por decreto entre 2015-2025) no existían en CPV 2010 y tienen share=0 → el visor las pintaba como cero-casos cuando en realidad no había denominador sostenible.

### 5.2. Fórmula del método log-share

Para cada parroquia `p` perteneciente al cantón `c`, y cada año `y ∈ [2010, 2035]`:

**Paso 1 — Share intra-cantonal en los dos censos:**

```
s_p^{2010} = pob_p^{2010} / Σ_{p'∈c} pob_{p'}^{2010}
s_p^{2022} = pob_p^{2022} / Σ_{p'∈c} pob_{p'}^{2022}
```

**Paso 2 — Interpolación logarítmica con anclaje temporal:**

```
α(y) = clip( (y − 2010) / 12,  0,  1 )

log s_p^y = (1 − α) · log s_p^{2010}  +  α · log s_p^{2022}
```

Para `y > 2022`, `α = 1` (extrapolación constante del share 2022 — el cambio demográfico agregado se captura vía el total cantonal, no vía redistribución intra-cantonal).

**Paso 3 — Renormalización intra-cantonal** (la interpolación logarítmica NO preserva la suma = 1 exactamente):

```
s_p^y  ←  s_p^y / Σ_{p'∈c} s_{p'}^y
```

**Paso 4 — Aplicación del total cantonal INEC:**

```
pob_p^y  =  s_p^y · pob_c^{y, INEC}
```

donde `pob_c^{y, INEC}` es la proyección cantonal oficial INEC Rev. 2024.

### 5.3. Propiedades del método

| Propiedad | Cumplimiento |
|---|---|
| **Aditividad cantonal exacta** | Sí, por construcción: `Σ_p pob_p^y = pob_c^{y, INEC}` |
| **Coincidencia con censos reales** | En `y=2010`: `pob_p^{2010} = s_p^{2010} · pob_c^{2010, INEC}` (si la proyección cantonal INEC 2010 coincide con el CPV 2010 agregado, que sí coincide por construcción). Análogo para 2022. |
| **Captura divergencia urbano-rural** | Sí, mediante la interpolación en log-espacio (crecimientos geométricos lineales en log) |
| **Manejo de parroquias post-CONALI** | `share_2010 ≈ ε` (epsilon positivo pequeño) para evitar `log 0`; el share efectivo queda dominado por 2022 desde `α → 1` |
| **Extrapolación 2023-2035** | Share fijo 2022, total cantonal proyectado por INEC — sigue el crecimiento agregado |

### 5.4. Implementación

- `scripts/ent_pipeline/population/build_pob_2010.py` reconstruye `pob_parroquial_2010.json` a partir del microdato CPV 2010 `.csv` (3.66 GB, 14.48 M filas, columna `P13` = DPA6). Lectura en chunks de 1 000 000 filas con `pandas.read_csv(..., chunksize=1_000_000)`. Validación: total esperado en `[14.0, 15.0]` M habitantes.
- La fase de interpolación anual (`build_pob_anual.py`, no mostrado aquí) cruza `pob_parroquial_2010.json`, `pob_parroquial_2022.json` y la hoja INEC de proyecciones cantonales para emitir `intermediate/pob_parroquial_anual.json` con estructura `{year: {DPA6: poblacion}}`.

### 5.5. Comparación con el denominador estático 2022

| Caso ilustrativo | Denominador 2022 estático | Denominador log-share anual | Impacto en tasa |
|---|---:|---:|---|
| Calderón (Quito) 2015 | ~150 000 | ~105 000 | +43 % sub-estimación pre-corrección |
| Zámbiza (Quito rural) 2024 | ~4 200 | ~3 950 | +6 % sobre-estimación pre-corrección |
| Parroquia creada 2019 | 0 (no existe en 2022) | share_2010 ≈ ε | Evita división por cero |

---

## 6. Cálculo de tasas parroquiales (Fase 3)

`scripts/ent_pipeline/03_rates.py` agrega los parquets limpios por `(parroquia_key, grupo_X, anio)` y cruza con el denominador poblacional para emitir el JSON primario del visor.

### 6.1. Tasa cruda /100k

Para cada parroquia `p`, grupo ENT `g` (o sub-ENT), año `y`:

```
tasa_{p,g,y} = ( casos_{p,g,y} / pob_{p,y} ) × 100 000
tasa_mort_{p,g,y} = ( muertes_{p,g,y} / pob_{p,y} ) × 100 000
```

Las tasas se redondean a 1 decimal en el JSON para mantener volumen acotado.

### 6.2. Agregación a cabecera cantonal

Los 4,7 M egresos huérfanos urbanos ya fueron agregados en Fase 2 bajo la política `ORPHAN_POLICY='aggregate'`. El efecto es que la clave DPA6 de cabecera cantonal (ej. `090150` = Guayaquil cabecera) incluye la suma de casos de **todas** las parroquias urbanas sin representación en CONALI (Tarqui 498 K + Urdesa 315 K + Ximena 232 K + …). La metadata del JSON preserva el campo `aggregated_from: ['090112','090114','090104',…]` para trazabilidad.

### 6.3. Validación vs legacy (2013-2023, 5 grupos Morales, egresos)

| grupo | legacy_xlsx | new_pipeline | delta |
|---|---:|---:|---|
| circulatorio | 514 852 | 514 852 | 0,00 % |
| neoplasia | 765 217 | 765 217 | 0,00 % |
| metabolica | 324 536 | 324 536 | 0,00 % |
| respiratorio | 854 964 | 854 964 | 0,00 % |
| nervioso | 133 367 | 133 367 | 0,00 % |

**EXACT match**: 0 casos de diferencia en 2,59 M casos ENT para los 11 años comunes. Confirma que el pipeline Python reproduce 100 % la clasificación y agregación del `CONSOLIDADO_egresos.xlsx` legacy — el reemplazo de la fuente opaca es drop-in.

### 6.4. Mortalidad — salto 12-42× respecto al legacy

| grupo | legacy (hospitalaria) | new_EDG (defunciones generales) | ratio |
|---|---:|---:|---:|
| circulatorio | 9 044 | 223 867 | 24,75× |
| neoplasia | 4 236 | 132 886 | 31,37× |
| metabolica | 1 616 | 67 609 | 41,84× |
| respiratorio | 7 167 | 84 719 | 11,82× |
| nervioso | 556 | 19 373 | 34,84× |

**Esta diferencia no es un bug, es mejora de calidad**: el legacy `CONSOLIDADO_egresos.xlsx` sólo contaba **defunciones hospitalarias** (registros con `con_egrpa='Fallecido'`), una sub-población estrecha. El pipeline nuevo usa la base completa de **Defunciones Generales INEC (EDG)** — todas las muertes registradas en el Registro Civil, alineado con cómo OMS/GBD miden mortalidad poblacional. Documentado explícitamente en `_meta.mortalidad_nota` del JSON.

### 6.5. Estructura del JSON visor (Fase 3)

```json
{
  "anios": [2013, 2014, ..., 2024],
  "grupos": ["circulatorio","neoplasia","metabolica","respiratorio","nervioso"],
  "subent": ["dm1","dm2","hta","iam","ecv","erc","obesidad",
             "ca_mama","ca_est","ca_prost","depresion","epoc"],
  "parroquias": {
    "090150": {
      "nombre": "Guayaquil (cabecera cantonal — incluye agregado urbano)",
      "cant": "Guayaquil", "prov": "Guayas",
      "match_level": "parroquia",
      "aggregated_from": ["090112","090114","090104"],
      "poblacion_2022": 2665392,
      "data": {
        "grupos": {
          "circulatorio": {
            "casos":   [45, 52, ..., 62],
            "muertes": [12, 14, ..., 18]
          }
        },
        "subent": { "dm2": { "casos": [...], "muertes": [...] } }
      }
    }
  },
  "calidad": { "n_parroquias_match": 1050, "pct_huerfanos_residual": 0.02, "pct_aggregated_urban": 37.88 },
  "_meta": { "source": "INEC EGH+EDG 2013-2024", "pipeline_version": "1.0.0",
             "hash_inputs": {...}, "generated_at": "2026-04-22T...",
             "ent_scheme_visor": "morales",
             "def_geo_nota": "defunciones 2015-2024 usan lugar de fallecimiento como proxy de residencia",
             "denominador_nota": "log-share CPV 2010→2022 × proyecciones cantonales INEC Rev. 2024",
             "pandemia_periodos": {"pre": [2013,2019], "pandemia": [2020,2021], "post": [2022,2024]} }
}
```

El schema es idéntico al legacy a nivel de `parroquias[dpa].data.{grupos,subent}[ent].{casos,muertes}` — el visor React lo consume drop-in sin cambios de código.

---

## 7. Análisis de tendencias (Fase 4) — Mann-Kendall + Sen + FDR-BH

`scripts/ent_pipeline/04_trends.py` calcula tendencias temporales no paramétricas para cada combinación `(nivel × unidad × grupo × métrica × variante)`, con un total de **~30 000 tests** corregidos por múltiples comparaciones.

### 7.1. Fundamentos estadísticos

| Componente | Implementación | Fundamento |
|---|---|---|
| **Test de tendencia** | `scipy.stats.kendalltau(year, rate, variant='b')` | Mann-Kendall (τ-b con ajuste por empates). Replica exacta del `Kendall::MannKendall()` de R usado en Morales. No asume normalidad ni linealidad. |
| **Magnitud del cambio** | `scipy.stats.theilslopes(rate, year, alpha=0.95)` | Pendiente robusta de **Theil-Sen**: mediana de todas las pendientes entre pares de puntos. Resistente a outliers. |
| **Pretest de autocorrelación** | `statsmodels.stats.diagnostic.acorr_ljungbox(series, lags=3)` | Ljung-Box lag=3. Si `p_LB < 0.05` se marca `ljung_p` en el JSON — sólo transparencia, no se descarta el test. |
| **Corrección múltiples pruebas** | `statsmodels.stats.multitest.fdrcorrection(pvals, method='indep')` | Benjamini-Hochberg. Controla la False Discovery Rate al 5 %, apropiado para testing masivo espacial. |

### 7.2. Dos variantes por test

Cada combinación se ejecuta dos veces:

| Variante | N | Propósito |
|---|---:|---|
| `serie_completa` | 12 años | Serie 2013-2024 completa, incluyendo pandemia 2020-2021 |
| `sin_pandemia` | 10 años | Excluye 2020-2021 para aislar el efecto del confinamiento COVID-19 sobre hospitalizaciones |

### 7.3. Clasificación ternaria final

Tras la corrección FDR-BH:

```
si  p_adj < 0.05  y  τ > 0   →  Ascendente
si  p_adj < 0.05  y  τ < 0   →  Descendente
si  p_adj ≥ 0.05              →  Estable
```

### 7.4. Buckets de corrección FDR

La corrección Benjamini-Hochberg se aplica **separadamente** por bucket (nivel × grupo × métrica × variante) para no mezclar distribuciones de test no comparables (1 050 parroquias vs 1 nacional).

| Nivel | Esquema | Tests MK con FDR |
|---|---|---:|
| parroquia/grupos | morales | 13 720 |
| parroquia/subent | morales | 14 062 |
| provincia/grupos | morales | 460 |
| provincia/subent | morales | 1 042 |
| nacional/grupos | morales | 20 |
| nacional/subent | morales | 48 |

Totales equivalentes para esquemas NCD (13 070 / 460 / 20) y chronic (13 924 / 460 / 20), con pequeñas variaciones por cobertura de datos.

### 7.5. Parámetros canónicos

```python
VARIANTS      = {"serie_completa": None, "sin_pandemia": {2020, 2021}}
MIN_N_VARIANT = 6       # años mínimos por variante para correr MK
MIN_CASOS     = 10      # total casos/muertes para no descartar por ruido
TASA_POR      = 100_000
ALPHA         = 0.05
```

### 7.6. Resumen nacional — 5 grupos Morales (post-fix defunciones 2024)

| grupo | métrica | `serie_completa` | `sin_pandemia` |
|---|---|---|---|
| circulatorio | mortalidad | τ=+0,788 p_adj=0,000 sen=+6,63 → **Ascendente** | τ=+0,911 p_adj=0,000 sen=+6,46 → **Ascendente** |
| circulatorio | morbilidad | τ=+0,364 p_adj=0,116 → Estable | τ=+0,689 p_adj=0,005 sen=+3,17 → **Ascendente** |
| neoplasia | mortalidad | τ=+0,939 p_adj=0,000 sen=+2,27 → **Ascendente** | τ=+1,000 p_adj=0,000 sen=+2,31 → **Ascendente** |
| neoplasia | morbilidad | τ=+0,455 p_adj=0,045 sen=+11,39 → **Ascendente** | τ=+0,733 p_adj=0,002 sen=+11,99 → **Ascendente** |
| metabolica | morbilidad | τ=+0,273 p_adj=0,250 → Estable | τ=+0,556 p_adj=0,029 sen=+1,68 → **Ascendente** |
| metabolica | mortalidad | τ=+0,242 p_adj=0,311 → Estable | τ=+0,200 p_adj=0,484 → Estable |
| respiratorio | mortalidad | τ=+0,515 p_adj=0,021 sen=+1,07 → **Ascendente** | τ=+0,600 p_adj=0,017 sen=+0,92 → **Ascendente** |
| respiratorio | morbilidad | τ=-0,030 p_adj=0,947 → Estable | τ=+0,156 p_adj=0,601 → Estable |
| nervioso | mortalidad | τ=+0,909 p_adj=0,000 sen=+0,68 → **Ascendente** | τ=+0,911 p_adj=0,000 sen=+0,70 → **Ascendente** |
| nervioso | morbilidad | τ=+0,545 p_adj=0,014 sen=+1,10 → **Ascendente** | τ=+0,911 p_adj=0,000 sen=+1,30 → **Ascendente** |

**Lectura epidemiológica:**
- **Mortalidad circulatoria + neoplasia + nervioso sube significativamente** — consistente con carga ENT creciente en Ecuador (GBD 2019-2023).
- **Mortalidad respiratoria ascendente contra-intuitiva post-pandemia**; `sin_pandemia` confirma que la tendencia no es sólo un artefacto 2020-2021.
- **Morbilidad circulatoria/metabólica estable serie completa pero ascendente sin pandemia** — la caída 2020-2021 (pacientes que no se hospitalizaron por el colapso asistencial COVID) aplana la pendiente cuando se incluye.

### 7.7. Distribución de clases — parroquia × 5 grupos Morales, serie_completa

| métrica | Estable | Ascendente | Descendente |
|---|---:|---:|---:|
| morbilidad | 5 222 | 54 | 4 |
| mortalidad | 5 193 | 87 | 0 |

De las 87 parroquias con mortalidad ENT Ascendente, **70 son mortalidad circulatoria** — el cluster de parroquias con mortalidad cardiovascular en alza es el hallazgo epidemiológico principal del visor.

### 7.8. Validación cruzada contra Morales 2017-2023

Script `verify_trend_vs_study.py` ejecutado sobre las 118 causas CIE-10 significativas del estudio Morales:

| Dataset | Causas significativas Morales | Match τ (4 decimales) | Match dirección |
|---|---:|---:|---:|
| Egresos 2017-2023 | 64 | **64/64 (100 %)** | 64/64 (100 %) |
| Defunciones 2017-2023 | 54 | **54/54 (100 %)** | 54/54 (100 %) |
| **Total** | **118** | **118/118 (100 %)** | **118/118 (100 %)** |

Las pequeñas diferencias en p-valor entre Morales y el pipeline actual (ej. Morales R = 0,0355 vs scipy = 0,0302) provienen del test exacto de R vs el asintótico de scipy; ambos concuerdan en significancia al α=0,05. Esto confirma que el engine MK-Sen en scipy/statsmodels replica el pipeline original de Morales con fidelidad numérica completa.

### 7.9. Forma del JSON de tendencias

```json
{
  "090150": {
    "cardio": {
      "morbilidad": {
        "serie_completa": {"tau":0.82, "p_raw":0.003, "p_adj":0.015,
                           "sen_slope":3.4, "clase":"Ascendente",
                           "ljung_p":0.45, "n":12},
        "sin_pandemia":   {"tau":0.73, "p_raw":0.012, "p_adj":0.041,
                           "sen_slope":2.9, "clase":"Ascendente",
                           "ljung_p":0.52, "n":10}
      },
      "mortalidad": { "...": "mismo schema" }
    }
  }
}
```

### 7.10. Merge final (Fase 5) → JSON visor enriquecido

`05_export_visor.py` fusiona `ent_parroquial.json` (tasas) + `tendencias_parroquial.json` en un único JSON que el visor React consume drop-in. Se embeben:

- **17 952 tendencias parroquiales** (1 056 parroquias × 5 grupos + 1 056 × 12 sub-ENT = 5 280 + 12 672).
- Nacional (EC) y 24 provincias con tendencias completas en `tendencias_agg.{nacional,provincia[dpa2]}.{grupos,subent}[ent]`, incluyendo `serie_tasa` por año.
- Schema consistente unit-first. JSON estricto (NaN → null).

Tamaño final: **8,49 MB** (vs 2,17 MB de la versión Fase 3). Backup en `webapp-react/public/assets/_legacy/ent_parroquial.v0_20260422-002630.json`.

### 7.11. Integración React — `lookupTrend` O(1)

El nuevo helper `webapp-react/src/lib/trend.js::lookupTrend(entData, level, unitId, ent, metric, variant)` reemplaza el OLS cliente-side por lectura directa del JSON:

```javascript
lookupTrend(entData, 'parroquia', '090150', 'circulatorio', 'mortalidad', 'serie_completa')
// →  { valid: true, clase: 'Estable', tau: 0.606, pValue: 0.0525,
//      senSlope: 5.12, annualPct: 1.82, n: 12, significant: false, ... }
```

`computeTrend(series)` queda deprecated — se preserva sólo como fallback para `ENT='todas'` (pseudo-agregado suma de 5 grupos, no pre-computado) y análisis off-pipeline. El KPIBlock ahora muestra **τ de Kendall** (effect-size natural de MK) en lugar del **R²** anterior; la leyenda dice "Mann-Kendall (τ) · pendiente de Sen · FDR Benjamini-Hochberg · α=0,05".

---

## 8. Simulación de determinantes (MGWR) y priorización MCDA

### 8.1. Siete determinantes sociales de la salud

El módulo "Determinantes" opera sobre siete variables contextuales:

| ID | Descripción | Fuente tentativa real (pendiente) |
|---|---|---|
| `pobreza` | % pobreza por ingresos | ENEMDU INEC / CPV 2022 |
| `nbi` | % Necesidades Básicas Insatisfechas | CPV 2022 |
| `pm25` | Media anual PM2.5 (µg/m³) | MAATE / satelital MAIAC |
| `tabaquismo` | Prevalencia tabaquismo adulto | STEPS-OMS / ENSANUT 2018 |
| `obesidad` | Prevalencia obesidad adulto IMC ≥ 30 | ENSANUT 2018 / STEPS |
| `sedentarismo` | Prevalencia inactividad física | STEPS-OMS |
| `acceso_salud_km` | Distancia media al establecimiento más cercano | MSP + centroides parroquiales |

### 8.2. Estado actual — SIMULACIÓN estructurada

Los valores actuales son producto de `scripts/simular_determinantes.py` como **preview del Proyecto Econométrico Espacial F-I+D+i-075 (Núñez-ESPE 2026-2027)**. La simulación es **estructurada, no aleatoria**:

1. Valor base por provincia derivado de literatura real (ENSANUT-ECU 2018 / STEPS-OMS / GBD 2021).
2. Factor según tipo de parroquia (urbana vs rural) del shapefile CONALI.
3. Factor según densidad poblacional real (CPV 2022).
4. Ruido gaussiano σ=8 % para evitar uniformidad.
5. Semilla fija `random.seed(20260421)` → determinista.

Esto está **explícitamente documentado en `_meta`** del JSON de salida y será reemplazado cuando el proyecto ESPE emita datos reales.

### 8.3. MGWR simulado — betas locales por parroquia

`scripts/calcular_mgwr_simulado.py` emite `webapp/assets/mgwr_betas.json` con coeficientes locales β para cada combinación `(ENT × determinante × parroquia)`. Los betas nacionales base provienen de literatura (GBD 2021, Lancet Planetary Health 2022 para PM2.5-respiratorio, Lancet Diabetes 2020 para obesidad-DM2); la variación espacial se genera con kernels gaussianos anclados en focos reales:

- **PM2.5 → respiratorio**: focos Quito, Guayaquil, Ambato, Cuenca (grandes urbes con quema y tráfico).
- **Pobreza → todos los grupos**: foco Amazonía norte (Sucumbíos, Orellana, Napo).
- **Obesidad → metabolicas**: focos Costa urbana (Guayas, El Oro, Manabí).

La fórmula para β_p (beta local en parroquia `p`) es:

```
β_p(ENT, det) = β_nacional(ENT, det) · [1 + Σ_k κ(d(p, foco_k); σ_k) · amp_k]
```

donde `κ(·)` es un kernel gaussiano y la amplitud `amp_k` depende del par ENT-determinante.

Esto queda como **placeholder** hasta que el proyecto ESPE 2026-2027 ejecute la regresión MGWR real (Oshan et al. 2020) sobre datos observados.

### 8.4. Índice de vulnerabilidad

En el visor, la métrica del módulo determinantes es un **índice agregado de vulnerabilidad** computado como el promedio normalizado de los 7 determinantes:

```
vuln_p = ( Σ_d  clip(v_p^d / norm_d, 0, 1) ) / n_d_valid
```

donde `norm_d` es el valor de referencia del determinante `d` (tabla en `HotSpotLayer.jsx::det_vuln_value`):

| d | norm_d |
|---|---:|
| pobreza | 50 |
| nbi | 100 |
| pm25 | 50 |
| tabaquismo | 35 |
| obesidad | 45 |
| sedentarismo | 75 |
| acceso_salud_km | 15 |

### 8.5. Priorización MCDA — suma ponderada Marsh/ISPOR 2016

`scripts/calcular_mcda_prioridad.py` implementa un **Análisis Multicriterio (MCDA) por suma ponderada** siguiendo el marco Marsh/ISPOR 2016 y Baltussen 2006, como preview del Proyecto F-I+D+i-075 de Priorización MCDA (INSPI CZ9 Duque 2026-2028).

**Seis criterios** con pesos editables para análisis de sensibilidad:

| # | Criterio | w | Fórmula |
|---|---|---:|---|
| C1 | Tasa de mortalidad × 100k | 0,30 | `letalidad × casos × 100k / pob` |
| C2 | Tasa de egresos × 100k | 0,20 | `casos × 100k / pob` |
| C3 | Carga AVAD simulada | 0,15 | `avad_por_caso × casos` (GBD 2021) |
| C4 | Tendencia CAGR 2015-2023 | 0,15 | Crecimiento medio anual compuesto |
| C5 | Costo al sistema simulado | 0,10 | `costo_por_caso × casos` |
| C6 | Brecha equidad urbano-rural | 0,10 | `ratio cabecera / rural` del cantón |

**Factores por ENT** (plausibles de GBD 2021 / OPS 2022 / MSP 2023):

| ENT | letalidad | AVAD/caso | costo/caso (USD) |
|---|---:|---:|---:|
| circulatorio | 0,14 | 14,2 | 2 200 |
| neoplasia | 0,15 | 17,0 | 3 400 |
| metabolica | 0,04 | 9,1 | 1 600 |
| respiratorio | 0,05 | 7,8 | 1 050 |
| nervioso | 0,07 | 11,2 | 1 650 |

**Salida**: `webapp/assets/priorizacion_mcda.json` con ranking por parroquia (5 ENT ordenados por score). Para parroquias con `casos_total < 10` se hereda el ranking del cantón con flag `fuente: heredada_canton`.

---

## 9. Visualización cartográfica — coropleta y hot-spot (KDE + Turbo + IDW)

### 9.1. Tres paletas canónicas

Definidas en `webapp-react/src/lib/colors.js`:

| Paleta | Tipo | Uso |
|---|---|---|
| **ENT quintiles** (`colorScales`) | 5-stop secuencial ColorBrewer por grupo | Coropleta del módulo Carga |
| **DET categórico** (`DET_COLOR`) | 7-color categórico | Coropleta del módulo Determinantes |
| **Turbo LUT 256-step** (`TURBO_LUT`) | Rampa continua perceptualmente uniforme (Mikhailov 2019) | Hot-spot KDE de los 3 módulos |

La paleta Turbo se precomputa como `Uint8Array(256*3)` mediante la aproximación polinómica de Mikhailov 2019; es **perceptualmente uniforme** (no tiene las bandas artificiales del rainbow jet clásico) y garantiza contraste adecuado para daltónicos rojo-verde.

### 9.2. Coropleta — cuantiles y categorías

| Módulo | Método de corte | Ejemplo |
|---|---|---|
| Carga | **Quintiles** (5 stops) por ENT y año, calculados con `computeQuintiles()` sobre la distribución nacional del año | `circulatorio` 2024: [45,8; 124,2; 237,6; 410,1; 980,3] |
| Determinantes | **Categórico** — color del determinante dominante | pobreza=rojo, pm25=gris, obesidad=naranja |
| MCDA | **Categórico** — color de la ENT prioritaria #1 | Igual esquema ENT_COLOR |

### 9.3. Hot-spot — pipeline KDE completo

`webapp-react/src/components/map/HotSpotLayer.jsx` implementa una superficie continua estilo QGIS "Valor densidad", sobre un canvas HTML5 `<canvas>` renderizado como `L.ImageOverlay` bajo un pane dedicado (`z-index=350`, por debajo del overlayPane 400 donde van los polígonos de borde).

#### Parámetros canónicos

```javascript
const KDE_WIDTH_MAX   = 900    // px del lado mayor del canvas
const KDE_SIGMA_PX    = 20     // σ del kernel gaussiano
const KDE_WEIGHT_MIN  = 0.04   // umbral de confianza por pixel
const KDE_ALPHA       = 255    // alpha pixel interno (opacidad via overlay)
const KDE_OVERLAY_OP  = 0.82   // opacidad del L.imageOverlay
```

#### Pipeline de 10 pasos

1. **Extracción de valores por parroquia** (módulo-consciente): `carga_value` / `det_vuln_value` / `mcda_total_value`. Cada helper devuelve `{value, status}` con status ∈ `{data, interp, nodata}`.
2. **Cuatro buckets territoriales**:
   - `observada` = pob > 0 ∧ casos > 0 → alimenta splat + mask.
   - `interpolada` = pob > 0 ∧ casos = 0 → solo mask; valor se completa por IDW (§10).
   - `sinDato` = pob = 0 → render gris dashed, fuera del KDE.
   - `fueraProv` = fuera del `provFilter` → opacity 0.
3. **z-score nacional** por parroquia sobre las `observada`:
   `z_i = (valor_i − μ) / σ`
4. **Splat gaussiano** (σ = 20 px) sobre canvas 900 px. Cada centroide proyectado contribuye `exp(-r² / 2σ²)` al pixel.
5. **Agregación ponderada por pixel**:
   `pixel_z = Σ(z_i · w_i) / Σ(w_i)`
   Pixeles con `Σw < 0.04` → alpha 0 (zona sin cobertura).
6. **Normalización empírica p2-p98**: se calculan los percentiles 2 y 98 del `pixel_z` válido; se mapea `t = clip((z − p2)/(p98 − p2), 0, 1)`. Esto hace que los hot-spots extremos siempre aparezcan donde realmente están, incluso con distribuciones muy sesgadas como las tasas ENT.
7. **TURBO_LUT** indexado por `Math.floor(t*255)`.
8. **Máscara `destination-in`** con los polígonos conDato (fill evenodd). Esto limita visualmente el KDE al territorio con datos.
9. **Alpha interno 255** (color puro sin blending intra-pixel que desaturaría el Turbo) + **opacidad overlay 0.82** para dejar ver el base-map.
10. Encima, GeoJSON transparente con stroke fino para conDato, y fill gris `#e2e8f0` + stroke `#94a3b8` dashed para sinDato (estándar OMS / CDC Wonder / Eurostat para "insufficient data").

#### Rationale metodológico

El KDE gaussiano es equivalente a un **estimador Nadaraya-Watson** (regresión por k-nearest-neighbors con peso continuo): ya produce una superficie interpolada suave sobre todo el mask. Sin embargo, el valor numérico del tooltip necesita una cifra concreta por parroquia; leer el pixel del centroide sería inestable (pudiera caer en un píxel con `Σw < 0.04`). Por eso usamos **IDW adicional discreto** solo para el valor numérico del tooltip (ver §10).

### 9.4. Leyenda (`Legend.jsx`)

La leyenda flotante (bottom-left) cambia según módulo × layerType:

| Módulo | Layer | Contenido |
|---|---|---|
| Carga | coropleta | 5 swatches por quintil (paleta del ENT activo) |
| Carga | hot-spot | Gradiente Turbo 64-stop + etiquetas "Muy bajo / Medio / Muy alto" |
| Determinantes | coropleta | 7 swatches categóricos (DET_COLOR) |
| Determinantes | hot-spot | Gradiente Turbo + etiqueta "Hot-spot vulnerabilidad" |
| MCDA | coropleta | 5 swatches categóricos (ENT_COLOR, ENT prioritaria #1) |
| MCDA | hot-spot | Gradiente Turbo + etiqueta "Hot-spot score MCDA total" |

---

## 10. Tratamiento de parroquias sin dato / creadas por CONALI

### 10.1. Cuatro buckets de estado por parroquia

Un pilar metodológico del visor es distinguir **sin dato ≠ valor bajo real**. El HotSpotLayer clasifica cada parroquia en uno de cuatro buckets:

| Bucket | Condición | Representación visual | Participación en KDE |
|---|---|---|---|
| **Observada** | `pob > 0 ∧ casos > 0` | Color Turbo según z-score | Alimenta splat + mask |
| **Interpolada** | `pob > 0 ∧ casos = 0` | Color Turbo según IDW vecinos | Sólo mask (no splat) |
| **Sin dato** | `pob = 0` | Gris `#e2e8f0` + borde dashed `#94a3b8` | Excluida completamente (estándar OMS/CDC) |
| **FueraProv** | Fuera del `provFilter` | opacity 0 | Excluida |

### 10.2. Por qué el caso "interpolada" existe

Una parroquia con `casos=0` pero `pob>0` es **epidemiológicamente ambigua**:

1. **Cero real**: no se reportaron egresos/defunciones por esa causa en esa parroquia ese año. Legítimo en parroquias pequeñas.
2. **Parroquia post-CONALI**: creada por decreto entre 2015 y 2025; la cartografía CONALI 2025 incluye polígonos que no existían administrativamente en 2013-2023. El cero no es señal, es ausencia estructural del reporte.
3. **Sub-reporte**: error de captura o ruptura del sistema RDACAA local.

Pintar estos casos como "frío (cero)" en Turbo daría una señal engañosa de "zona segura" cuando en realidad no tenemos información. La solución: **interpolación espacial IDW** desde las vecinas observadas.

### 10.3. Inverse Distance Weighting (IDW) — algoritmo

```
w_i = 1 / ||x_target − x_i||_2^p          (p = 2, estándar GIS)

v_target = Σ w_i · v_i / Σ w_i            (sólo top-k=5 vecinas observadas)
```

Con parámetros canónicos:

```javascript
const IDW_K     = 5       // nº de vecinos más cercanos
const IDW_POWER = 2       // exponente estándar GIS
const IDW_EPS   = 1e-9    // evita división por cero si d=0
```

El exponente `p=2` es el valor clásico de Shepard (1968); `k=5` balancea suavidad y fidelidad local (k=1 sería nearest-neighbor discreto, k→N sería media global).

### 10.4. Interacción KDE vs IDW — división de responsabilidades

| Componente | Responsabilidad | Visualización |
|---|---|---|
| **KDE gaussiano (σ=20 px)** | Pintar la superficie continua de colores sobre el mask | Superficie Turbo |
| **IDW (k=5, p=2)** | Producir un valor numérico discreto por-parroquia para el tooltip | Tooltip "Interpolado (IDW k=5)" en índigo `#6366f1` |

Esta separación es estadísticamente más defendible que "leer el pixel del centroide" — el valor numérico resultante es el **promedio ponderado de las 5 vecinas más cercanas con dato**, lo cual es interpretable y auditable. El color del polígono interpolado sigue siendo el del KDE (consistente con las vecinas), pero el tooltip distingue claramente "observado" vs "interpolado".

### 10.5. Renderización visual — `sinDato` gris dashed

Parroquias con `pob = 0` (zonas sin censo CPV 2022 por ser Área Pueblos Indígenas aislados: Shuar Pastaza, Sevilla Don Bosco, Sinaí-Cuchaentza, etc.) se renderizan con:

- **Fill**: `#e2e8f0` (gris claro).
- **Stroke**: `#94a3b8` dashed 2-2 px.
- **Tooltip**: "Sin datos" (no un valor numérico que engañe).

Este estándar coincide con OMS Global Health Atlas, CDC Wonder y Eurostat para "insufficient data". Las parroquias sinDato **se cuentan aparte** en el JSON (no se borran del dataset); aparecen en los conteos de `calidad.n_parroquias_sinDato`.

---

## 11. Limitaciones, sesgos y consideraciones éticas

### 11.1. Ruptura metodológica defunciones 2015+ (`parr_fall ≠ parr_res`)

Desde 2015 el INEC suspendió la captura de `cant_res`/`parr_res` en el formulario EDG — 86,96 % de los registros post-2015 traen solo provincia de residencia. El pipeline usa `parr_fall` (lugar de fallecimiento) como fallback, documentado en `_meta.def_geo_nota`. Esto induce un sesgo estructural hacia parroquias con hospitales de alta complejidad (cabeceras cantonales urbanas) que concentran muertes de pacientes referidos desde parroquias rurales.

**Mitigación futura**: en Fase 6 se podría calibrar la distorsión mediante la razón `parr_res / parr_fall` observada en 2013-2014 (donde ambas columnas existen completas).

### 11.2. CPV 2022 como punto fijo de anclaje

Aunque el método log-share (§5) mitiga el sesgo inter-anual, sigue siendo una interpolación entre **dos** puntos censales. Cambios reales de dinámica poblacional entre 2010 y 2022 (migración Venezuela 2018-2020, retorno por COVID 2020-2021) se suavizan artificialmente. Las proyecciones cantonales INEC Rev. 2024 también tienen su propio error (± 3-5 % a nivel cantonal según INEC-CEPAL 2024).

### 11.3. MGWR es SIMULADO, no real

Los betas de `mgwr_betas.json` y los determinantes de `determinantes_parroquial.json` **NO** son resultados de una regresión real sobre datos observados — son estructuras plausibles generadas con literatura + semilla fija, como **preview** del Proyecto F-I+D+i-075. Esto está declarado explícitamente en `_meta` de cada JSON y en el propio docstring de los scripts. El visor NO debe usarse para conclusiones causales sobre determinantes hasta que el proyecto ESPE emita los betas reales.

### 11.4. Datos individuales anonimizados — agregación ≥ 5

Los microdatos INEC (EGH y EDG) son **anonimizados** por diseño (sin identificadores personales). No obstante, para evitar re-identificación indirecta por estratos finos (parroquia × año × grupo × sexo × etnia × edad exacta), **todos los outputs del visor reportan agregados** y los conteos por parroquia-año-grupo se preservan aun cuando son pequeños, pero sin estratificación demográfica fina al nivel parroquial.

### 11.5. Respiratorio Morales incluye J00-J99 (agudas + NCD)

El grupo "Respiratorio" del esquema Morales primario incluye neumonías agudas (J18), influenza (J10-J11) y otras infecciosas agudas que **OMS NO clasifica como NCD** (la definición estricta es J30-J99 excluyendo J69/J96/J97/J99). El delta es ~640 000 egresos 2013-2024.

**Mitigación**: el pipeline emite los tres esquemas en paralelo (`grupo_morales`, `grupo_ncd`, `grupo_chronic`) en el parquet limpio para permitir re-análisis sin re-procesar los 13,5 M registros. El JSON del visor usa `morales` por defecto (comparabilidad con el estudio de referencia), pero los datasets de auditoría `intermediate/auditoria/ent_parroquial_ncd.json` y `_chronic.json` permiten la validación cruzada.

### 11.6. Política "aggregate" oculta 4,7 M egresos huérfanos en la cabecera cantonal

La política `ORPHAN_POLICY='aggregate'` agrupa todas las parroquias urbanas no presentes en CONALI 2025 en la cabecera cantonal (ej. Tarqui 498 K + Urdesa 315 K + Ximena 232 K + … → cabecera Guayaquil `090150`). Esto **sobre-estima** sistemáticamente la carga de la cabecera y sub-estima la granularidad urbana intra-cantonal.

**Mitigación**: el JSON preserva `aggregated_from: [...]` para trazabilidad; el campo `match_level` distingue `parroquia` de `cantón_agregado`. Análisis intra-urbanos deberían usar otra cartografía (Manzanas Censales INEC).

### 11.7. Consideraciones éticas — tomadores de decisión

El visor es una **herramienta de priorización**, no una decisión por sí misma. Los rankings MCDA + las tendencias MK no sustituyen el juicio experto del equipo zonal, el contexto histórico-cultural de cada territorio ni la consulta con las autoridades locales. El mapa puede inducir falsos positivos (parroquias que aparecen como "hot-spot" por agregación forzada o por ruido 2024 post-CSV) y debe ser interpretado en conjunto con el reporte de calidad (`_meta.calidad`).

---

## 12. Reproducibilidad y trazabilidad

### 12.1. Versionado del stack Python

```
pandas        ≥ 2.0
pyreadstat    ≥ 1.2    ← lectura de .sav
scipy         ≥ 1.10   ← kendalltau, theilslopes
statsmodels   ≥ 0.14   ← fdrcorrection, Ljung-Box
matplotlib    ≥ 3.7    ← gráficas PNG inline
jinja2        ≥ 3.1    ← templating HTML
pyarrow       ≥ 14     ← parquet cache
geopandas     ≥ 0.14   ← shapefile y centroides
pyogrio       ≥ 0.7    ← lectura vectorial rápida
numpy         ≥ 1.24
```

Archivo: `scripts/ent_pipeline/requirements.txt`.

### 12.2. Scripts numerados y cache

| Script | Propósito | Input | Output | Duración |
|---|---|---|---|---|
| `01_profile.py` | HTML de calidad | `.sav` + `.csv` | 2 HTMLs + 2 parquets | ~45 min (lectura `.sav`) |
| `02_clean.py` | Limpieza + 3 esquemas | parquets all | `{egr,def}_clean.parquet` + `exclusion_log.json` | ~2 min |
| `03_rates.py` | Tasas parroquiales | clean parquets + pob | `ent_parroquial.json` (2,1 MB) | ~30 s |
| `04_trends.py` | MK + Sen + FDR | `ent_parroquial.json` | `tendencias_parroquial.json` (16,6 MB) | ~3 min |
| `05_export_visor.py` | Merge final | rates + tendencias | `ent_parroquial.json` enriquecido (8,49 MB) + backup legacy | ~10 s |
| `population/build_pob_2010.py` | Denominador histórico CPV 2010 | `CPV2010_personas.csv` (3,66 GB) | `pob_parroquial_2010.json` | ~12 min |

Corrida end-to-end completa desde `.sav` crudos: ~55-60 minutos. Corrida rápida desde parquets cacheados: ~5 minutos.

### 12.3. Hashes SHA256 de inputs

Cada `.sav` y `.csv` fuente se identifica por su hash SHA256, guardado en `_meta.hash_inputs` del JSON final. Esto permite detectar si una re-corrida fue hecha contra datos modificados.

Ejemplo (recorte del `_meta`):

```json
"hash_inputs": {
  "egresos_hospitalarios_2013.sav": "sha256:3a8f9c2e...",
  "egresos_hospitalarios_2024.csv": "sha256:b7d1f4a9...",
  "EDG_2013.sav": "sha256:92c0e71a...",
  ...
}
```

### 12.4. Versionado git

- `main` branch con commits atómicos por fase: `9d82cf9` (Fase 0-1), `8a447a5` (Fase 2), `cb92e83` (Fase 3), Fase 4-5 del 2026-04-22.
- Los binarios (`.sav`, `.csv` de 2.3 GB, parquets, JSONs > 5 MB) NO se commitean — están en OneDrive local.
- `.gitignore` excluye `inputs/{egresos,defunciones,poblacion}/raw/`, `intermediate/*.parquet`, `intermediate/*_all.parquet`.

### 12.5. Outputs cacheados — tabla de existencia

| Archivo | Ubicación | Regenerable desde |
|---|---|---|
| `egresos_all.parquet` | `intermediate/` | Fase 1 sobre `.sav + .csv` |
| `defunciones_all.parquet` | `intermediate/` | Fase 1 sobre `.sav + .csv` |
| `egresos_clean.parquet` | `intermediate/` | Fase 2 sobre `egresos_all.parquet` |
| `defunciones_clean.parquet` | `intermediate/` | Fase 2 sobre `defunciones_all.parquet` |
| `ent_parroquial.json` (Fase 3) | `intermediate/` | Fase 3 sobre `clean.parquet` + pob |
| `tendencias_parroquial.json` | `intermediate/` | Fase 4 sobre `ent_parroquial.json` |
| `ent_parroquial.json` (Fase 5 merge) | `intermediate/`, `webapp/assets/`, `webapp-react/public/assets/` | Fase 5 merge de los dos anteriores |
| `pob_parroquial_2010.json` | `intermediate/` | `build_pob_2010.py` sobre CPV 2010 CSV |
| `determinantes_parroquial.json` | `webapp/assets/` | `simular_determinantes.py` (simulación) |
| `mgwr_betas.json` | `webapp/assets/` | `calcular_mgwr_simulado.py` (simulación) |
| `priorizacion_mcda.json` | `webapp/assets/` | `calcular_mcda_prioridad.py` sobre `ent_parroquial.json` |

### 12.6. Visor React — JSON drop-in sin lógica estadística cliente

A partir de Fase 5, el visor React NO hace MK/Sen/FDR en el cliente:

- `lookupTrend()` es lectura O(1) del JSON.
- `computeTrend()` queda deprecated (fallback sólo para `ENT='todas'`).
- Tasas se calculan en cliente vía `generateData()` (`rates.js`) — simple división `casos/pob*100k`.
- Quintiles para la coropleta se calculan en cliente vía `computeQuintiles()` sobre la distribución anual.

El frontend (`webapp-react/`) compila con Vite 5.4:
- `npm run build` → 5,84 s, 759 KB minified, 220 KB gzip.
- Sin warnings relevantes.

### 12.7. Validación end-to-end

| Paso | Test | Status |
|---|---|---|
| Fase 0 | `ls inputs/egresos/raw/` = 12 archivos | ✅ |
| Fase 1 | HTMLs legibles; totales coinciden con metadatos INEC | ✅ |
| Fase 2 | 11/12 métricas del plan dentro de ±0,3 %; 1 DIF explicable | ✅ |
| Fase 3 | 0,00 % delta vs legacy en 5 grupos Morales, 2,59 M casos | ✅ EXACT |
| Fase 4 | 118/118 causas (100 %) con match τ 4-dec y dirección vs Morales | ✅ |
| Fase 5 | `npm run build` pasa; JSON sirvable; `lookupTrend` 3 niveles OK | ✅ |
| Smoke test visor | 6 rutas HTTP 200; parseo JSON 1 056 parroquias + 26 provincias agg | ✅ |

---

## 13. Referencias

### Literatura epidemiológica

- **Morales LM, et al. (2017-2023)**. Análisis de tendencias de Enfermedades No Transmisibles en Ecuador 2017-2023. Método `Kendall::MannKendall()` + agrupación en 5 grupos CIE-10 amplios. Código R: `ENT_ART/codigo/codigo_limpio/metodos.R` (funciones `contar_causas_eg` y `contar_causas_def`); `ENT_ART/codigo/codigo_new/Grupos_ent.R` líneas 47-52.
- **OMS (2023)**. *Global status report on noncommunicable diseases 2023*. Definición operativa de NCD: J30-J99 (excl. J69/J96/J97/J99), I00-I99, C00-D48 (excl. D64.9), E10-E14 + N00-N29, K70-K77 + K25-K31.
- **GBD Ecuador 2019-2023**. Institute for Health Metrics and Evaluation (IHME). Carga de enfermedad: letalidad, AVAD, costo por ENT.
- **OPS (2022)**. Panorama regional ENT en América Latina. Costos promedio por egreso hospitalario.
- **MSP Ecuador (2023)**. Registro Nacional de Egresos Hospitalarios — letalidad por grupo diagnóstico.

### Fuentes INEC

- **INEC (2024)**. Registro Estadístico de Egresos Hospitalarios (RDACAA). Metadatos 2024.
- **INEC (2024)**. Estadística de Defunciones Generales (EDG). Metadatos 2024.
- **INEC (2010)**. Censo de Población y Vivienda 2010 — microdato de personas (P13 = DPA6 de residencia habitual).
- **INEC (2022)**. Censo de Población y Vivienda 2022 — densidad poblacional a nivel parroquial.
- **INEC-CEPAL (2024)**. Proyecciones de la población ecuatoriana por cantones y provincias, 2010-2035, Revisión 2024.

### Métodos estadísticos

- **Mann HB (1945)**. Non-parametric tests against trend. *Econometrica* 13:245-259.
- **Kendall MG (1938)**. A New Measure of Rank Correlation. *Biometrika* 30:81-93. Implementación `scipy.stats.kendalltau(variant='b')`.
- **Theil H (1950)**. A rank-invariant method of linear and polynomial regression analysis. *Nederl. Akad. Wetensch., Proc.* 53:386-392, 521-525, 1397-1412.
- **Sen PK (1968)**. Estimates of the Regression Coefficient Based on Kendall's Tau. *J. Am. Statist. Assoc.* 63:1379-1389. Implementación `scipy.stats.theilslopes`.
- **Benjamini Y, Hochberg Y (1995)**. Controlling the false discovery rate: a practical and powerful approach to multiple testing. *J. R. Statist. Soc. B* 57(1):289-300. Implementación `statsmodels.stats.multitest.fdrcorrection`.
- **Ljung GM, Box GEP (1978)**. On a measure of lack of fit in time series models. *Biometrika* 65(2):297-303. Implementación `statsmodels.stats.diagnostic.acorr_ljungbox`.

### Métodos geoespaciales

- **Shepard D (1968)**. A two-dimensional interpolation function for irregularly-spaced data. *Proceedings of the 1968 ACM National Conference*, 517-524. Inverse Distance Weighting.
- **Silverman BW (1986)**. *Density Estimation for Statistics and Data Analysis*. Chapman and Hall. Kernel Density Estimation.
- **Oshan TM, Li Z, Kang W, Wolf LJ, Fotheringham AS (2020)**. MGWR: A Python Implementation of Multiscale Geographically Weighted Regression. *ISPRS Int. J. Geo-Inf.* 8(6):269.
- **Mikhailov A (2019)**. *Turbo, An Improved Rainbow Colormap for Visualization*. Google AI Blog (https://ai.googleblog.com/2019/08/turbo-improved-rainbow-colormap-for.html).

### Priorización y evaluación de tecnologías

- **Marsh K, et al. / ISPOR MCDA Emerging Good Practices Task Force (2016)**. Multiple Criteria Decision Analysis for Health Care Decision Making — An Introduction. *Value in Health* 19(1):1-13.
- **Baltussen R, Niessen L (2006)**. Priority setting of health interventions: the need for multi-criteria decision analysis. *Cost Eff Resour Alloc* 4:14.

### Estudios nacionales referenciales

- **ENSANUT-ECU (2018)**. Encuesta Nacional de Salud y Nutrición del Ecuador. MSP + INEC. Prevalencias de obesidad, tabaquismo, sedentarismo.
- **STEPS-OMS (2018)**. Encuesta de vigilancia de factores de riesgo de ENT, Ecuador.
- **Lancet Planetary Health (2022)**. PM2.5 exposure-response para enfermedad respiratoria crónica, base de los betas β(pm25, respiratorio).
- **Lancet Diabetes & Endocrinology (2020)**. Obesidad-DM2 elasticidad β(obesidad, metabólica).

### Cartografía

- **CONALI (2025)**. Consejo Nacional de Límites Internos — Cartografía oficial parroquial Ecuador 2025. 1 050 features GeoJSON (parroquias rurales + cabeceras cantonales agregadas).

---

*Fin del documento. Versión 1.0 — 2026-04-22. Autor: Alexis Núñez · EpiSIG · INSPI Ecuador.*
