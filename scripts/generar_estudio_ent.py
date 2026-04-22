"""Generar estudio_ent.json — empaqueta los resultados del estudio
'Evolución de la mortalidad por enfermedades no transmisibles en Ecuador (2017-2023)'
(carpeta ENT_ART) en un JSON consumible por el visor React.

El dataset incluye, por los 5 grupos ENT:
  · mortalidad: frecuencia y tasa /100k por año 2017-2023
  · prevalencia: frecuencia y tasa /100k por año 2017-2023 (desde egresos)
  · mortalidad por sexo (hombre/mujer)
  · mortalidad por área (urbana/rural)
  · tendencia estadística (pendiente, IC95, p-valor, % anual, clase)

Salida: webapp/assets/estudio_ent.json (~10 KB)
"""
from __future__ import annotations
import json
import shutil
import unicodedata
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
ENT_ART = ROOT / 'ENT_ART' / 'datos' / 'datos_limpios' / 'new_ent_clean'
OUT = ROOT / 'intermediate' / 'estudio_ent.json'
ASSETS = ROOT / 'webapp' / 'assets'

# Mapeo de la nomenclatura del estudio → IDs del visor React
GROUP_MAP = {
    'Sist. circulatorio':   'circulatorio',
    'Neoplasia':            'neoplasia',
    'Aparato respiratorio': 'respiratorio',
    'Metabólica':           'metabolica',
    'Sist. nervioso':       'nervioso',
    # 'Otro' se ignora (no tiene grupo equivalente en el visor espacial)
}
YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023]


def norm(s: str) -> str:
    return unicodedata.normalize('NFKD', str(s)).encode('ASCII', 'ignore').decode('ASCII').strip().lower()


def find_group_id(label: str) -> str | None:
    nlabel = norm(label)
    for k, v in GROUP_MAP.items():
        if norm(k) == nlabel:
            return v
    return None


def _col(df, name):
    """Resolver nombre de columna (pandas puede leer números como int o str)."""
    if name in df.columns:
        return name
    s = str(name)
    if s in df.columns:
        return s
    try:
        n = int(s)
        if n in df.columns:
            return n
    except Exception:
        pass
    raise KeyError(f'columna {name!r} no existe (disponibles: {list(df.columns)[:6]}…)')


def load_mortalidad():
    """DEF_ENT_mort.xlsx → frecuencia + tasa mort por grupo × año."""
    df = pd.read_excel(ENT_ART / 'DEF_ENT_mort.xlsx')
    result = {}
    for _, row in df.iterrows():
        gid = find_group_id(row['grupo'])
        if not gid:
            continue
        result[gid] = {
            'casos': [int(row[_col(df, y)]) for y in YEARS],
            'tasa':  [round(float(row[_col(df, f'mort_{y}')]), 2) for y in YEARS],
        }
    return result


def load_prevalencia():
    """EGR_ENFERM_f_prev.xlsx tiene causas CIE-10 individuales; agregamos por grupo
    usando el mapeo Leonel Morales (rangos de capítulo CIE-10)."""
    df = pd.read_excel(ENT_ART / 'EGR_ENFERM_f_prev.xlsx')
    # Mapeo de capítulos CIE-10 a grupo del visor
    def chapter_group(code: str) -> str | None:
        c = str(code).strip().upper()
        if not c or c == 'NAN':
            return None
        letter = c[0]
        try:
            num = int(c[1:3])
        except Exception:
            return None
        if letter == 'I' and 0 <= num <= 99:  return 'circulatorio'
        if letter == 'C' or (letter == 'D' and num <= 48):  return 'neoplasia'
        if letter == 'E' and 0 <= num <= 90:  return 'metabolica'
        if letter == 'J' and 0 <= num <= 99:  return 'respiratorio'
        if letter == 'G' and 0 <= num <= 99:  return 'nervioso'
        return None

    result = {gid: {'casos': [0]*len(YEARS), 'tasa': [0.0]*len(YEARS)} for gid in GROUP_MAP.values()}
    # Poblaciones mediana por año (para recalcular la tasa global del grupo)
    # Las tasas del estudio usan la misma población total, entonces podemos
    # sumar casos y usar la ratio prev/casos de una fila de referencia.
    for _, row in df.iterrows():
        gid = chapter_group(row['causa3'])
        if not gid:
            continue
        for i, y in enumerate(YEARS):
            casos = row[_col(df, y)]
            if pd.notna(casos):
                result[gid]['casos'][i] += int(casos)

    # Para convertir a tasa, usamos la ratio que el estudio aplica a una fila representativa
    # (tasa = casos × factor_año). Cargamos una fila con casos>0 y calculamos el factor.
    y0 = _col(df, YEARS[0])
    first_valid = df.dropna(subset=[y0]).iloc[0]
    factors = []
    for y in YEARS:
        prev_col = _col(df, f'prev_{y}')
        year_col = _col(df, y)
        if pd.notna(first_valid[prev_col]) and first_valid[year_col]:
            factors.append(first_valid[prev_col] / first_valid[year_col])
        else:
            factors.append(0)

    for gid in result:
        for i, fac in enumerate(factors):
            result[gid]['tasa'][i] = round(result[gid]['casos'][i] * fac, 2)
    return result


def load_por_sexo():
    """DEF_GR_SEX_ENT_mort.xlsx → tasa mort por grupo × sexo × año."""
    df = pd.read_excel(ENT_ART / 'DEF_GR_SEX_ENT_mort.xlsx')
    result = {}
    for _, row in df.iterrows():
        gid = find_group_id(row['grupo'])
        if not gid:
            continue
        result[gid] = {
            'hombre': [round(float(row[_col(df, f'mort_h_{y}')]), 2) for y in YEARS],
            'mujer':  [round(float(row[_col(df, f'mort_m_{y}')]), 2) for y in YEARS],
        }
    return result


def load_por_area():
    """DEF_GR_area_ENT_mort.xlsx → tasa mort por grupo × área × año."""
    df = pd.read_excel(ENT_ART / 'DEF_GR_area_ENT_mort.xlsx')
    result = {}
    for _, row in df.iterrows():
        gid = find_group_id(row['grupo'])
        if not gid:
            continue
        result[gid] = {
            'urbana': [round(float(row[_col(df, f'mort_Urbana_{y}')]), 2) for y in YEARS],
            'rural':  [round(float(row[_col(df, f'mort_Rural_{y}')]), 2) for y in YEARS],
        }
    return result


def load_tendencia():
    """FOURTH_VEJEZ.xlsx ya está filtrado por vejez; para tendencia general nacional
    usamos THIRD_AREA_ENT.xlsx agregado por grupo (promedio de territorios 1 y 2),
    si no, dejamos FOURTH_VEJEZ como aproximación."""
    # Usamos FOURTH_VEJEZ como tendencia representativa del grupo etario de mayor carga
    try:
        df = pd.read_excel(ENT_ART / 'FOURTH_VEJEZ.xlsx')
    except Exception:
        return {}
    result = {}
    for _, row in df.iterrows():
        gid = find_group_id(row['grupo'])
        if not gid:
            continue
        result[gid] = {
            'pendiente':   round(float(row['pendiente']), 3),
            'p_valor':     round(float(row['p_valor']), 4),
            'ic95':        str(row['ic95']),
            'pct_anual':   round(float(row['porcentaje_anual']), 2),
            'clase':       str(row['tendencia']),
            'fuente':      'FOURTH_VEJEZ (grupo etario ≥60 años)',
        }
    return result


def main():
    out = {
        'estudio': 'Evolución de la mortalidad por enfermedades no transmisibles en Ecuador (2017-2023)',
        'anios': YEARS,
        'grupos': {},
    }
    mort = load_mortalidad()
    prev = load_prevalencia()
    sexo = load_por_sexo()
    area = load_por_area()
    tend = load_tendencia()

    for gid in GROUP_MAP.values():
        out['grupos'][gid] = {
            'mortalidad':      mort.get(gid, {}),
            'prevalencia':     prev.get(gid, {}),
            'mortalidad_sexo': sexo.get(gid, {}),
            'mortalidad_area': area.get(gid, {}),
            'tendencia':       tend.get(gid, {}),
        }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')

    # Copia a webapp/assets para el dev server
    ASSETS.mkdir(parents=True, exist_ok=True)
    shutil.copy2(OUT, ASSETS / 'estudio_ent.json')

    print(f'[estudio_ent] generado {OUT.name}')
    print(f'  grupos: {list(out["grupos"].keys())}')
    for gid, g in out['grupos'].items():
        ts = g.get('mortalidad', {}).get('tasa', [])
        print(f'  {gid}: mort {ts[0] if ts else "—"} → {ts[-1] if ts else "—"} (2017→2023)')


if __name__ == '__main__':
    main()
