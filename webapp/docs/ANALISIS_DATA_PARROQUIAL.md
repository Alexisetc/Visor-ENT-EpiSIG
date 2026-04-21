# Análisis técnico — Anclar el Visor ENT a data real parroquial

**Autor:** EpiSIG / A. Núñez · **Fecha:** 2026-04-21
**Objetivo:** Reemplazar `generateData()` pseudo-aleatorio del `Visualizador ENT.html` por
datos reales de egresos hospitalarios parroquiales 2013–2023, procesados desde el microdato
SPSS RDACAA del respaldo `ENT_ART` de Leonel Morales.

---

## 1. Hallazgo clave

El xlsx consolidado (`CONSOLIDADO_20241227_AN.xlsx`) agrega a nivel **provincia** — por eso
en la ronda anterior se concluyó que no había parroquial.

Sin embargo, el **microdato SPSS** (`datos_originales/alexis_egr/egresos_hospitalarios_YYYY.sav`,
11 archivos, ~2.5 GB total) **sí trae residencia a nivel parroquia** en su forma cruda RDACAA.

Columnas relevantes comprobadas (2023, 1 170 813 filas):

| Columna      | Descripción                                | Ejemplo   |
|--------------|--------------------------------------------|-----------|
| `prov_res`   | Provincia residencia (DPA 2 díg.)          | `09`      |
| `cant_res`   | Cantón residencia (DPA 4 díg.)             | `0901`    |
| `parr_res`   | **Parroquia residencia (DPA 6 díg.)**      | `090112`  |
| `causa3`     | CIE-10 a 3 caracteres                      | `E11`     |
| `cau_cie10`  | CIE-10 a 4 dígitos                         | `E119`    |
| `anio_egr`   | Año de egreso                              | `2023`    |
| `sexo`       | 1=H, 2=M                                   | `2`       |
| `edad`       | Edad en años                               | `64`      |
| `dia_estad`  | Días de estada                             | `4`       |
| `con_egrpa`  | Condición del egreso (1=alta, 2=fallecido) | `1`       |
| `etnia`      | Etnia                                      | `6`       |

La clave `parr_res` (6 dígitos) **coincide exactamente** con el campo `DPA_PARROQ` del
GeoJSON `parroquias_otp_simpl.geojson` del repo → join directo, sin mapeo intermedio.

### 1.1 Validación de focos

Top-5 parroquias con más egresos por Diabetes tipo 2 en 2023:

| DPA      | Nombre (corresponde)        | Egresos |
|----------|-----------------------------|---------|
| 090112   | Ximena (Guayaquil)          | 695     |
| 090150   | Tarqui (Guayaquil)          | 429     |
| 090114   | Febres Cordero (Guayaquil)  | 379     |
| 060101   | Riobamba urbana             | 214     |
| 170150   | Calderón (Quito)            | 194     |

El visor actual ya hace `base *= 1.4` sobre "Tarqui" y "Ximena" en `generateData()` —
esos focos son **reales**, los tenías correctos intuitivamente.

---

## 2. Arquitectura objetivo

```
┌────────────────────────┐     ┌──────────────────────────┐     ┌──────────────────────┐
│ SPSS .sav 2013-2023    │ ──▶ │  procesar_microdato.py   │ ──▶ │ ent_parroquial.json  │
│ (microdato RDACAA,     │     │  (pyreadstat + pandas)   │     │ (compacto, ~1-3 MB)  │
│  ~2.5 GB, NAS)         │     │  filtra CIE-10 + agrega  │     └──────────┬───────────┘
└────────────────────────┘     │  por parr × año × sexo   │                │
                               └──────────────────────────┘                │
                                                                           ▼
┌────────────────────────┐     ┌──────────────────────────┐     ┌──────────────────────┐
│ Censo INEC 2022        │ ──▶ │ poblacion_parroquial.py  │ ──▶ │ pob_parroquial.json  │
│ (REDATAM, ~1024 parr.) │     │ (extrae por DPA + sexo)  │     │ (claves DPA 6 díg.)  │
└────────────────────────┘     └──────────────────────────┘     └──────────┬───────────┘
                                                                           │
                                                                           ▼
                               ┌──────────────────────────────────────────────────────┐
                               │  Visualizador ENT.html  (Leaflet + Plotly)           │
                               │  · getParroquiaKey(props) → DPA_PARROQ (ya existe)   │
                               │  · generateData() reemplazado por lookup en JSON     │
                               │  · Hot spots reales con LISA/Moran pre-calculado     │
                               └──────────────────────────────────────────────────────┘
```

---

## 3. Pipeline de procesamiento (script 1: `procesar_microdato_egresos.py`)

### 3.1 Lectura en chunks
`pyreadstat.read_sav_in_chunks(chunksize=100_000)` — evita cargar 200 MB en RAM por archivo.

### 3.2 Selección de columnas mínimas
```python
COLS = ["anio_egr","parr_res","cant_res","prov_res",
        "causa3","cau_cie10","sexo","edad","dia_estad","con_egrpa"]
```
Reduce de 36 a 10 columnas → lectura ~5× más rápida.

### 3.3 Diccionario ENT → CIE-10

Definido según GBD 2021 / PAHO ENLACE:

| ID          | Nombre                         | CIE-10 (causa3)           |
|-------------|--------------------------------|---------------------------|
| `dm2`       | Diabetes tipo 2                | `E11`, `E14`              |
| `dm1`       | Diabetes tipo 1                | `E10`                     |
| `hta`       | Hipertensión                   | `I10`–`I15`               |
| `iam`       | Infarto agudo miocardio        | `I21`, `I22`              |
| `ecv`       | Enf. cerebrovascular           | `I60`–`I69`               |
| `erc`       | Enf. renal crónica             | `N18`                     |
| `obesidad`  | Obesidad                       | `E66`                     |
| `ca_mama`   | Cáncer de mama                 | `C50`                     |
| `ca_est`    | Cáncer de estómago             | `C16`                     |
| `ca_prost`  | Cáncer de próstata             | `C61`                     |
| `depresion` | Depresión                      | `F32`, `F33`              |
| `epoc`      | EPOC                           | `J44`                     |

### 3.4 Agregación
```python
df.groupby(["anio_egr","parr_res","ent_id","sexo"])
  .agg(casos=("parr_res","size"),
       dias_estada=("dia_estad","sum"),
       muertes=("con_egrpa", lambda s: (s==2).sum()))
  .reset_index()
```

### 3.5 Output JSON

Estructura compacta (arrays en lugar de dicts anidados, minimiza tamaño):

```json
{
  "anios": [2013, 2014, ..., 2023],
  "ents":  ["dm2","hta","iam", "..."],
  "parroquias": {
    "090112": {"nombre":"Ximena","cant":"Guayaquil","prov":"Guayas",
               "pob_2022": 412300,
               "data": {
                 "dm2": [[10,585,620,635,649,680,695], [4,5,6,...]],   // [casos, muertes] por año
                 "hta": [...]
               }}
  }
}
```
Estimación tamaño: ~1–3 MB gzipped. Fetcheable en 1 request.

### 3.6 Tiempo estimado
- Una sola corrida completa (2013–2023): **~4 min** en esta máquina (24 s × 11 años).
- Resultado cacheado como `ent_parroquial.json` — solo se re-genera cuando llegue data nueva.

---

## 4. Población parroquial (gap crítico)

Para tasa × 100 000 hab necesitamos población **por parroquia** (el xlsx del proyecto solo tiene
provincia). Fuentes viables:

### 4.1 Fuente primaria: Censo INEC 2022 (RECOMENDADA)
- URL: https://www.ecuadorencifras.gob.ec/censo-de-poblacion-y-vivienda-2022/
- Formato: tablas por parroquia (DPA 6 díg.) en XLSX o REDATAM.
- Script: `poblacion_parroquial.py` descarga, filtra DPA, sexo, grupos etarios y produce
  `pob_parroquial.json` con ~1024 entradas.

### 4.2 Fallback: Proyecciones INEC 2020 (ya circula en scripts R)
- Archivo `poblacion_provincias_ecuador_2022.xlsx` ya está en el proyecto pero es provincial.
- INEC también publicó **proyecciones parroquiales 2010–2020** (DPA 2010, compatible).

### 4.3 Si aún así no se consigue rápido
Distribuir población provincial entre parroquias por peso de:
- Viviendas del shapefile CONALI (campo agregable si existe).
- Área × densidad estimada (urbana/rural por tipo del OTP).
- Documentar explícitamente como "población parroquial estimada".

---

## 5. Integración con el visor (cambios a `Visualizador ENT.html`)

### 5.1 Reemplazar `generateData()`

Actualmente (línea ~448):
```js
function generateData(geoKey, disease, year) {
  // pseudo-aleatorio con multiplicadores hardcoded
  const bases = { cardio: 220, diabetes: 150, cancer: 110, resp: 80 };
  ...
}
```

Nuevo:
```js
let ENT_DATA = null;
let POB_DATA = null;

// boot
Promise.all([
  fetch('assets/ent_parroquial.json').then(r=>r.json()),
  fetch('assets/pob_parroquial.json').then(r=>r.json())
]).then(([e,p])=>{ENT_DATA=e; POB_DATA=p; renderMap();});

function generateData(geoKey, disease, year) {
  const p = ENT_DATA?.parroquias?.[geoKey];
  const y = ENT_DATA?.anios?.indexOf(year);
  if (!p || y < 0) return {rate: 0, tabaco: 0, fisica: 0, obesidad: 0, pm25: 0, casos: 0};
  const serie = p.data[disease] || [[]];
  const casos = serie[0][y] || 0;
  const pob = POB_DATA[geoKey]?.total || 1;
  const rate = casos / pob * 100000;
  // Determinantes se llenarán en fase 2 (overlay de capas reales).
  return {rate: +rate.toFixed(1), casos, ...};
}
```

### 5.2 Corte de año
El visor actual ya tiene slider de año. Se mantiene igual, solo que ahora el lookup es real.

### 5.3 Cobertura incompleta
Si una parroquia no aparece en ENT_DATA para ese año (ej. 0 egresos), pintar en gris claro
con tooltip "Sin egresos registrados".

---

## 6. Hot spots **reales** (no pseudo-random)

Reemplazar la intensidad heurística actual por **análisis de autocorrelación espacial**:

- **Local Moran's I (LISA)** vía `pysal/esda` — identifica parroquias HH (alto rodeado de alto)
  y HL (alto rodeado de bajo = outlier).
- Matriz de vecindades Queen sobre el GeoJSON parroquial.
- Pre-calcular LISA por ENT × año en Python, guardar flag `lisa_cluster` en el JSON.
- En el visor: capa `leaflet.heat` usa solo las parroquias con LISA significativo (p<0.05);
  el resto no aparece como "punto caliente". **Hot spot = cluster estadísticamente
  significativo**, no "parroquia con tasa alta".

Referencia: Anselin (1995), usado en PAHO ENLACE y IHME GBD Compare.

---

## 7. Estructura de entregables propuesta

Commitear al repo:

```
Presentaci-n-EpiSIG/
├── docs/
│   └── ANALISIS_DATA_PARROQUIAL.md          ← este documento
├── scripts/
│   ├── build_parroquias_geojson.py          ← ya existe
│   ├── procesar_microdato_egresos.py        ← NUEVO (SPSS → JSON)
│   ├── descargar_poblacion_parroquial.py    ← NUEVO (INEC → JSON)
│   └── calcular_lisa_hotspots.py            ← NUEVO (pysal)
├── assets/
│   ├── parroquias_otp_simpl.geojson         ← ya existe (6 MB)
│   ├── ent_parroquial.json                  ← NUEVO (~2 MB)
│   ├── pob_parroquial.json                  ← NUEVO (~200 KB)
│   └── lisa_hotspots.json                   ← NUEVO (~500 KB)
└── Visualizador ENT.html                    ← parchar generateData()
```

---

## 8. Plan de ejecución sugerido (orden)

| # | Tarea                                                            | Tiempo | Bloquea a |
|---|------------------------------------------------------------------|--------|-----------|
| 1 | Copiar 11 .sav del NAS a disco local (para no depender de red)   | 10 min | 2         |
| 2 | Escribir `procesar_microdato_egresos.py` + generar JSON          | 45 min | 5         |
| 3 | Descargar población parroquial INEC 2022 + JSON                  | 30 min | 5         |
| 4 | Escribir `calcular_lisa_hotspots.py` (pysal)                     | 40 min | 5         |
| 5 | Parchar `Visualizador ENT.html` → lookup real + LISA             | 30 min | —         |
| 6 | QA: verificar conteos nacionales = consolidado (validación)      | 20 min | —         |
| 7 | Commit + push                                                    | 5 min  | —         |

Total estimado: **~3 horas** de trabajo efectivo.

---

## 9. Fallback si no llegamos a (1–6): **Simulación creíble**

Si hay que defender el visor antes de tener los .sav procesados, la simulación debe:

1. **Respetar los totales nacionales reales** por ENT × año (los del xlsx consolidado,
   hoja `BDENFERMEDAD`, ya cargados y verificados).
2. **Respetar la distribución provincial real** (hoja `provincia`).
3. **Dentro de cada provincia**, repartir entre cantones proporcional a población INEC 2022
   (si sólo tenemos provincia, usar datos de proyección cantonal INEC).
4. **Dentro de cada cantón**, repartir entre parroquias con:
   - Peso de población parroquial (INEC 2022).
   - Factor urbano/rural (OTP CONALI tiene el campo `area_res` 1=urbana / 2=rural).
   - Factor de vulnerabilidad (NBI por parroquia, si se consigue).
5. **Jitter gaussiano σ=0.10** a nivel parroquial, para que no se vea "perfectamente
   proporcional".
6. **Check de consistencia**: suma de casos por parroquia == total nacional real ± 1%.

Ventaja: los totales provinciales y nacionales son **reales**; lo único inferido es el
refinamiento intra-cantonal, claramente etiquetado como "estimación modelada" en la UI.

---

## 10. Decisiones por resolver (para tu validación)

1. **¿Procesamos los 11 años (2013–2023) o solo 2017–2023?** La recomendación es 2017–2023
   para alinear con la serie del consolidado y evitar años con calidad de codificación distinta.
2. **Código DPA**: el shapefile OTP CONALI tiene fecha `DPA_ANIO`; hay revisiones 2010, 2014,
   2021. ¿Cuál usa el microdato? Hay que verificar — si no coinciden, ~5% de parroquias
   pueden quedar sin join.
3. **Desagregación por sexo**: ¿la queremos en el JSON final? Suma doble el tamaño pero permite
   selector M/F en el visor.
4. **Etnia**: igual, puede ser un segundo paso.

---

## 11. Referencias

- PAHO ENLACE — Burden of NCDs: https://www.paho.org/en/enlace/burden-noncommunicable-diseases
- NCD Portal: https://ncdportal.org/
- IHME GBD Compare: https://vizhub.healthdata.org/gbd-compare/
- Anselin, L. (1995). Local Indicators of Spatial Association — LISA. *Geographical Analysis*.
- INEC (2022). Censo de Población y Vivienda 2022. Base REDATAM.
- GBD 2021 Diseases and Injuries Collaborators. *The Lancet* 403 (2024).
