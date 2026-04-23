"""Fase 3 - Tasas parroquiales.

Agrega los parquets limpios de Fase 2 por (parroquia, grupo ENT, ano) y
produce el JSON que el visor React consume. Estructura compatible 1:1 con
`procesar_microdato_egresos.py` (legacy) para cero cambios frontend.

Outputs:
    intermediate/ent_parroquial.json              (esquema MORALES, primario)
    intermediate/auditoria/ent_parroquial_ncd.json
    intermediate/auditoria/ent_parroquial_chronic.json
    intermediate/_rates_run.log

El primario usa el esquema Morales porque `EntSelector.jsx` +
`webapp-react/src/lib/colors.js` lo definen asi (circulatorio I00-I99,
neoplasia C00-D48, metabolica E00-E99, respiratorio J00-J99, nervioso
G00-G99). Los otros dos quedan para auditoria cruzada (NCD estricto OMS /
crónico ampliado).

Uso:
    python -m scripts.ent_pipeline.03_rates
"""
from __future__ import annotations
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

try:
    from . import config as C
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from ent_pipeline import config as C


# -------------------------------------------------------------------------
# GeoJSON metadata: nombre, canton, provincia por DPA6
# -------------------------------------------------------------------------
def load_geo_meta() -> dict[str, dict]:
    gpath = C.ROOT / 'webapp-react' / 'public' / 'assets' / 'parroquias_otp_simpl.geojson'
    if not gpath.exists():
        gpath = C.ROOT / 'webapp' / 'assets' / 'parroquias_otp_simpl.geojson'
    data = json.loads(gpath.read_text(encoding='utf-8'))
    meta: dict[str, dict] = {}
    for feat in data.get('features', []):
        p = feat.get('properties', {})
        dpa = str(p.get('DPA_PARROQ') or p.get('DPA_PARROQU') or '').strip().zfill(6)
        if not dpa:
            continue
        meta[dpa] = {
            'nombre': p.get('DPA_DESPAR') or '',
            'cant':   p.get('DPA_DESCAN') or '',
            'prov':   p.get('DPA_DESPRO') or '',
        }
    return meta


def load_poblacion() -> dict:
    """Carga población parroquial.

    Prioriza `intermediate/pob_parroquial_anual.json` (serie 2013-2024 generada
    por `build_pob_anual.py` via log-share CPV 2010 → CPV 2022 × proyecciones
    cantonales INEC). Si no existe, cae a `pob_parroquial.json` (snapshot 2022).

    Devuelve:
        {
            'snapshot': {DPA6: int}  # CPV 2022 (retrocompat),
            'anios':    [2013, ..., 2024]  # None si solo snapshot,
            'anual':    {DPA6: [p_2013, ..., p_2024]}  # {} si solo snapshot,
        }
    """
    pob_anual_path = C.INTERMEDIATE / 'pob_parroquial_anual.json'
    pob_path       = C.INTERMEDIATE / 'pob_parroquial.json'

    if pob_anual_path.exists():
        data = json.loads(pob_anual_path.read_text(encoding='utf-8'))
        return {
            'snapshot': {k: int(v) for k, v in data.get('poblacion', {}).items()},
            'anios':    list(data.get('anios', [])),
            'anual':    {k: [int(x) for x in v] for k, v in data.get('poblacion_anual', {}).items()},
        }

    if not pob_path.exists():
        raise FileNotFoundError(
            f"No existe {pob_path} ni {pob_anual_path}. Corre "
            f"`python scripts/generar_pob_parroquial.py` o "
            f"`python -m scripts.ent_pipeline.population.build_pob_anual` primero."
        )
    data = json.loads(pob_path.read_text(encoding='utf-8'))
    return {
        'snapshot': {k: int(v) for k, v in data.get('poblacion', {}).items()},
        'anios':    None,
        'anual':    {},
    }


# -------------------------------------------------------------------------
# Agregacion casos/muertes por (parroquia, grupo, anio)
# -------------------------------------------------------------------------
def aggregate_by_scheme(
    df_egr: pd.DataFrame,
    df_def: pd.DataFrame,
    group_col: str,
    anios: list[int],
) -> dict:
    """Agrega casos (egresos) y muertes (defunciones) por parroquia x grupo x anio.

    Devuelve: {parroquia_key: {grupo: {"casos":[...], "muertes":[...]}}}
    Los arrays tienen longitud = len(anios), alineados al orden de `anios`.
    """
    anio_idx = {a: i for i, a in enumerate(anios)}
    n_anios = len(anios)

    # Pivote egresos: (parr, grupo, anio) -> casos
    egr = df_egr.dropna(subset=[group_col, 'parroquia_key']).copy()
    egr = egr[egr['parroquia_key'] != '']
    g_egr = egr.groupby(['parroquia_key', group_col, 'anio'], dropna=True, observed=True).size()

    # Pivote defunciones: (parr, grupo, anio) -> muertes
    dfn = df_def.dropna(subset=[group_col, 'parroquia_key']).copy()
    dfn = dfn[dfn['parroquia_key'] != '']
    g_def = dfn.groupby(['parroquia_key', group_col, 'anio'], dropna=True, observed=True).size()

    out: dict[str, dict] = {}

    # Construimos los dicts con arrays pre-rellenados en 0.
    for (parr, grupo, anio), casos in g_egr.items():
        if anio not in anio_idx:
            continue
        parr_d = out.setdefault(str(parr), {})
        grupo_d = parr_d.setdefault(str(grupo), {
            'casos':   [0] * n_anios,
            'muertes': [0] * n_anios,
        })
        grupo_d['casos'][anio_idx[anio]] = int(casos)

    for (parr, grupo, anio), muertes in g_def.items():
        if anio not in anio_idx:
            continue
        parr_d = out.setdefault(str(parr), {})
        grupo_d = parr_d.setdefault(str(grupo), {
            'casos':   [0] * n_anios,
            'muertes': [0] * n_anios,
        })
        grupo_d['muertes'][anio_idx[anio]] = int(muertes)

    return out


def aggregate_subent(
    df_egr: pd.DataFrame,
    df_def: pd.DataFrame,
    anios: list[int],
) -> dict:
    """Analogo a aggregate_by_scheme pero clasifica al vuelo por SUBENT_PATRONES.

    Usa `cau_cie10_norm` (ya normalizado a 3-char en Fase 2) para aplicar
    las 12 regex de sub-ENT clinicas.
    """
    def add_sub_col(df: pd.DataFrame) -> pd.DataFrame:
        # pre-computa dict code_norm -> sid (eficiente para 13M filas)
        uniq = set(df['cau_cie10_norm'].dropna().unique())
        uniq.discard('')
        code_to_sid = {c: C.classify_subent(c) for c in uniq}
        df = df.copy()
        df['subent_id'] = df['cau_cie10_norm'].map(code_to_sid)
        return df

    egr = add_sub_col(df_egr)
    dfn = add_sub_col(df_def)
    return aggregate_by_scheme(egr, dfn, 'subent_id', anios)


# -------------------------------------------------------------------------
# Armado del JSON visor
# -------------------------------------------------------------------------
def build_visor_json(
    df_egr: pd.DataFrame,
    df_def: pd.DataFrame,
    geo_meta: dict[str, dict],
    poblacion: dict,
    scheme: str,
    include_subent: bool = False,
) -> dict:
    """Construye el dict JSON compatible con el visor React para un esquema dado.

    Args:
        scheme: 'morales' | 'ncd' | 'chronic'
        include_subent: si True, agrega el bloque `subent` (solo tiene sentido
            en el esquema 'morales' porque los codigos subent son granularidades
            de grupos morales; NCD/chronic los excluirian parcialmente).
    """
    group_col = f'grupo_{scheme}'
    anios = sorted(df_egr['anio'].dropna().unique().tolist())
    anios = [int(a) for a in anios if int(a) in range(C.VALID_YEAR_RANGE[0], C.VALID_YEAR_RANGE[1] + 1)]

    grupos_keys = list(C.ENT_SCHEMES[scheme].keys())

    # Extraer componentes de la estructura de población.
    pob_snapshot: dict[str, int]       = poblacion.get('snapshot', {})
    pob_anios:    list[int] | None     = poblacion.get('anios')
    pob_anual:    dict[str, list[int]] = poblacion.get('anual', {})
    # Índices para mapear cada `anio` del visor a su posición en `pob_anios`.
    if pob_anios:
        pob_idx = {a: i for i, a in enumerate(pob_anios) if a in anios}
    else:
        pob_idx = {}

    agg_grp = aggregate_by_scheme(df_egr, df_def, group_col, anios)
    agg_sub = aggregate_subent(df_egr, df_def, anios) if include_subent else None

    # Construir el diccionario final de parroquias
    all_parroquias = set(agg_grp) | (set(agg_sub) if agg_sub else set()) | set(geo_meta.keys())

    out_parroquias: dict[str, dict] = {}
    total_egr_ent = 0
    total_def_ent = 0
    match_parr = match_cant = match_prov = 0
    dpas_no_match: dict[str, int] = {}

    for dpa in sorted(all_parroquias):
        # metadata: si existe en GeoJSON, match_level='parr'; si no, marcarlo
        if dpa in geo_meta:
            meta = geo_meta[dpa]
            match_level = 'parr'
        else:
            meta = {'nombre': '(sin match geo)', 'cant': '', 'prov': ''}
            match_level = 'cant' if len(dpa) >= 4 else 'prov'

        grupo_data = agg_grp.get(dpa, {})
        # Rellenar grupos faltantes con ceros (para consistencia frontend)
        grupos_full = {}
        for g in grupos_keys:
            if g in grupo_data:
                grupos_full[g] = grupo_data[g]
                total_egr_ent += sum(grupo_data[g]['casos'])
                total_def_ent += sum(grupo_data[g]['muertes'])
            else:
                grupos_full[g] = {'casos': [0] * len(anios), 'muertes': [0] * len(anios)}

        entry: dict = {
            'nombre':       meta['nombre'],
            'cant':         meta['cant'],
            'prov':         meta['prov'],
            'match_level':  match_level,
            'data': {
                'grupos': grupos_full,
            },
        }

        if agg_sub is not None:
            sub_data = agg_sub.get(dpa, {})
            sub_full = {}
            for sid in C.SUBENT_IDS:
                if sid in sub_data:
                    sub_full[sid] = sub_data[sid]
                else:
                    sub_full[sid] = {'casos': [0] * len(anios), 'muertes': [0] * len(anios)}
            entry['data']['subent'] = sub_full

        # Población CPV 2022 (snapshot, retrocompat para cálculos client-side)
        if dpa in pob_snapshot:
            entry['poblacion_2022'] = pob_snapshot[dpa]

        # Población anual 2013-2024 (denominador verdadero para Fase 4 y tasas
        # en cliente; log-share CPV 2010 → CPV 2022 × proyecciones cantonales).
        if dpa in pob_anual and pob_anios:
            serie_pob = pob_anual[dpa]
            # Alinear serie anual al orden de `anios` del visor.
            entry['poblacion_anual'] = [
                (serie_pob[pob_idx[a]] if a in pob_idx and pob_idx[a] < len(serie_pob) else 0)
                for a in anios
            ]

        out_parroquias[dpa] = entry

        # Stats de match
        if match_level == 'parr':
            match_parr += 1
        elif match_level == 'cant':
            match_cant += 1
            dpas_no_match[dpa] = int(sum(
                sum(grupo_data[g]['casos']) for g in grupo_data
            ))
        else:
            match_prov += 1

    tot_match = match_parr + match_cant + match_prov or 1
    # Top 10 de DPAs sin match por volumen
    top_nomatch = dict(sorted(dpas_no_match.items(), key=lambda kv: -kv[1])[:10])

    out: dict = {
        'generado': datetime.now().isoformat(),
        'anios': anios,
        'grupos': grupos_keys,
        'calidad': {
            'match_parr': round(match_parr / tot_match, 4),
            'match_cant': round(match_cant / tot_match, 4),
            'match_prov': round(match_prov / tot_match, 4),
            'total_egresos_ent':    int(total_egr_ent),
            'total_defunciones_ent': int(total_def_ent),
            'dpas_no_match_top':    top_nomatch,
        },
        'fuente': (
            f"INEC EGH+EDG 2013-2024 (RDACAA + datos abiertos) - pipeline ent_pipeline Fase 2/3 - "
            f"esquema='{scheme}' - parquets egresos_clean.parquet + defunciones_clean.parquet"
        ),
        'parroquias': out_parroquias,
        '_meta': {
            'ent_scheme': scheme,
            'scheme_cie10_ranges': {
                k: {
                    'include': spec['regex_include'].pattern,
                    'exclude': (spec['regex_exclude'].pattern if spec['regex_exclude'] else None),
                    'label':   spec['label'],
                }
                for k, spec in C.ENT_SCHEMES[scheme].items()
            },
            'orphan_aggregation':   'urbanas -> cabecera cantonal (prov+cant+50/01)',
            'denominador_nota':     ('Serie anual 2013-2024 vía log-share CPV 2010 → CPV 2022 × '
                                     'proyecciones cantonales INEC 2010-2035 Rev.2024. '
                                     '`entry.poblacion_anual[yi]` tiene la serie por año; '
                                     '`entry.poblacion_2022` queda como snapshot legacy (retrocompat). '
                                     'Aditividad intra-cantonal ≤ 1 habitante.'),
            'def_geo_nota':         'defunciones 2015+ usan lugar de fallecimiento (parr_fall) como proxy de residencia por ruptura esquema INEC',
            'mortalidad_nota':      'muertes = defunciones generales INEC (EDG 2013-2024). Legacy CONSOLIDADO_egresos.xlsx solo contaba defunciones hospitalarias (con_egrpa=Fallecido), subregistrando 10-40x el volumen real. Este pipeline reemplaza esa fuente subestimada por la fuente poblacional completa.',
            'csv_2024_nota':        'CSV 2024 viene con text labels (nombre de prov/cant/parr) en lugar de codigos numericos. Loader aplica 3-tier lookup via GeoJSON: (prov,cant,parr) full triple -> DPA6; fallback (prov,cant) -> DPA4; fallback prov-only -> DPA2. 98%+ match en casos. Defunciones 2024: la CSV solo trae prov_res (sin cant_res/parr_res), por lo que res cae a tier-3 con tier3_fill=False y Fase 2 usa parr_fall como fallback (~87 % de los 91k registros 2024).',
            'pandemia_periodos':    {'pre': [2013, 2019], 'pandemia': [2020, 2021], 'post': [2022, 2024]},
            'pipeline_version':     '1.0.0',
        },
    }

    if agg_sub is not None:
        out['subent'] = C.SUBENT_IDS

    return out


# -------------------------------------------------------------------------
# Orquestador
# -------------------------------------------------------------------------
def run(verbose: bool = True) -> dict:
    if verbose:
        print(f"[03_rates] cargando parquets limpios...", file=sys.stderr)
    df_egr = pd.read_parquet(C.INTERMEDIATE / 'egresos_clean.parquet')
    df_def = pd.read_parquet(C.INTERMEDIATE / 'defunciones_clean.parquet')
    if verbose:
        print(f"[03_rates] egresos: {len(df_egr):,} filas  defunciones: {len(df_def):,} filas",
              file=sys.stderr)

    geo_meta  = load_geo_meta()
    poblacion = load_poblacion()
    if verbose:
        has_anual = len(poblacion.get('anual', {}))
        pob_anios = poblacion.get('anios')
        pob_rango = f"{pob_anios[0]}-{pob_anios[-1]}" if pob_anios else 'solo snapshot 2022'
        print(f"[03_rates] geo_meta: {len(geo_meta)} parroquias  "
              f"pob snapshot: {len(poblacion.get('snapshot', {}))}  "
              f"pob anual: {has_anual} ({pob_rango})", file=sys.stderr)

    # 1) Esquema MORALES (primario, consumido por el visor)
    if verbose:
        print(f"\n[03_rates] -- esquema MORALES (primario + subent) --", file=sys.stderr)
    primary = build_visor_json(df_egr, df_def, geo_meta, poblacion,
                               scheme='morales', include_subent=True)
    out_primary = C.INTERMEDIATE / 'ent_parroquial.json'
    out_primary.write_text(json.dumps(primary, ensure_ascii=False), encoding='utf-8')
    if verbose:
        sz = out_primary.stat().st_size / 1024
        print(f"[03_rates] primary -> {out_primary.name} ({sz:.0f} KB)", file=sys.stderr)

    # 2) Datasets de auditoria (NCD y chronic)
    audit_dir = C.INTERMEDIATE / 'auditoria'
    audit_dir.mkdir(parents=True, exist_ok=True)

    for scheme in ('ncd', 'chronic'):
        if verbose:
            print(f"\n[03_rates] -- esquema {scheme.upper()} (auditoria) --", file=sys.stderr)
        j = build_visor_json(df_egr, df_def, geo_meta, poblacion,
                             scheme=scheme, include_subent=False)
        outp = audit_dir / f"ent_parroquial_{scheme}.json"
        outp.write_text(json.dumps(j, ensure_ascii=False), encoding='utf-8')
        if verbose:
            sz = outp.stat().st_size / 1024
            print(f"[03_rates] audit {scheme} -> {outp.relative_to(C.INTERMEDIATE)} ({sz:.0f} KB)",
                  file=sys.stderr)

    summary = {
        'primary_scheme': 'morales',
        'primary_path':   str(out_primary.relative_to(C.ROOT)),
        'audit_schemes':  ['ncd', 'chronic'],
        'audit_dir':      str(audit_dir.relative_to(C.ROOT)),
        'n_parroquias':   len(primary['parroquias']),
        'anios':          primary['anios'],
        'calidad':        primary['calidad'],
    }
    if verbose:
        print(f"\n[03_rates] DONE. Resumen:", file=sys.stderr)
        print(f"  primary:      {summary['primary_path']}", file=sys.stderr)
        print(f"  audit_dir:    {summary['audit_dir']}/", file=sys.stderr)
        print(f"  n_parroquias: {summary['n_parroquias']}", file=sys.stderr)
        print(f"  anios:        {summary['anios']}", file=sys.stderr)
        print(f"  calidad:      {summary['calidad']}", file=sys.stderr)

    return summary


if __name__ == '__main__':
    p = argparse.ArgumentParser(description='Fase 3 - tasas parroquiales + JSON visor')
    p.parse_args()
    run(verbose=True)
