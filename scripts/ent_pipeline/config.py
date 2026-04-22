"""Configuración centralizada del pipeline ENT.

Fuente única de verdad para:
  · rutas de inputs/cache/outputs
  · reglas CIE-10 Morales (5 grupos ENT)
  · columnas comunes entre años para concatenación
  · exclusiones geográficas (Galápagos / Sin Provincia / No Especificada)

NO debe contener lógica — solo constantes. Cualquier script del pipeline
importa desde aquí para mantener coherencia entre fases.
"""
from pathlib import Path
import re

# ─── RUTAS ──────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).resolve().parent.parent.parent  # Visor ENT EpiSIG/
INPUTS      = ROOT / "inputs"
INPUT_EGR   = INPUTS / "egresos" / "raw"
INPUT_DEF   = INPUTS / "defunciones" / "raw"
INPUT_POB   = INPUTS / "poblacion"
DICC_EGR    = INPUTS / "egresos" / "diccionarios"
DICC_DEF    = INPUTS / "defunciones" / "diccionarios"

INTERMEDIATE = ROOT / "intermediate"
CACHE_DIR    = INTERMEDIATE  # parquets cacheados + HTMLs de perfilado
INTERMEDIATE.mkdir(parents=True, exist_ok=True)

# ─── AÑOS CUBIERTOS ─────────────────────────────────────────────────────────
YEARS = list(range(2013, 2025))  # 2013 … 2024 (12 años)

# ─── COLUMNAS COMUNES (presentes en TODOS los años 2013-2024) ───────────────
# Derivadas inspeccionando `.sav` 2013 vs 2023 vs CSV 2024 con pyreadstat.
# Otras columnas (etnia, area_res, tipo_seg, dis_pac, etc.) NO se incluyen
# porque aparecen/desaparecen a lo largo del tiempo — se reportan en el
# perfilado como "columnas inconsistentes" (bloque A).
COMMON_EGR_COLS = [
    # DPA de residencia (usado para cruce con GeoJSON parroquial)
    'prov_res', 'cant_res', 'parr_res',
    # demografía básica
    'sexo', 'edad', 'cod_edad',
    # temporalidad
    'anio_egr', 'mes_egr', 'dia_egr', 'fecha_egr',
    'anio_ingr', 'mes_ingr', 'dia_ingr', 'fecha_ingr',
    'dia_estad',
    # condición al egreso y causa
    'con_egrpa',
    'cau_cie10', 'causa3',
    # ubicación del establecimiento (diagnóstica, no residencia)
    'prov_ubi', 'cant_ubi', 'parr_ubi',
    'clase', 'tipo', 'entidad', 'sector',
    'mes_inv',
]

COMMON_DEF_COLS = [
    # DPA de residencia y lugar de fallecimiento
    'prov_res', 'cant_res', 'parr_res',
    'prov_fall', 'cant_fall', 'parr_fall',
    # demografía
    'sexo', 'edad', 'cod_edad',
    'nac_fall', 'cod_pais',
    'est_civil', 'niv_inst',
    # temporalidad
    'anio_nac', 'mes_nac', 'dia_nac', 'fecha_nac',
    'anio_fall', 'mes_fall', 'dia_fall', 'fecha_fall',
    'anio_insc', 'mes_insc', 'dia_insc', 'fecha_insc',
    # causas (causa4 en todos los años; `causa` aparece en algunos)
    'causa4',
    'lugar_ocur', 'sabe_leer',
]

# ─── EXCLUSIONES PROVINCIALES (Morales) ─────────────────────────────────────
# Códigos INEC excluidos por el estudio original. Se reportan aparte en
# el perfilado — la decisión final de excluir queda al revisor del HTML.
PROV_EXCLUIDAS = {'20', '88', '90'}
PROV_EXCLUIDAS_LABEL = {
    '20': 'Galápagos',
    '88': 'Zonas No Delimitadas',
    '90': 'No Especificada / Extranjero',
}

# ─── CLASIFICACIÓN CIE-10 EN 5 GRUPOS ENT ──────────────────────────────────
# Réplica exacta de las reglas del estudio Morales 2017-2023, extraídas de
# `ENT_ART/codigo/codigo_limpio/metodos.R` (funciones contar_causas_eg y
# contar_causas_def).  Las expresiones operan sobre código CIE-10 NORMALIZADO
# a 3 caracteres (prefijo sin decimal, e.g. "I21" de "I21.4").
#
# Se aplican en orden: la primera que matchee gana — excluye luego inclusiones
# duplicadas. Esto es consistente con Morales (no hay superposición esperable).

# Patrones regex sobre el prefijo 3-char. TRES esquemas paralelos, emitidos
# como columnas `grupo_morales`, `grupo_ncd`, `grupo_visor` en el parquet
# limpio de Fase 2. El visor consume `grupo_visor` (= esquema actual del
# frontend); los otros dos permiten auditoría cruzada contra el artículo
# Morales y migración futura a OMS estricto sin re-procesar 13,5 M registros.

ENT_SCHEMES: dict[str, dict[str, dict]] = {

    # ─── Esquema "morales" — réplica de codigo_new/Grupos_ent.R líneas 47-52 ──
    # Es la agrupación de 5 categorías amplias que usa el artículo Morales.
    # Incluye deliberadamente neumonías agudas (J18) y meningitis aguda (G00-G03)
    # que NO son NCDs según OMS — se preserva para comparabilidad literal.
    'morales': {
        'neoplasia': {
            'label': 'Neoplasias',
            'regex_include': re.compile(r'^(C\d{2}|D0\d|D1\d|D2\d|D3\d|D4[0-8])$'),
            'regex_exclude': None,
        },
        'circulatorio': {
            'label': 'Sist. circulatorio',
            'regex_include': re.compile(r'^I\d{2}$'),  # I00-I99
            'regex_exclude': None,
        },
        'metabolicas': {
            'label': 'Metabólicas',
            'regex_include': re.compile(r'^E[0-9]\d$'),  # E00-E99 (Morales limita a E00-E90 pero E91+ no existe en CIE-10)
            'regex_exclude': None,
        },
        'respiratorio': {
            'label': 'Aparato respiratorio',
            'regex_include': re.compile(r'^J\d{2}$'),  # J00-J99 (incluye agudas)
            'regex_exclude': None,
        },
        'nervioso': {
            'label': 'Sist. nervioso',
            'regex_include': re.compile(r'^G\d{2}$'),  # G00-G99
            'regex_exclude': None,
        },
    },

    # ─── Esquema "ncd" — OMS/GBD estricto (sin agudas) ───────────────────────
    # Defendible epidemiológicamente: solo condiciones crónicas reconocidas
    # como NCD por la OMS. Excluye explícitamente neumonías agudas,
    # meningitis, infecciones respiratorias, anemias, etc.
    'ncd': {
        'neoplasia': {
            'label': 'Neoplasias',
            'regex_include': re.compile(r'^(C\d{2}|D0\d|D1\d|D2\d|D3\d|D4[0-8])$'),
            'regex_exclude': re.compile(r'^D649$'),
        },
        'cardio': {
            'label': 'Cardiovasculares',
            'regex_include': re.compile(r'^I\d{2}$'),
            'regex_exclude': None,
        },
        'resp_cron': {
            'label': 'Respiratorias crónicas',
            'regex_include': re.compile(r'^J([3-9]\d)$'),  # J30-J99
            'regex_exclude': re.compile(r'^(J69|J96|J97|J99)$'),
        },
        'diabren_cron': {
            'label': 'Diabetes + renales crónicas',
            'regex_include': re.compile(r'^(E1[0-4]|N0\d|N1\d|N2[0-9])$'),  # E10-E14 + N00-N29
            'regex_exclude': None,
        },
        'digest_cron': {
            'label': 'Digestivas crónicas',
            'regex_include': re.compile(r'^(K2[5-9]|K3[01]|K7[0-7])$'),  # úlcera K25-K31 + hígado K70-K77
            'regex_exclude': None,
        },
    },

    # ─── Esquema "visor" — compatibilidad con frontend React actual ──────────
    # Cero cambios en webapp-react/ ni en el schema de ent_parroquial.json.
    # Es lo que ya consume el visor hoy. Default para Fase 3-5.
    'visor': {
        'neoplasia': {
            'label': 'Neoplasias',
            'regex_include': re.compile(r'^(C\d{2}|D0\d|D1\d|D2\d|D3\d|D4[0-8])$'),
            'regex_exclude': re.compile(r'^D649$'),
        },
        'cardio': {
            'label': 'Cardiovasculares',
            'regex_include': re.compile(r'^I\d{2}$'),
            'regex_exclude': None,
        },
        'resp': {
            'label': 'Respiratorias crónicas',
            'regex_include': re.compile(r'^J([3-9]\d)$'),
            'regex_exclude': re.compile(r'^(J69|J96|J97|J99)$'),
        },
        'diabren': {
            'label': 'Diabetes y renales crónicas',
            'regex_include': re.compile(r'^(E1[0-4]|N0\d|N1[0-8])$'),
            'regex_exclude': None,
        },
        'digest': {
            'label': 'Enfermedades digestivas',
            'regex_include': re.compile(r'^K([0-8]\d|9[0-2])$'),
            'regex_exclude': None,
        },
    },
}

# Retrocompatibilidad: el perfilado (01_profile.py) todavía lee `ENT_GRUPOS`
# y `ENT_KEYS`. Apuntan al esquema 'visor' para no romper nada.
ENT_GRUPOS = ENT_SCHEMES['visor']
ENT_KEYS   = list(ENT_GRUPOS.keys())  # ['neoplasia','cardio','resp','diabren','digest']

# Default para export al visor. Fase 3-5 lo respeta.
DEFAULT_SCHEME = 'visor'


# ─── NORMALIZACIÓN CIE-10 ───────────────────────────────────────────────────
# Quita puntos, mayúsculas, primeros 3 caracteres para clasificar.
# Ejemplo: "I21.4" → "I21" ;  "C50" → "C50" ;  "E11.9" → "E11".
def normalize_cie10(code) -> str:
    if code is None:
        return ''
    s = str(code).strip().upper().replace('.', '').replace(' ', '')
    return s[:3] if len(s) >= 3 else ''

def classify_cie10(code_norm: str, scheme: str = DEFAULT_SCHEME) -> str | None:
    """Devuelve la clave del grupo ENT o None si no encaja.

    scheme ∈ {'morales', 'ncd', 'visor'} — selecciona uno de los tres
    esquemas paralelos definidos en ENT_SCHEMES.
    """
    if not code_norm:
        return None
    grupos = ENT_SCHEMES.get(scheme)
    if grupos is None:
        raise ValueError(f"scheme debe ser uno de {list(ENT_SCHEMES)}, recibí {scheme!r}")
    for key, spec in grupos.items():
        if spec['regex_include'].match(code_norm):
            if spec['regex_exclude'] and spec['regex_exclude'].match(code_norm):
                continue
            return key
    return None


# ─── PARÁMETROS DE FASE 2 (decisiones aprobadas 2026-04-21) ────────────────
# Ver plan `continua-delegated-squid.md` sección 2.4 para justificación.

# Rango anual válido. Descarta datos espurios (defunciones tiene 383 meses
# contaminados 1898-1912 en fecha_fall).
VALID_YEAR_RANGE: tuple[int, int] = (2013, 2024)

# Edad válida para estadística. `edad == 999` es sentinel INEC de "no especif".
MAX_EDAD_VALID: int     = 120
EDAD_SENTINEL_NA: int   = 999

# Años de pandemia — se marcan con `periodo='pandemia'` en el parquet limpio.
# Fase 4 corre Mann-Kendall en dos variantes (con y sin estos años).
PANDEMIC_YEARS: set[int] = {2020, 2021}

# Política de huérfanos urbanos (DPA6 que no matchea GeoJSON).
# 'aggregate' remapea a la cabecera cantonal; 'keep' preserva el código
# original (aparecen sin geo en el visor); 'drop' los elimina.
ORPHAN_POLICY: str = 'aggregate'

# Política para defunciones 2015+ (perdió cant_res/parr_res en 86,96 %).
# 'parr_res_or_fall' usa residencia cuando existe, cae a lugar de fallecimiento;
# 'parr_res_strict' solo residencia (pierde 87 % post-2015);
# 'parr_fall_always' lugar de fallecimiento en todos los años.
DEF_GEO_SOURCE: str = 'parr_res_or_fall'

# Política pandemia. 'flag' agrega columna `periodo` y Fase 4 corre dos
# variantes; 'exclude' filtra los años del dataset clean.
PANDEMIC_POLICY: str = 'flag'

# Provincias excluidas del análisis (réplica Morales 2017-2023).
# 20=Galápagos, 88=Zonas No Delimitadas, 90=No Especificada/Extranjero.
# Ya definido como PROV_EXCLUIDAS más arriba — aquí aliased para consistencia
# con la terminología del plan Fase 2.
EXCLUDE_PROVS: set[str] = set(PROV_EXCLUIDAS)

# ─── METADATA PARA PERFILADO ────────────────────────────────────────────────
# Columnas "críticas" que se analizan en el Bloque B del HTML (missing %, top-5).
CRITICAL_COLS_EGR = [
    'prov_res', 'cant_res', 'parr_res',
    'sexo', 'edad', 'cod_edad',
    'cau_cie10', 'causa3',
    'anio_egr', 'fecha_egr', 'dia_estad', 'con_egrpa',
]
CRITICAL_COLS_DEF = [
    'prov_res', 'cant_res', 'parr_res',
    'prov_fall', 'cant_fall', 'parr_fall',
    'sexo', 'edad', 'cod_edad',
    'causa4',
    'anio_fall', 'fecha_fall',
]

# Grupos etarios (Morales usa implícitamente 0-14, 15-44, 45-64, 65+; expandimos)
AGE_GROUPS = [
    ('<1',    0,   0),
    ('1-4',   1,   4),
    ('5-14',  5,  14),
    ('15-44', 15, 44),
    ('45-64', 45, 64),
    ('65+',   65, 200),
]

# ─── MAPA DPA → NOMBRE DE PROVINCIA (INEC) ──────────────────────────────────
# Los `.sav` pre-2017 y post-2018 tienen labels SPSS distintos (mayúsculas,
# tildes). Mapping canónico por código para reportes uniformes.
PROVINCIAS = {
    '01': 'Azuay',         '02': 'Bolívar',       '03': 'Cañar',
    '04': 'Carchi',        '05': 'Cotopaxi',      '06': 'Chimborazo',
    '07': 'El Oro',        '08': 'Esmeraldas',    '09': 'Guayas',
    '10': 'Imbabura',      '11': 'Loja',          '12': 'Los Ríos',
    '13': 'Manabí',        '14': 'Morona Santiago','15': 'Napo',
    '16': 'Pastaza',       '17': 'Pichincha',     '18': 'Tungurahua',
    '19': 'Zamora Chinchipe','20': 'Galápagos',   '21': 'Sucumbíos',
    '22': 'Orellana',      '23': 'Santo Domingo', '24': 'Santa Elena',
    '88': 'Zonas No Delimitadas', '90': 'No Especificada / Extranjero',
}

def make_parroquia_key(prov=None, cant=None, parr=None) -> str:
    """DPA-6 para cruce con GeoJSON/pob_parroquial.json.

    Particularidad INEC: las columnas son JERÁRQUICAS y completas:
      · prov_res = "17"           (2 dig)
      · cant_res = "1701"         (4 dig — prov+cant)
      · parr_res = "170150"       (6 dig — prov+cant+parr = DPA completo)

    Por eso usamos `parr_res` directamente como DPA-6 si está disponible.
    Si solo hay prov/cant se devuelve la clave truncada (menor granularidad).
    """
    def pad_exact(v, w):
        try:
            return str(int(float(v))).zfill(w)
        except (ValueError, TypeError):
            s = str(v).strip()
            return s.zfill(w) if len(s) < w else s

    if parr is not None and not _is_missing(parr):
        return pad_exact(parr, 6)
    if cant is not None and not _is_missing(cant):
        return pad_exact(cant, 4).ljust(6, '0')
    if prov is not None and not _is_missing(prov):
        return pad_exact(prov, 2).ljust(6, '0')
    return ''


def _is_missing(v) -> bool:
    if v is None:
        return True
    try:
        import math
        return isinstance(v, float) and math.isnan(v)
    except Exception:
        return False
