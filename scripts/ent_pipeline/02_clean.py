"""Fase 2 - Limpieza + clasificacion ENT.

Consume los parquets cacheados por io_inec (`intermediate/<tipo>_all.parquet`)
y produce:

    intermediate/egresos_clean.parquet
    intermediate/defunciones_clean.parquet
    intermediate/exclusion_log.json

Aplica las reglas declaradas en `config.py` (seccion "Parametros de Fase 2"),
aprobadas 2026-04-21 por el responsable cientifico:

  * ENT_SCHEMES['morales' | 'ncd' | 'chronic']  -> 3 columnas paralelas.
  * ORPHAN_POLICY   = 'aggregate'             -> agrega huerfanos a cabecera.
  * DEF_GEO_SOURCE  = 'parr_res_or_fall'      -> fallback para defunciones 2015+.
  * PANDEMIC_POLICY = 'flag'                  -> columna `periodo`.
  * EXCLUDE_PROVS   = {'20','88','90'}        -> filtra + cuenta.

Uso:
    python -m scripts.ent_pipeline.02_clean
    python -m scripts.ent_pipeline.02_clean --tipo egresos
    python -m scripts.ent_pipeline.02_clean --no-cache   # rebuild parquet fuente
"""
from __future__ import annotations
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

# Import relativo robusto (sirve `python -m` como `python 02_clean.py`)
try:
    from . import config as C
    from .io_inec import load_all
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from ent_pipeline import config as C
    from ent_pipeline.io_inec import load_all


# -------------------------------------------------------------------------
# GeoJSON -> set de DPA6 validas + lookup de cabecera cantonal
# -------------------------------------------------------------------------
def load_geo_keys() -> set[str]:
    """Extrae las claves DPA6 del GeoJSON parroquial del visor."""
    gpath = C.ROOT / 'webapp-react' / 'public' / 'assets' / 'parroquias_otp_simpl.geojson'
    if not gpath.exists():
        gpath = C.ROOT / 'webapp' / 'assets' / 'parroquias_otp_simpl.geojson'
    if not gpath.exists():
        raise FileNotFoundError(
            "No se encontro parroquias_otp_simpl.geojson en ninguna ubicacion esperada. "
            "Requerido para la politica ORPHAN_POLICY='aggregate'."
        )
    data = json.loads(gpath.read_text(encoding='utf-8'))
    keys: set[str] = set()
    for feat in data.get('features', []):
        p = feat.get('properties', {})
        dpa = str(p.get('DPA_PARROQ') or p.get('DPA_PARROQU') or '').strip()
        if dpa:
            keys.add(dpa.zfill(6)[-6:])
    return keys


def build_cab_lookup(geo_keys: set[str]) -> dict[str, str]:
    """Mapea cada canton (prov+cant, 4 dig) -> la mejor clave de cabecera.

    Prioridad:
      1. `<cant>50`  - cabecera cantonal rural canonica (convencion INEC)
      2. `<cant>01`  - cabecera urbana (prov primera parroquia urbana)
      3. la parr mas pequena del canton (fallback deterministico)

    Si un canton no tiene NINGUNA parr en el GeoJSON, no aparece en el lookup
    y sus huerfanos se preservan con la key original (queda sin geo en el visor).
    """
    by_canton: dict[str, list[str]] = {}
    for k in geo_keys:
        if len(k) == 6:
            by_canton.setdefault(k[:4], []).append(k)
    lookup: dict[str, str] = {}
    for cant, keys in by_canton.items():
        if (cand := cant + '50') in keys:
            lookup[cant] = cand
        elif (cand := cant + '01') in keys:
            lookup[cant] = cand
        else:
            lookup[cant] = sorted(keys)[0]
    return lookup


def build_orphan_remap(orig_keys: pd.Series, geo_keys: set[str], cab_lookup: dict[str, str]) -> pd.Series:
    """Devuelve serie con la clave agregada por fila.

    Implementada via map/dict para ser vectorizada: solo se resuelve una vez
    por cada parr_key unica del dataset.
    """
    unique_keys = orig_keys.dropna().unique()
    remap: dict[str, str] = {}
    for k in unique_keys:
        if not k or len(k) < 6:
            remap[k] = k or ''
            continue
        if k in geo_keys:
            remap[k] = k
        else:
            remap[k] = cab_lookup.get(k[:4], k)  # si no hay canton, preserva
    return orig_keys.map(remap).fillna('')


# -------------------------------------------------------------------------
# Helpers de normalizacion
# -------------------------------------------------------------------------
def _to_str_dpa(series: pd.Series, width: int) -> pd.Series:
    """Float/int/str -> string DPA zero-padded al ancho indicado.

    NaN/vacio -> ''. Valores con mas de `width` chars se truncan al sufijo.
    """
    s = pd.to_numeric(series, errors='coerce')
    # Int64 permite NaN sin castear a float str raro
    out = s.astype('Int64').astype('string').replace({'<NA>': ''})
    mask = out.str.len() > 0
    # zfill + truncate al ancho pedido (INEC no deberia tener >width, pero por si acaso)
    out.loc[mask] = out.loc[mask].str.zfill(width).str[-width:]
    return out.fillna('')


def _compute_grupo_etario(edad: pd.Series) -> pd.Series:
    """Mapea edad (float) a grupo etario segun config.AGE_GROUPS."""
    # config.AGE_GROUPS es [(label, lo_inclusive, hi_inclusive), ...]
    # pd.cut usa bordes: [lo, hi) => necesito hi+1 como borde superior
    labels = [g[0] for g in C.AGE_GROUPS]
    edges = [C.AGE_GROUPS[0][1]] + [g[2] + 1 for g in C.AGE_GROUPS]
    cat = pd.cut(edad, bins=edges, labels=labels, right=False, include_lowest=True)
    return cat.astype('string')


def _compute_periodo(anio: pd.Series) -> pd.Series:
    """Marca pre-pandemia / pandemia / post-pandemia segun config.PANDEMIC_YEARS."""
    pmin = min(C.PANDEMIC_YEARS)
    pmax = max(C.PANDEMIC_YEARS)
    out = pd.Series('post-pandemia', index=anio.index, dtype='string')
    out[anio < pmin] = 'pre-pandemia'
    out[(anio >= pmin) & (anio <= pmax)] = 'pandemia'
    return out


def _classify_all_schemes(codes_norm: pd.Series) -> dict[str, pd.Series]:
    """Clasifica cada codigo CIE-10 normalizado bajo los 3 esquemas.

    Optimizacion: solo ~3000 codigos unicos, asi que se pre-computa el dict
    una vez por esquema -> asignacion O(n) con pd.Series.map().
    """
    unique_codes = set(codes_norm.dropna().unique())
    unique_codes.discard('')
    out: dict[str, pd.Series] = {}
    for scheme in C.ENT_SCHEMES.keys():
        code_to_group = {c: C.classify_cie10(c, scheme) for c in unique_codes}
        out[scheme] = codes_norm.map(code_to_group).astype('string')
    return out


# -------------------------------------------------------------------------
# Limpieza - egresos
# -------------------------------------------------------------------------
def clean_egresos(df: pd.DataFrame, geo_keys: set[str], cab_lookup: dict[str, str]) -> tuple[pd.DataFrame, dict]:
    log: dict = {'total_input': int(len(df))}

    # Regla 1 - rango anual (usa anio_egr como fuente canonica, fallback anio)
    lo, hi = C.VALID_YEAR_RANGE
    year_canonical = df['anio_egr'].fillna(df['anio']) if 'anio_egr' in df.columns else df['anio']
    in_range = year_canonical.between(lo, hi)
    log['removed_year_out_of_range'] = int((~in_range).sum())
    df = df[in_range].copy()
    df['anio'] = year_canonical[in_range].astype('Int64')

    # Regla 2 - causa no vacia (cau_cie10 para egresos)
    cau_str = df['cau_cie10'].astype('string').str.strip().str.lower()
    mask_cau = df['cau_cie10'].notna() & ~cau_str.isin(['nan', 'none', '', '0'])
    log['removed_cause_empty'] = int((~mask_cau).sum())
    df = df[mask_cau].copy()

    # Regla 3 - edad invalida (FLAG, no drop)
    edad = df['edad']
    df['edad_invalida'] = (edad > C.MAX_EDAD_VALID) | (edad == C.EDAD_SENTINEL_NA) | edad.isna()
    log['flagged_edad_invalida'] = int(df['edad_invalida'].sum())

    # Regla 4 - normalizar CIE-10 a prefijo 3-char
    df['cau_cie10_norm'] = df['cau_cie10'].astype('string').map(C.normalize_cie10)

    # Regla 5 - clasificar bajo los 3 esquemas
    schemes = _classify_all_schemes(df['cau_cie10_norm'])
    for k, v in schemes.items():
        df[f'grupo_{k}'] = v

    # Regla 6 - DPA6 residencia (+ agregacion huerfanos)
    df['parroquia_key_original'] = _to_str_dpa(df['parr_res'], 6)
    df['parroquia_key']          = build_orphan_remap(df['parroquia_key_original'], geo_keys, cab_lookup)
    orphan_mask = (df['parroquia_key_original'] != df['parroquia_key']) & (df['parroquia_key_original'] != '')
    log['orphans_aggregated_to_cab'] = int(orphan_mask.sum())
    # Trazabilidad adicional: cuantas quedaron SIN match ni tras aggregation
    no_geo_mask = ~df['parroquia_key'].isin(geo_keys) & (df['parroquia_key'] != '')
    log['no_geo_match_residual'] = int(no_geo_mask.sum())

    # Regla 7 - exclusion provincias 20/88/90 (prov del parroquia_key original)
    prov_str = df['parroquia_key_original'].str[:2]
    by_prov = {p: int((prov_str == p).sum()) for p in sorted(C.EXCLUDE_PROVS)}
    mask_excl = prov_str.isin(C.EXCLUDE_PROVS)
    log['removed_provincia_20_88_90'] = int(mask_excl.sum())
    log['removed_by_provincia'] = by_prov
    df = df[~mask_excl].copy()

    # Regla 8 - periodo + grupo etario
    df['periodo']      = _compute_periodo(df['anio'])
    df['grupo_etario'] = _compute_grupo_etario(df['edad'])

    # Conteos por esquema (para auditoria cruzada)
    log['by_scheme'] = {}
    for scheme in C.ENT_SCHEMES.keys():
        vc = df[f'grupo_{scheme}'].fillna('no_ent').value_counts().to_dict()
        log['by_scheme'][scheme] = {str(k): int(v) for k, v in vc.items()}

    # Subset de columnas a persistir
    keep_cols = [
        'prov_res', 'cant_res', 'parr_res',
        'parroquia_key', 'parroquia_key_original',
        'sexo', 'edad', 'edad_invalida', 'grupo_etario',
        'anio', 'periodo',
        'cau_cie10', 'cau_cie10_norm',
        'grupo_morales', 'grupo_ncd', 'grupo_chronic',
        'fuente_archivo',
    ]
    keep_cols = [c for c in keep_cols if c in df.columns]
    out = df[keep_cols].copy()
    log['total_output'] = int(len(out))
    return out, log


# -------------------------------------------------------------------------
# Limpieza - defunciones
# -------------------------------------------------------------------------
def clean_defunciones(df: pd.DataFrame, geo_keys: set[str], cab_lookup: dict[str, str]) -> tuple[pd.DataFrame, dict]:
    """Particularidades vs egresos:
      * causa en `causa4` (no `cau_cie10`).
      * DPA residencia desaparece 2015+; usa `parr_fall` como fallback segun
        C.DEF_GEO_SOURCE.
    """
    log: dict = {'total_input': int(len(df))}

    # Regla 1 - rango anual (anio_fall canonico, fallback anio)
    lo, hi = C.VALID_YEAR_RANGE
    year_canonical = df['anio_fall'].fillna(df['anio']) if 'anio_fall' in df.columns else df['anio']
    in_range = year_canonical.between(lo, hi)
    log['removed_year_out_of_range'] = int((~in_range).sum())
    df = df[in_range].copy()
    df['anio'] = year_canonical[in_range].astype('Int64')

    # Regla 2 - causa no vacia (causa4 para defunciones)
    cau_col = 'causa4' if 'causa4' in df.columns else 'causa3'
    cau_str = df[cau_col].astype('string').str.strip().str.lower()
    mask_cau = df[cau_col].notna() & ~cau_str.isin(['nan', 'none', '', '0'])
    log['removed_cause_empty'] = int((~mask_cau).sum())
    df = df[mask_cau].copy()

    # Regla 3 - edad invalida (flag)
    edad = df['edad']
    df['edad_invalida'] = (edad > C.MAX_EDAD_VALID) | (edad == C.EDAD_SENTINEL_NA) | edad.isna()
    log['flagged_edad_invalida'] = int(df['edad_invalida'].sum())

    # Regla 4 - normalizar CIE-10 + unificar a `cau_cie10`
    df['cau_cie10']      = df[cau_col].astype('string')
    df['cau_cie10_norm'] = df['cau_cie10'].map(C.normalize_cie10)

    # Regla 5 - clasificar bajo los 3 esquemas
    schemes = _classify_all_schemes(df['cau_cie10_norm'])
    for k, v in schemes.items():
        df[f'grupo_{k}'] = v

    # Regla 6 - DPA6 con fallback parr_res -> parr_fall
    parr_res_dpa  = _to_str_dpa(df['parr_res'],  6) if 'parr_res'  in df.columns else pd.Series('', index=df.index, dtype='string')
    parr_fall_dpa = _to_str_dpa(df['parr_fall'], 6) if 'parr_fall' in df.columns else pd.Series('', index=df.index, dtype='string')

    if C.DEF_GEO_SOURCE == 'parr_res_or_fall':
        has_res  = parr_res_dpa.str.len()  == 6
        has_fall = parr_fall_dpa.str.len() == 6
        df['geo_source'] = pd.Series(
            np.where(has_res, 'parr_res', np.where(has_fall, 'parr_fall', '')),
            index=df.index, dtype='string',
        )
        df['parroquia_key_original'] = parr_res_dpa.where(has_res, parr_fall_dpa)
    elif C.DEF_GEO_SOURCE == 'parr_res_strict':
        has_res = parr_res_dpa.str.len() == 6
        df['geo_source'] = pd.Series(
            np.where(has_res, 'parr_res', ''), index=df.index, dtype='string',
        )
        df['parroquia_key_original'] = parr_res_dpa
    elif C.DEF_GEO_SOURCE == 'parr_fall_always':
        has_fall = parr_fall_dpa.str.len() == 6
        df['geo_source'] = pd.Series(
            np.where(has_fall, 'parr_fall', ''), index=df.index, dtype='string',
        )
        df['parroquia_key_original'] = parr_fall_dpa
    else:
        raise ValueError(f"DEF_GEO_SOURCE desconocido: {C.DEF_GEO_SOURCE}")

    df['parroquia_key'] = build_orphan_remap(df['parroquia_key_original'], geo_keys, cab_lookup)
    orphan_mask = (df['parroquia_key_original'] != df['parroquia_key']) & (df['parroquia_key_original'] != '')
    log['orphans_aggregated_to_cab'] = int(orphan_mask.sum())
    no_geo_mask = ~df['parroquia_key'].isin(geo_keys) & (df['parroquia_key'] != '')
    log['no_geo_match_residual']    = int(no_geo_mask.sum())
    log['geo_source_counts']        = {str(k): int(v) for k, v in df['geo_source'].value_counts(dropna=False).to_dict().items()}

    # Regla 7 - exclusion provincias (usa primeros 2 chars del DPA elegido)
    prov_str = df['parroquia_key_original'].str[:2]
    by_prov = {p: int((prov_str == p).sum()) for p in sorted(C.EXCLUDE_PROVS)}
    mask_excl = prov_str.isin(C.EXCLUDE_PROVS)
    log['removed_provincia_20_88_90'] = int(mask_excl.sum())
    log['removed_by_provincia'] = by_prov
    df = df[~mask_excl].copy()

    # Regla 8 - periodo + grupo etario
    df['periodo']      = _compute_periodo(df['anio'])
    df['grupo_etario'] = _compute_grupo_etario(df['edad'])

    # Conteos por esquema
    log['by_scheme'] = {}
    for scheme in C.ENT_SCHEMES.keys():
        vc = df[f'grupo_{scheme}'].fillna('no_ent').value_counts().to_dict()
        log['by_scheme'][scheme] = {str(k): int(v) for k, v in vc.items()}

    keep_cols = [
        'prov_res', 'cant_res', 'parr_res',
        'prov_fall', 'cant_fall', 'parr_fall',
        'parroquia_key', 'parroquia_key_original', 'geo_source',
        'sexo', 'edad', 'edad_invalida', 'grupo_etario',
        'anio', 'periodo',
        'cau_cie10', 'cau_cie10_norm',
        'grupo_morales', 'grupo_ncd', 'grupo_chronic',
        'fuente_archivo',
    ]
    keep_cols = [c for c in keep_cols if c in df.columns]
    out = df[keep_cols].copy()
    log['total_output'] = int(len(out))
    return out, log


# -------------------------------------------------------------------------
# Orquestador
# -------------------------------------------------------------------------
def run(tipos: list[str], use_cache: bool = True, verbose: bool = True) -> dict:
    geo_keys   = load_geo_keys()
    cab_lookup = build_cab_lookup(geo_keys)
    if verbose:
        print(f"[02_clean] GeoJSON: {len(geo_keys)} parroquias, "
              f"{len(cab_lookup)} cantones con cabecera resuelta", file=sys.stderr)

    exclusion_log: dict = {
        'generated_at': datetime.now().isoformat(),
        'params': {
            'VALID_YEAR_RANGE':  list(C.VALID_YEAR_RANGE),
            'MAX_EDAD_VALID':    C.MAX_EDAD_VALID,
            'EDAD_SENTINEL_NA':  C.EDAD_SENTINEL_NA,
            'ORPHAN_POLICY':     C.ORPHAN_POLICY,
            'DEF_GEO_SOURCE':    C.DEF_GEO_SOURCE,
            'PANDEMIC_POLICY':   C.PANDEMIC_POLICY,
            'PANDEMIC_YEARS':    sorted(C.PANDEMIC_YEARS),
            'EXCLUDE_PROVS':     sorted(C.EXCLUDE_PROVS),
            'SCHEMES_EMITTED':   list(C.ENT_SCHEMES.keys()),
        },
        'geo': {
            'n_parroquias_geojson': len(geo_keys),
            'n_cantones_lookup':    len(cab_lookup),
        },
    }

    for tipo in tipos:
        if verbose:
            print(f"\n[02_clean] ---- cargando {tipo} desde parquet cacheado ----", file=sys.stderr)
        df, _src_info = load_all(tipo, use_cache=use_cache, verbose=verbose)

        cleaner = clean_egresos if tipo == 'egresos' else clean_defunciones
        if verbose:
            print(f"[02_clean] limpiando {tipo}... ({len(df):,} filas)", file=sys.stderr)
        clean, log = cleaner(df, geo_keys, cab_lookup)
        del df  # libera RAM antes de escribir

        out_path = C.INTERMEDIATE / f"{tipo}_clean.parquet"
        clean.to_parquet(out_path, index=False, compression='snappy')
        if verbose:
            sz = out_path.stat().st_size / 1024 / 1024
            print(f"[02_clean] {tipo}: {len(clean):,} filas -> {out_path.name} ({sz:.1f} MB)",
                  file=sys.stderr)

        exclusion_log[tipo] = log
        del clean

    log_path = C.INTERMEDIATE / 'exclusion_log.json'
    log_path.write_text(json.dumps(exclusion_log, indent=2, ensure_ascii=False), encoding='utf-8')
    if verbose:
        print(f"\n[02_clean] exclusion_log -> {log_path}", file=sys.stderr)

    return exclusion_log


if __name__ == '__main__':
    p = argparse.ArgumentParser(description='Fase 2 - limpieza pipeline ENT')
    p.add_argument('--tipo', choices=['egresos', 'defunciones', 'all'], default='all')
    p.add_argument('--no-cache', action='store_true', help='fuerza rebuild de parquet fuente')
    args = p.parse_args()

    tipos = ['egresos', 'defunciones'] if args.tipo == 'all' else [args.tipo]
    run(tipos, use_cache=not args.no_cache, verbose=True)
