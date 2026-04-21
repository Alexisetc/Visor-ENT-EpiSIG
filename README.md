# Visor ENT EpiSIG

Visor parroquial de Enfermedades No Transmisibles (ENT) para INSPI, basado en
egresos hospitalarios INEC/MSP 2013-2023 (microdato Leonel Morales) +
simulaciones estructuradas (determinantes, MCDA, MGWR) que sirven de *preview*
a dos proyectos INSPI 2026-2028 (F-I+D+i-075).

## Estructura

```
Visor ENT EpiSIG/
├── scripts/                   Python — pipeline de generación
│   ├── procesar_microdato_egresos.py    SPSS .sav → ent_parroquial.json
│   ├── generar_pob_parroquial.py        CPV 2022 → pob_parroquial.json
│   ├── generar_provincias_geojson.py    SHP INEC → provincias_otp.geojson
│   ├── simular_determinantes.py         simul. ENSANUT/STEPS/GBD → determinantes_parroquial.json
│   ├── calcular_mcda_prioridad.py       MCDA suma ponderada → priorizacion_mcda.json
│   └── calcular_mgwr_simulado.py        β locales kernel gaussiano → mgwr_betas.json
├── inputs/                    data cruda (no se edita)
│   ├── CONSOLIDADO_egresos.xlsx                  microdato L. Morales
│   ├── 2022_CPV_NACIONAL_DENSIDAD_POBLACIONAL.xlsx  población INEC
│   └── shapefiles/
│       ├── CENTROIDES_PARROQUIAS/      1049 puntos parroquiales (CONALI)
│       └── ORGANIZACION_TERRITORIAL_PROVINCIAL/  24 polígonos (INEC)
├── intermediate/              JSON intermedios (se regeneran)
│   ├── ent_parroquial.json    casos × parroquia × año × grupo CIE-10
│   └── pob_parroquial.json    población 2022 × parroquia
└── webapp/                    lo que sirve `python -m http.server`
    ├── Visualizador ENT.html
    ├── assets/
    │   ├── parroquias_otp_simpl.geojson   1050 polígonos
    │   ├── provincias_otp.geojson         24 provincias
    │   ├── determinantes_parroquial.json
    │   ├── priorizacion_mcda.json
    │   └── mgwr_betas.json
    └── docs/
```

## Flujo de regeneración

```bash
cd scripts
python procesar_microdato_egresos.py     # → intermediate/ent_parroquial.json
python generar_pob_parroquial.py         # → intermediate/pob_parroquial.json
python generar_provincias_geojson.py     # → webapp/assets/provincias_otp.geojson
python simular_determinantes.py          # → webapp/assets/determinantes_parroquial.json
python calcular_mcda_prioridad.py        # → webapp/assets/priorizacion_mcda.json
python calcular_mgwr_simulado.py         # → webapp/assets/mgwr_betas.json
```

## Servir el visor

```bash
cd webapp
python -m http.server 8000
# abrir http://localhost:8000/Visualizador%20ENT.html
```

## Metodologías

- **Egresos**: 5 grupos CIE-10 según clasificación Leonel Morales (`Grupos_ent.R`):
  Circulatorio I00-I99, Neoplasia C00-D48, Metabólica E00-E90, Respiratorio J00-J99,
  Nervioso G00-G99.
- **Hot Spots**: KDE Leaflet.heat (paleta YlOrRd 9-stop, radius=8, weight=casos)
  replicando export qgis2web "Hot Spot OVITRAMPAS Pacto 2020".
- **Determinantes (simul.)**: valor base provincial (ENSANUT-ECU 2018, STEPS-OMS,
  GBD 2021, CPV 2022) × factor urbano/rural × ruido gaussiano σ=8%.
- **Priorización MCDA**: suma ponderada (Marsh/ISPOR 2016, Baltussen 2006) con 6
  criterios (mortalidad 0.30, egresos 0.20, AVAD 0.15, tendencia CAGR 0.15, costo
  0.10, equidad 0.10). Parroquias con <10 casos heredan ranking del cantón;
  cantón sin data hereda de provincia.
- **MGWR**: β nacional base × kernel gaussiano anclado en focos reales
  (Quito/Guayaquil/Ambato para PM2.5; Amazonía para pobreza; Costa urbana para
  obesidad). Preview del proyecto INSPI F-I+D+i-075 (Núñez-ESPE 2026-2027).

## Dependencias Python

```bash
pip install pandas geopandas pyogrio numpy pyreadstat openpyxl
```
