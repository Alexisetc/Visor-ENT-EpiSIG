"""I/O INEC — carga unificada de `.sav` y `.csv` (CSV 2024) para egresos
y defunciones. Devuelve DataFrames con columnas canónicas y una columna
extra `fuente_archivo` para trazabilidad.

Filosofía:
  · Lee AL VUELO y trunca columnas al subconjunto común — esto evita que
    los 2.3 GB de .sav exploten la RAM (la columna "causa298rx" es innecesaria).
  · Añade SIEMPRE `anio` (int) derivado de `anio_egr`/`anio_fall`.
  · Cachea el concatenado en parquet — la segunda corrida pasa de minutos a segs.
  · SHA256 del archivo fuente → se registra en `hash_inputs` para reproducibilidad.
"""
from __future__ import annotations
import hashlib
import json
import os
import sys
import unicodedata
from pathlib import Path
from typing import Literal

import pandas as pd
import pyreadstat

from . import config as C


# ──────────────────────────────────────────────────────────────────────────
# Lookup nombre→código DPA (para CSV 2024 que trae text labels en lugar de códigos)
# ──────────────────────────────────────────────────────────────────────────
def _strip_accents(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn')


def _norm_name(s: str) -> str:
    """Normaliza nombres de lugar para lookup case/accent-insensitive.

    - upper, strip accents, strip surrounding whitespace
    - remueve sufijo ", CABECERA CANTONAL" común en nombres de parroquia 2024
    - colapsa espacios múltiples
    """
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ''
    s = str(s).strip().upper()
    s = _strip_accents(s)
    # Sufijos comunes a remover
    for suf in (', CABECERA CANTONAL', ' CABECERA CANTONAL'):
        if s.endswith(suf):
            s = s[:-len(suf)].rstrip(' ,')
    # Colapsar espacios
    s = ' '.join(s.split())
    return s


# Alias de cantones/provincias comunes entre CSV 2024 ↔ GeoJSON oficial.
# Key: tupla normalizada que viene en el CSV; Value: tupla normalizada en el GeoJSON.
# Detectado empíricamente sobre los ~220K registros 2024 no-matcheados en el
# primer intento. Todas las claves ya pasaron por `_norm_name`.
CANT_ALIASES: dict[tuple[str, str], tuple[str, str]] = {
    ('PICHINCHA', 'QUITO'):                          ('PICHINCHA', 'DISTRITO METROPOLITANO DE QUITO'),
    ('ORELLANA', 'ORELLANA'):                        ('ORELLANA', 'FRANCISCO DE ORELLANA'),
    ('GUAYAS', 'EMPALME'):                           ('GUAYAS', 'EL EMPALME'),
    ('IMBABURA', 'COTACAHI'):                        ('IMBABURA', 'COTACACHI'),
    ('GUAYAS', 'CRNEL. MARCELINO MARIDUENA'):        ('GUAYAS', 'CORONEL MARCELINO MARIDUENA'),
    ('GUAYAS', 'GNRAL. ANTONIO ELIZALDE'):           ('GUAYAS', 'GENERAL ANTONIO ELIZALDE'),
    ('GUAYAS', 'ALFREDO BAQUERIZO MORENO'):          ('GUAYAS', 'ALFREDO BAQUERIZO MORENO (JUJAN)'),
    ('SANTO DOMINGO DE LOS TSACHILAS', 'LA CONDORDIA'): ('ESMERALDAS', 'LA CONCORDIA'),
    ('NAPO', 'CARLOS JULIO ARROSEMENA TOLA'):        ('NAPO', 'CARLOS JULIO AROSEMENA TOLA'),
}


_NAME_LOOKUP_CACHE: dict | None = None


def build_name_to_code_lookup() -> dict[tuple[str, str, str], str]:
    """Construye {(prov_norm, cant_norm, parr_norm): DPA6} leyendo el GeoJSON.

    Cacheado a nivel de módulo (GeoJSON tiene 1050 filas, se lee una vez por sesión).
    """
    global _NAME_LOOKUP_CACHE
    if _NAME_LOOKUP_CACHE is not None:
        return _NAME_LOOKUP_CACHE
    gpath = C.ROOT / 'webapp-react' / 'public' / 'assets' / 'parroquias_otp_simpl.geojson'
    if not gpath.exists():
        gpath = C.ROOT / 'webapp' / 'assets' / 'parroquias_otp_simpl.geojson'
    data = json.loads(gpath.read_text(encoding='utf-8'))
    lookup: dict[tuple[str, str, str], str] = {}
    for feat in data.get('features', []):
        p = feat.get('properties', {})
        prov_n = _norm_name(p.get('DPA_DESPRO'))
        cant_n = _norm_name(p.get('DPA_DESCAN'))
        parr_n = _norm_name(p.get('DPA_DESPAR'))
        dpa = str(p.get('DPA_PARROQ') or '').strip().zfill(6)
        if prov_n and cant_n and parr_n and dpa:
            lookup[(prov_n, cant_n, parr_n)] = dpa
    _NAME_LOOKUP_CACHE = lookup
    return lookup


_CANT_LOOKUP_CACHE: dict | None = None


def build_cant_lookup() -> dict[tuple[str, str], str]:
    """Fallback lookup: (prov_norm, cant_norm) → DPA4 (prov+cant).

    Derivado del lookup full: para cada canton, toma el DPA4 de cualquier
    parroquia que le pertenezca (todas comparten prov(2)+cant(2)).
    """
    global _CANT_LOOKUP_CACHE
    if _CANT_LOOKUP_CACHE is not None:
        return _CANT_LOOKUP_CACHE
    full = build_name_to_code_lookup()
    cant_lookup: dict[tuple[str, str], str] = {}
    for (prov_n, cant_n, _parr_n), dpa6 in full.items():
        cant_lookup.setdefault((prov_n, cant_n), dpa6[:4])
    _CANT_LOOKUP_CACHE = cant_lookup
    return cant_lookup


def csv_names_to_codes(
    df: pd.DataFrame,
    prov_col: str,
    cant_col: str,
    parr_col: str,
    *,
    tier3_fill: bool = True,
) -> None:
    """Convierte in-place (prov_col, cant_col, parr_col) de nombres a códigos.

    Tres niveles de resolución:
      1) (prov, cant, parr) full triple → DPA6 split en (prov, cant, parr)
      2) (prov, cant) → DPA4 (parr queda como DPA4+'00' para que la orphan-
         logic de Fase 2 lo remape a cabecera cantonal)
      3) solo prov → DPA2 → si `tier3_fill=True`, parr = DPA2+'0000' ; si
         `tier3_fill=False`, SOLO se asigna prov_col y (cant_col, parr_col)
         quedan como NaN para que Fase 2 caiga al fallback opuesto
         (ej. en defunciones 2024 solo viene `prov_res` como texto, así que
         queremos que parr_res=NaN y Fase 2 use `parr_fall` en su lugar).

    No hace nada si la columna ya es numérica (es decir, viene de .sav).
    """
    if prov_col not in df.columns:
        return
    # Detectar si ya es numérica
    trial = pd.to_numeric(df[prov_col], errors='coerce')
    if trial.notna().mean() > 0.5:
        return  # ya son códigos

    full_lookup = build_name_to_code_lookup()
    cant_lookup = build_cant_lookup()

    # Lookup prov-only (para defunciones 2024 que solo trae prov_res)
    prov_lookup: dict[str, str] = {}
    for (prov_n, _c), dpa4 in cant_lookup.items():
        prov_lookup.setdefault(prov_n, dpa4[:2])

    prov_norm = df[prov_col].map(_norm_name)
    cant_norm = df[cant_col].map(_norm_name) if cant_col in df.columns else pd.Series([''] * len(df), index=df.index)
    parr_norm = df[parr_col].map(_norm_name) if parr_col in df.columns else pd.Series([''] * len(df), index=df.index)

    # Aplicar alias de cantones antes del lookup
    def _apply_alias(p, c):
        return CANT_ALIASES.get((p, c), (p, c))
    aliased = [_apply_alias(p, c) for p, c in zip(prov_norm, cant_norm)]
    prov_norm_a = pd.Series([a[0] for a in aliased], index=df.index)
    cant_norm_a = pd.Series([a[1] for a in aliased], index=df.index)

    triples = pd.Series(list(zip(prov_norm_a, cant_norm_a, parr_norm)), index=df.index)
    pairs   = pd.Series(list(zip(prov_norm_a, cant_norm_a)),              index=df.index)

    # Tier 1: full match → DPA6
    dpa6 = triples.map(full_lookup)
    # Tier 2: fallback (prov, cant) → DPA4
    dpa4 = pairs.map(cant_lookup)
    # Tier 3: prov only → DPA2
    dpa2 = prov_norm_a.map(prov_lookup)

    # Construir columnas finales matching convención .sav:
    #   prov_res = 2-digit          (ej: 17 = Pichincha)
    #   cant_res = 4-digit prov*100+cant   (ej: 1701 = Pichincha/Quito)
    #   parr_res = 6-digit DPA completo    (ej: 170108 = Belisario Quevedo)
    prov_code = pd.Series([pd.NA] * len(df), index=df.index, dtype='Int64')
    cant_code = pd.Series([pd.NA] * len(df), index=df.index, dtype='Int64')
    parr_code = pd.Series([pd.NA] * len(df), index=df.index, dtype='Int64')

    # Tier 1: full triple matched → codes de .sav shape
    got1 = dpa6.notna()
    if got1.any():
        prov_code.loc[got1] = pd.to_numeric(dpa6[got1].str[:2],  errors='coerce').astype('Int64')
        cant_code.loc[got1] = pd.to_numeric(dpa6[got1].str[:4],  errors='coerce').astype('Int64')
        parr_code.loc[got1] = pd.to_numeric(dpa6[got1].str[:6],  errors='coerce').astype('Int64')

    # Tier 2: (prov, cant) matched pero no parr → parr_res = dpa4+"00"
    got2 = ~got1 & dpa4.notna()
    if got2.any():
        prov_code.loc[got2] = pd.to_numeric(dpa4[got2].str[:2], errors='coerce').astype('Int64')
        cant_code.loc[got2] = pd.to_numeric(dpa4[got2].str[:4], errors='coerce').astype('Int64')
        parr_code.loc[got2] = pd.to_numeric(dpa4[got2] + '00', errors='coerce').astype('Int64')

    # Tier 3: solo prov matched
    got3 = ~got1 & ~got2 & dpa2.notna()
    if got3.any():
        prov_code.loc[got3] = pd.to_numeric(dpa2[got3], errors='coerce').astype('Int64')
        if tier3_fill:
            cant_code.loc[got3] = pd.to_numeric(dpa2[got3] + '00',   errors='coerce').astype('Int64')
            parr_code.loc[got3] = pd.to_numeric(dpa2[got3] + '0000', errors='coerce').astype('Int64')
        # si tier3_fill=False → cant/parr quedan en NA; esto habilita el
        # fallback `parr_res_or_fall` de Fase 2 para defunciones 2024.

    df[prov_col] = prov_code
    df[cant_col] = cant_code
    df[parr_col] = parr_code


# ──────────────────────────────────────────────────────────────────────────
# Utilidades internas
# ──────────────────────────────────────────────────────────────────────────
def sha256_file(path: Path, bufsize: int = 4 * 1024 * 1024) -> str:
    """SHA256 de archivos grandes con lectura por chunks."""
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while chunk := f.read(bufsize):
            h.update(chunk)
    return h.hexdigest()


def _normalize_cols(df: pd.DataFrame) -> pd.DataFrame:
    """Baja a lower, strip, renombra columnas con encoding roto."""
    rename = {}
    for c in df.columns:
        clean = str(c).strip().lower()
        # arreglar "Numeración" mal encodeado como "numeraci�n"
        clean = clean.replace('\ufffd', 'ó').replace('ñ', 'n')
        rename[c] = clean
    return df.rename(columns=rename)


def _keep_common(df: pd.DataFrame, common: list[str]) -> pd.DataFrame:
    """Se queda con las columnas del set común que EXISTEN en este archivo.

    Reporta en `df.attrs['missing_common_cols']` las que faltan para el bloque
    de integridad del HTML.
    """
    df = _normalize_cols(df)
    have = [c for c in common if c in df.columns]
    missing = [c for c in common if c not in df.columns]
    extra = [c for c in df.columns if c not in common]
    out = df[have].copy()
    out.attrs['missing_common_cols'] = missing
    out.attrs['extra_cols']          = extra
    return out


# ──────────────────────────────────────────────────────────────────────────
# Lectura por año
# ──────────────────────────────────────────────────────────────────────────
def load_egresos(year: int, common: list[str] | None = None) -> pd.DataFrame:
    """Lee un año de egresos (.sav 2013-2023 ó .csv 2024).

    Devuelve un DataFrame con columnas canónicas + `fuente_archivo` + `anio`.
    """
    common = common or C.COMMON_EGR_COLS
    sav_path = C.INPUT_EGR / f"egresos_hospitalarios_{year}.sav"
    csv_path = C.INPUT_EGR / f"egresos_hospitalarios_{year}.csv"

    if sav_path.exists():
        df, _meta = pyreadstat.read_sav(
            str(sav_path),
            apply_value_formats=False,   # queremos los códigos, no los labels
            encoding='LATIN1',
        )
        fuente = sav_path.name
    elif csv_path.exists():
        df = pd.read_csv(
            csv_path, sep=';', encoding='utf-8',
            low_memory=False, dtype=str,  # luego casteamos columnas numéricas
        )
        fuente = csv_path.name
    else:
        raise FileNotFoundError(f"No existe archivo para egresos {year} en {C.INPUT_EGR}")

    df = _keep_common(df, common)
    df['fuente_archivo'] = fuente
    df['anio'] = year

    # CSV 2024 trae nombres en lugar de códigos → convertir ANTES del cast numérico
    # (si ya son códigos numéricos el helper es no-op).
    csv_names_to_codes(df, 'prov_res', 'cant_res', 'parr_res')
    csv_names_to_codes(df, 'prov_ubi', 'cant_ubi', 'parr_ubi')

    # Cast suave: las columnas DPA y demografía típicamente llegan como float
    for col in ('prov_res', 'cant_res', 'parr_res',
                'prov_ubi', 'cant_ubi', 'parr_ubi',
                'sexo', 'edad', 'cod_edad',
                'anio_egr', 'mes_egr', 'dia_egr',
                'anio_ingr', 'mes_ingr', 'dia_ingr',
                'dia_estad', 'con_egrpa', 'mes_inv'):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # Cast fechas a datetime64 (evita tipos mixtos datetime.date/str al concatenar)
    for col in ('fecha_egr', 'fecha_ingr'):
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')

    # Columnas DPA como string con zero-padding — para cruce con geo posterior.
    # En fase de perfilado las mantenemos como números/strings crudos para ver
    # patrones reales de la data (e.g. algunos años tienen prov_res=' 17').
    return df


def load_defunciones(year: int, common: list[str] | None = None) -> pd.DataFrame:
    """Lee un año de defunciones (.sav 2013-2023 ó .csv 2024)."""
    common = common or C.COMMON_DEF_COLS
    sav_path = C.INPUT_DEF / f"EDG_{year}.sav"
    csv_path = C.INPUT_DEF / f"EDG_{year}.csv"

    if sav_path.exists():
        df, _meta = pyreadstat.read_sav(
            str(sav_path),
            apply_value_formats=False,
            encoding='LATIN1',
        )
        fuente = sav_path.name
    elif csv_path.exists():
        df = pd.read_csv(
            csv_path, sep=';', encoding='utf-8',
            low_memory=False, dtype=str,
        )
        fuente = csv_path.name
    else:
        raise FileNotFoundError(f"No existe archivo para defunciones {year} en {C.INPUT_DEF}")

    df = _keep_common(df, common)
    df['fuente_archivo'] = fuente
    df['anio'] = year

    # CSV 2024 trae nombres en lugar de códigos → convertir ANTES del cast numérico.
    # `prov_res` viene solo (sin cant_res/parr_res) en 2024 — tier3_fill=False hace que
    # cant_res/parr_res queden en NaN para que Fase 2 use parr_fall como fallback.
    csv_names_to_codes(df, 'prov_res',  'cant_res',  'parr_res',  tier3_fill=False)
    csv_names_to_codes(df, 'prov_fall', 'cant_fall', 'parr_fall')
    csv_names_to_codes(df, 'prov_insc', 'cant_insc', 'parr_insc')

    for col in ('prov_res', 'cant_res', 'parr_res',
                'prov_fall', 'cant_fall', 'parr_fall',
                'sexo', 'edad', 'cod_edad',
                'anio_fall', 'mes_fall', 'dia_fall',
                'anio_nac', 'mes_nac', 'dia_nac',
                'anio_insc', 'mes_insc', 'dia_insc',
                'lugar_ocur', 'sabe_leer', 'est_civil', 'niv_inst',
                'nac_fall'):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    for col in ('fecha_fall', 'fecha_nac', 'fecha_insc'):
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce')

    return df


# ──────────────────────────────────────────────────────────────────────────
# Carga masiva con cache parquet
# ──────────────────────────────────────────────────────────────────────────
def load_all(
    tipo: Literal['egresos', 'defunciones'],
    years: list[int] | range | None = None,
    use_cache: bool = True,
    verbose: bool = True,
) -> tuple[pd.DataFrame, dict]:
    """Concatena todos los años y cachea como parquet.

    Devuelve (df, info) donde info contiene:
      · hashes    – sha256 por archivo fuente
      · rows_year – conteo por año (reporte en bloque A del HTML)
      · missing_by_year – columnas del set común faltantes por año
      · extra_by_year   – columnas extra por año (ej. 2024: tipo_seg, dis_pac)
    """
    years = list(years) if years is not None else C.YEARS
    cache = C.CACHE_DIR / f"{tipo}_all.parquet"
    info_cache = C.CACHE_DIR / f"{tipo}_info.json"

    if use_cache and cache.exists() and info_cache.exists():
        if verbose:
            print(f"[io_inec] Usando cache existente {cache.relative_to(C.ROOT)}", file=sys.stderr)
        df = pd.read_parquet(cache)
        import json
        info = json.loads(info_cache.read_text(encoding='utf-8'))
        return df, info

    loader = load_egresos if tipo == 'egresos' else load_defunciones
    pieces = []
    info = {
        'tipo': tipo,
        'years': years,
        'rows_year': {},
        'hashes': {},
        'missing_by_year': {},
        'extra_by_year': {},
    }
    for y in years:
        if verbose:
            print(f"[io_inec] cargando {tipo} {y}…", file=sys.stderr)
        try:
            df = loader(y)
        except FileNotFoundError as e:
            if verbose:
                print(f"  SKIP: {e}", file=sys.stderr)
            continue

        fuente = df['fuente_archivo'].iloc[0]
        fullpath = (C.INPUT_EGR if tipo == 'egresos' else C.INPUT_DEF) / fuente
        info['rows_year'][y]        = int(len(df))
        info['hashes'][fuente]      = sha256_file(fullpath)
        info['missing_by_year'][y]  = df.attrs.get('missing_common_cols', [])
        info['extra_by_year'][y]    = df.attrs.get('extra_cols', [])
        pieces.append(df)

    if not pieces:
        raise RuntimeError(f"No se cargó ningún año para {tipo}")

    full = pd.concat(pieces, ignore_index=True, copy=False)
    if verbose:
        print(f"[io_inec] concatenado: {len(full):,} filas x {len(full.columns)} cols", file=sys.stderr)

    # Homogeneizar columnas object (strings mixtos con date/None) antes de parquet:
    # pyarrow rechaza columnas object con tipos heterogéneos.
    for col in full.columns:
        if full[col].dtype == object:
            full[col] = full[col].astype(str).replace({'nan': None, 'None': None, 'NaT': None})

    # Persistir cache
    C.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    full.to_parquet(cache, index=False, compression='snappy')
    import json
    info_cache.write_text(json.dumps(info, indent=2, ensure_ascii=False), encoding='utf-8')
    if verbose:
        sz = cache.stat().st_size / 1024 / 1024
        print(f"[io_inec] cache guardado → {cache.relative_to(C.ROOT)}  ({sz:.1f} MB)", file=sys.stderr)

    return full, info


if __name__ == '__main__':
    # Utilidad: `python -m scripts.ent_pipeline.io_inec egresos` fuerza rebuild
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('tipo', choices=['egresos', 'defunciones'])
    p.add_argument('--no-cache', action='store_true')
    args = p.parse_args()
    df, info = load_all(args.tipo, use_cache=not args.no_cache)
    print(f"\n{args.tipo}: {len(df):,} filas, {len(df.columns)} columnas")
    print("Filas por año:", info['rows_year'])
