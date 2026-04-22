"""Verificador post-ejecucion de Fase 2.

Compara `exclusion_log.json` contra los conteos esperados del plan
(continua-delegated-squid.md seccion 2.5) y reporta delta % por metrica.

Uso:
    python scripts/ent_pipeline/_verify_fase2.py
"""
from __future__ import annotations
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent.parent
LOG  = ROOT / 'intermediate' / 'exclusion_log.json'

EXPECTED = {
    'egresos': {
        'total_input':                13_544_354,
        'removed_provincia_20_88_90':      33_773,
        'orphans_aggregated_to_cab':    4_701_718,
        # by_scheme.visor
        'visor.cardio':                   568_558,
        'visor.neoplasia':                856_828,
        'visor.diabren':                  416_645,
        'visor.digest':                 1_884_391,  # K00-K92 completo
        'visor.resp':                     297_120,
        # by_scheme.morales
        'morales.circulatorio':           568_558,
        'morales.neoplasia':              856_828,
    },
    'defunciones': {
        'total_input':                    980_617,
        'removed_provincia_20_88_90':       1_146,
    },
}


def deep_get(d: dict, dotted: str):
    cur = d
    for part in dotted.split('.'):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
        if cur is None:
            return None
    return cur


def check(tipo: str, actual: dict, expected: dict) -> tuple[int, int]:
    ok = 0
    bad = 0
    print(f"\n=== {tipo.upper()} ===")
    for metric, exp in expected.items():
        if '.' in metric:
            # anidado en by_scheme
            scheme, grupo = metric.split('.', 1)
            act = deep_get(actual, f'by_scheme.{scheme}.{grupo}')
        else:
            act = actual.get(metric)
        if act is None:
            print(f"  [MISS] {metric:40s}  (no aparece en log)")
            bad += 1
            continue
        diff_pct = (act - exp) / exp * 100 if exp else 0
        status = 'OK ' if abs(diff_pct) < 5 else 'DIF'  # +/-5% como margen
        print(f"  [{status}] {metric:40s}  esperado={exp:>12,}  actual={act:>12,}  "
              f"delta={diff_pct:+.2f}%")
        if status == 'OK ':
            ok += 1
        else:
            bad += 1
    return ok, bad


def main():
    if not LOG.exists():
        print(f"[ERROR] No existe {LOG}. Corre primero `python -m scripts.ent_pipeline.02_clean`.",
              file=sys.stderr)
        sys.exit(1)

    data = json.loads(LOG.read_text(encoding='utf-8'))
    print(f"exclusion_log.json -> generado {data.get('generated_at', '?')}")
    print(f"params: {json.dumps(data.get('params', {}), ensure_ascii=False)}")

    total_ok = total_bad = 0
    for tipo, expected in EXPECTED.items():
        if tipo not in data:
            print(f"\n[WARN] {tipo} no esta en exclusion_log.json")
            continue
        ok, bad = check(tipo, data[tipo], expected)
        total_ok += ok
        total_bad += bad

    print(f"\n--- RESUMEN ---")
    print(f"  OK:  {total_ok}")
    print(f"  DIF: {total_bad}")

    # Reportar conteos observados tambien
    for tipo in ('egresos', 'defunciones'):
        if tipo not in data:
            continue
        print(f"\n--- {tipo} - conteos observados ---")
        print(f"  total_input:              {data[tipo].get('total_input', 0):>12,}")
        print(f"  total_output:             {data[tipo].get('total_output', 0):>12,}")
        print(f"  removed_year:             {data[tipo].get('removed_year_out_of_range', 0):>12,}")
        print(f"  removed_cause_empty:      {data[tipo].get('removed_cause_empty', 0):>12,}")
        print(f"  removed_provincia:        {data[tipo].get('removed_provincia_20_88_90', 0):>12,}")
        print(f"  flagged_edad_invalida:    {data[tipo].get('flagged_edad_invalida', 0):>12,}")
        print(f"  orphans_agg_to_cab:       {data[tipo].get('orphans_aggregated_to_cab', 0):>12,}")
        print(f"  no_geo_match_residual:    {data[tipo].get('no_geo_match_residual', 0):>12,}")
        if 'geo_source_counts' in data[tipo]:
            print(f"  geo_source_counts:        {data[tipo]['geo_source_counts']}")

    print()
    for tipo in ('egresos', 'defunciones'):
        if tipo not in data:
            continue
        print(f"--- {tipo} - by_scheme ---")
        for scheme, cnts in data[tipo].get('by_scheme', {}).items():
            tot = sum(cnts.values())
            print(f"  {scheme}: total={tot:,}")
            for k, v in sorted(cnts.items(), key=lambda x: -x[1])[:8]:
                pct = v / tot * 100 if tot else 0
                print(f"     {k:20s}  {v:>12,}  ({pct:5.2f}%)")


if __name__ == '__main__':
    main()
