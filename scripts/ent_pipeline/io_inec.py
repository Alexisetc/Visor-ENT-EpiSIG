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
import os
import sys
from pathlib import Path
from typing import Literal

import pandas as pd
import pyreadstat

from . import config as C


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
            csv_path, sep=';', encoding='latin1',
            low_memory=False, dtype=str,  # luego casteamos columnas numéricas
        )
        fuente = csv_path.name
    else:
        raise FileNotFoundError(f"No existe archivo para egresos {year} en {C.INPUT_EGR}")

    df = _keep_common(df, common)
    df['fuente_archivo'] = fuente
    df['anio'] = year

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
            csv_path, sep=';', encoding='latin1',
            low_memory=False, dtype=str,
        )
        fuente = csv_path.name
    else:
        raise FileNotFoundError(f"No existe archivo para defunciones {year} en {C.INPUT_DEF}")

    df = _keep_common(df, common)
    df['fuente_archivo'] = fuente
    df['anio'] = year

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
