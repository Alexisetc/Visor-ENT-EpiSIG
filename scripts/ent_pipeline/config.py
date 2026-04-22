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

# Patrones regex sobre el prefijo 3-char. Validados contra el R original.
ENT_GRUPOS = {
    # Neoplasias — C00-C97 + D00-D48 (excepto D64.9 que es anemia aplásica)
    'neoplasia': {
        'label': 'Neoplasias',
        'regex_include': re.compile(r'^(C\d{2}|D0\d|D1\d|D2\d|D3\d|D4[0-8])$'),
        'regex_exclude': re.compile(r'^D649$'),  # anemia — no es neoplasia
    },
    # Cardiovasculares — todo el capítulo I (I00-I99)
    'cardio': {
        'label': 'Cardiovasculares',
        'regex_include': re.compile(r'^I\d{2}$'),
        'regex_exclude': None,
    },
    # Respiratorias crónicas — J30-J98 EXCEPTO J69 (neumonía aspiración),
    # J96 (insuf. respiratoria aguda), J97 (no listado por Morales), J99.
    # Replica R: ^J3[0-9]|^J4[0-9]|^J5[0-9]|^J6[0-8]|^J7[0-9]|^J8[0-9]|^J9[0-58]
    'resp': {
        'label': 'Respiratorias crónicas',
        'regex_include': re.compile(r'^J([3-9]\d)$'),  # J30-J99
        'regex_exclude': re.compile(r'^(J69|J96|J97|J99)$'),
    },
    # Diabetes + renales crónicas — E10-E14 + N00-N18
    'diabren': {
        'label': 'Diabetes y renales crónicas',
        'regex_include': re.compile(r'^(E1[0-4]|N0\d|N1[0-8])$'),
        'regex_exclude': None,
    },
    # Digestivas — K00-K92 (todo el capítulo K sin K93+)
    'digest': {
        'label': 'Enfermedades digestivas',
        'regex_include': re.compile(r'^K([0-8]\d|9[0-2])$'),
        'regex_exclude': None,
    },
}

ENT_KEYS = list(ENT_GRUPOS.keys())  # ['neoplasia','cardio','resp','diabren','digest']

# ─── NORMALIZACIÓN CIE-10 ───────────────────────────────────────────────────
# Quita puntos, mayúsculas, primeros 3 caracteres para clasificar.
# Ejemplo: "I21.4" → "I21" ;  "C50" → "C50" ;  "E11.9" → "E11".
def normalize_cie10(code) -> str:
    if code is None:
        return ''
    s = str(code).strip().upper().replace('.', '').replace(' ', '')
    return s[:3] if len(s) >= 3 else ''

def classify_cie10(code_norm: str) -> str | None:
    """Devuelve la clave del grupo ENT o None si no encaja."""
    if not code_norm:
        return None
    for key, spec in ENT_GRUPOS.items():
        if spec['regex_include'].match(code_norm):
            if spec['regex_exclude'] and spec['regex_exclude'].match(code_norm):
                continue
            return key
    return None

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
