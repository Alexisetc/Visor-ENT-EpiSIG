"""Fase 5 — Export final al visor.

Fusiona los productos de Fase 3 (tasas parroquiales) y Fase 4 (tendencias
Mann-Kendall + Sen + FDR) en **un solo JSON** que el visor React consume
drop-in:

    webapp/assets/ent_parroquial.json
    webapp-react/public/assets/ent_parroquial.json

Schema del JSON enriquecido
---------------------------
El schema de Fase 3 se respeta 1:1 (campos `anios`, `grupos`, `subent`,
`calidad`, `fuente`, `parroquias`, `_meta`), y se suman dos caminos para
leer tendencias pre-computadas:

    parroquias[dpa6].data.grupos[g].tendencia   → morb/mort × 2 variantes
    parroquias[dpa6].data.subent[s].tendencia   → morb/mort × 2 variantes
    tendencias_agg.nacional.grupos[g]           → morb/mort × 2 variantes
    tendencias_agg.nacional.subent[s]           → idem
    tendencias_agg.provincia[dpa2].grupos[g]    → morb/mort × 2 variantes
    tendencias_agg.provincia[dpa2].subent[s]    → idem
    _meta_tendencias                            → parámetros del test

Formato por tendencia (parroquial · compacto):
    {
      "morbilidad": {
        "serie_completa": {"tau","p_adj","sen_slope","clase","n"},
        "sin_pandemia":   {…idem…}
      },
      "mortalidad": { … }
    }

Formato por tendencia (agg provincia/nacional · con serie para gráficas):
    {
      "morbilidad": {
        "poblacion": int,
        "serie_tasa": [float …12],     ← tasa /100k por año
        "serie_completa": {"tau","p_adj","sen_slope","ljung_p","clase","n"},
        "sin_pandemia":   { … }
      },
      "mortalidad": { … }
    }

Notas técnicas
--------------
* NaN → null (JSON estricto) para que `response.json()` no falle en el
  navegador. 04_trends.py emitió ~95 k tokens NaN por el uso de numpy.
* El JSON final pesa ~4-5 MB (vs 2.1 MB de Fase 3 solo tasas).
* Se archiva la versión anterior a `webapp-react/public/assets/_legacy/`
  con timestamp.
* Los datasets de auditoría (NCD, Chronic) se dejan en
  `intermediate/auditoria/` — NO se copian al visor.

Uso:
    python scripts/ent_pipeline/05_export_visor.py
"""
from __future__ import annotations

import copy
import json
import math
import shutil
import sys
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------- paths
ROOT    = Path(__file__).resolve().parents[2]
INTER   = ROOT / "intermediate"
WEB_CLA = ROOT / "webapp"        / "assets"
WEB_RCT = ROOT / "webapp-react"  / "public" / "assets"

SRC_RATES  = INTER / "ent_parroquial.json"
SRC_TRENDS = INTER / "tendencias_parroquial.json"

DST_INTER  = INTER / "ent_parroquial.json"   # sobreescribe (mismo path)
DST_CLA    = WEB_CLA / "ent_parroquial.json"
DST_RCT    = WEB_RCT / "ent_parroquial.json"

LEGACY_DIR = WEB_RCT / "_legacy"

# ---------------------------------------------------------------- helpers
def _none_if_nan(v):
    """Convierte NaN / +-Inf → None para JSON estricto."""
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v

def _round_stats(obj, decimals=4):
    """Redondea floats numéricos en un dict plano de estadísticos."""
    out = {}
    for k, v in obj.items():
        if isinstance(v, float):
            v = _none_if_nan(v)
            if v is not None:
                v = round(v, decimals)
        out[k] = v
    return out

def _compact_parr(trend_metrica):
    """Tendencia compacta para una métrica (morb o mort) a nivel parroquia.

    Mantiene solo {tau, p_adj, sen_slope, clase, n} por variante.
    Omite poblacion/total/serie_tasa/p_raw/ljung_p para ahorrar ~80% bytes.
    """
    out = {}
    for var in ("serie_completa", "sin_pandemia"):
        st = trend_metrica.get(var, {})
        out[var] = _round_stats({
            "tau":       st.get("tau",        0.0),
            "p_adj":     st.get("p_adj",      None),
            "sen_slope": st.get("sen_slope",  0.0),
            "clase":     st.get("clase",      "Estable"),
            "n":         int(st.get("n", 0) or 0),
        }, decimals=4)
    return out

def _full_agg(trend_metrica):
    """Tendencia completa para nivel nacional/provincia — incluye serie_tasa."""
    serie = trend_metrica.get("serie_tasa", [])
    out = {
        "poblacion":  int(trend_metrica.get("poblacion", 0) or 0),
        "total":      int(trend_metrica.get("total",     0) or 0),
        "serie_tasa": [
            None if _none_if_nan(x) is None else round(float(x), 2)
            for x in serie
        ],
    }
    for var in ("serie_completa", "sin_pandemia"):
        st = trend_metrica.get(var, {})
        out[var] = _round_stats({
            "tau":       st.get("tau",        0.0),
            "p_raw":     st.get("p_raw",      None),
            "p_adj":     st.get("p_adj",      None),
            "sen_slope": st.get("sen_slope",  0.0),
            "ljung_p":   st.get("ljung_p",    None),
            "clase":     st.get("clase",      "Estable"),
            "n":         int(st.get("n", 0) or 0),
        }, decimals=4)
    return out

def _transform_parr_level(level_dict, packer):
    """Dado `niveles_data.parroquia.{grupos|subent}`, emite para cada unit
    un dict {ent_id: {morb: ..., mort: ...}} aplicando packer por métrica."""
    result = {}
    for unit_id, per_ent in level_dict.items():
        result[unit_id] = {}
        for ent_id, per_met in per_ent.items():
            result[unit_id][ent_id] = {
                "morbilidad": packer(per_met.get("morbilidad", {})),
                "mortalidad": packer(per_met.get("mortalidad", {})),
            }
    return result


# ---------------------------------------------------------------- main
def main() -> int:
    print(f"[05_export_visor] Fuente tasas  : {SRC_RATES}")
    print(f"[05_export_visor] Fuente tends  : {SRC_TRENDS}")

    rates  = json.loads(SRC_RATES.read_text(encoding="utf-8"))
    trends = json.loads(SRC_TRENDS.read_text(encoding="utf-8"))

    # ------------------------------------------------------- 1. merge parroquia
    parr_grp = _transform_parr_level(
        trends["niveles_data"]["parroquia"]["grupos"], _compact_parr,
    )
    parr_sub = _transform_parr_level(
        trends["niveles_data"]["parroquia"]["subent"], _compact_parr,
    )

    n_merge_grp = 0
    n_merge_sub = 0
    missing_parr = 0
    for dpa, meta in rates["parroquias"].items():
        data = meta.setdefault("data", {})

        grp_block = data.setdefault("grupos", {})
        tr_grp = parr_grp.get(dpa)
        if tr_grp is None:
            missing_parr += 1
        else:
            for g, stats in tr_grp.items():
                if g in grp_block:
                    grp_block[g]["tendencia"] = stats
                    n_merge_grp += 1

        sub_block = data.setdefault("subent", {})
        tr_sub = parr_sub.get(dpa)
        if tr_sub is not None:
            for s, stats in tr_sub.items():
                if s in sub_block:
                    sub_block[s]["tendencia"] = stats
                    n_merge_sub += 1

    print(f"[05_export_visor] parroquias enriquecidas: "
          f"{n_merge_grp:,} grupos · {n_merge_sub:,} subent "
          f"(ausentes: {missing_parr})")

    # ------------------------------------------------------- 2. agg prov/nacional
    # Schema: mirror del bloque parroquial (unit-first → type → ent → métrica)
    #   tendencias_agg.nacional.grupos[ent]
    #   tendencias_agg.nacional.subent[ent]
    #   tendencias_agg.provincia[dpa2].grupos[ent]
    #   tendencias_agg.provincia[dpa2].subent[ent]
    tendencias_agg = {
        "nacional":  {"grupos": {}, "subent": {}},
        "provincia": {},
    }

    def _pack_unit(unit_grp_src: dict, unit_sub_src: dict) -> dict:
        out = {"grupos": {}, "subent": {}}
        for g, per_met in (unit_grp_src or {}).items():
            out["grupos"][g] = {
                "morbilidad": _full_agg(per_met.get("morbilidad", {})),
                "mortalidad": _full_agg(per_met.get("mortalidad", {})),
            }
        for s, per_met in (unit_sub_src or {}).items():
            out["subent"][s] = {
                "morbilidad": _full_agg(per_met.get("morbilidad", {})),
                "mortalidad": _full_agg(per_met.get("mortalidad", {})),
            }
        return out

    # nacional (solo EC)
    nac = _pack_unit(
        trends["niveles_data"]["nacional"]["grupos"].get("EC", {}),
        trends["niveles_data"]["nacional"]["subent"].get("EC", {}),
    )
    tendencias_agg["nacional"] = nac

    # provincia: iterar sobre todos los DPA2 vistos en grupos o subent
    prov_grp_src = trends["niveles_data"]["provincia"]["grupos"]
    prov_sub_src = trends["niveles_data"]["provincia"]["subent"]
    dpa2_all = sorted(set(prov_grp_src.keys()) | set(prov_sub_src.keys()))
    for dpa2 in dpa2_all:
        tendencias_agg["provincia"][dpa2] = _pack_unit(
            prov_grp_src.get(dpa2, {}),
            prov_sub_src.get(dpa2, {}),
        )

    rates["tendencias_agg"] = tendencias_agg

    # ------------------------------------------------------- 3. meta de tendencias
    rates["_meta_tendencias"] = {
        "esquema":          trends.get("esquema", "morales"),
        "variantes":        trends.get("variantes"),
        "pandemia_excluye": trends.get("pandemia_excluye"),
        "anios":            trends.get("anios"),
        "alpha":            trends.get("alpha"),
        "fdr_method":       trends.get("fdr_method"),
        "pretest":          trends.get("pretest"),
        "min_n_variant":    trends.get("min_n_variant"),
        "min_casos":        trends.get("min_casos"),
        "tasa_por":         trends.get("tasa_por"),
        "denominador":      trends.get("denominador"),
        "nota":
            "Tendencias pre-computadas via Mann-Kendall (scipy.kendalltau var='b') "
            "+ Sen slope (theilslopes) + FDR Benjamini-Hochberg por bucket "
            "(nivel × grupo × metrica × variante). Ljung-Box lag=min(3, n//3) "
            "solo informativo. Clase = Ascendente/Descendente si p_adj<0.05, "
            "Estable en otro caso.",
    }

    # ------------------------------------------------------- 4. _meta enriquecido
    rates.setdefault("_meta", {})
    rates["_meta"]["fase5_export"] = datetime.now().isoformat(timespec="seconds")
    rates["_meta"]["tendencia_path"] = "parroquias[dpa6].data.grupos[g].tendencia"

    rates["generado"] = datetime.now().isoformat(timespec="seconds")

    # ------------------------------------------------------- 5. escribir (NaN→null)
    def _default(o):
        # fallback encoder (raramente usado; las estadísticas ya pasaron por _round_stats)
        if isinstance(o, float) and math.isnan(o):
            return None
        raise TypeError(f"no serializable: {type(o)}")

    # usar allow_nan=False + default para atrapar cualquier NaN residual
    try:
        out_bytes = json.dumps(rates, ensure_ascii=False, allow_nan=False,
                               default=_default, separators=(",", ":")).encode("utf-8")
    except ValueError as e:
        print(f"[05_export_visor] ERROR: NaN residual en el payload: {e}",
              file=sys.stderr)
        return 1

    size_mb = len(out_bytes) / (1024 * 1024)
    print(f"[05_export_visor] JSON final    : {size_mb:.2f} MB")

    # ------------------------------------------------------- 6. backup legacy
    LEGACY_DIR.mkdir(parents=True, exist_ok=True)
    if DST_RCT.exists():
        ts  = datetime.now().strftime("%Y%m%d-%H%M%S")
        leg = LEGACY_DIR / f"ent_parroquial.v0_{ts}.json"
        shutil.copy2(DST_RCT, leg)
        print(f"[05_export_visor] backup legacy : {leg.relative_to(ROOT)}")

    # ------------------------------------------------------- 7. escribir destinos
    for dst in (DST_INTER, DST_CLA, DST_RCT):
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(out_bytes)
        print(f"[05_export_visor] escrito       : {dst.relative_to(ROOT)}")

    # ------------------------------------------------------- 8. resumen nacional
    nac = tendencias_agg["nacional"]["grupos"]
    print()
    print("[05_export_visor] === resumen nacional (serie_completa) ===")
    print(f"{'grupo':<15} {'métrica':<11} {'tau':>6} {'p_adj':>8} "
          f"{'sen':>7} {'clase':<12}")
    for g in ("circulatorio", "neoplasia", "metabolica", "respiratorio",
              "nervioso"):
        if g not in nac:
            continue
        for met in ("morbilidad", "mortalidad"):
            st = nac[g][met]["serie_completa"]
            p_str = f"{st['p_adj']:.4f}" if st.get('p_adj') is not None else "  NA   "
            print(f"{g:<15} {met:<11} "
                  f"{st['tau']:>+6.3f} {p_str:>8} "
                  f"{st['sen_slope']:>+7.2f} {st['clase']:<12}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
