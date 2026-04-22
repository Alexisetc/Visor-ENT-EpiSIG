"""
Fase 4 — Tendencias (Mann-Kendall + Sen + FDR + Ljung-Box).

Consume `intermediate/ent_parroquial.json` (+ auditoria/{ncd,chronic})
y `intermediate/pob_parroquial.json`. Para cada
(nivel geo × entidad × grupo × subent × morb/mort × variante):

  1. Pretest Ljung-Box (lag up to 3) — solo flag informativo.
  2. Mann-Kendall via scipy.stats.kendalltau(year, rate, variant='b').
  3. Pendiente de Sen via scipy.stats.theilslopes — cambio /año en la tasa.
  4. FDR Benjamini-Hochberg por bloque (nivel, grupo, métrica, variante).
  5. Clasifica: p_adj<0.05 & tau>0 → Ascendente
               p_adj<0.05 & tau<0 → Descendente
               p_adj≥0.05          → Estable

Variantes:
  - serie_completa : 12 años 2013-2024 (incluye pandemia).
  - sin_pandemia   : 10 años, excluye 2020-2021.

Niveles:
  - parroquia (DPA6, N=1071)
  - provincia (DPA2, N=24)
  - nacional  (N=1)

Output:
  - intermediate/tendencias_parroquial.json              (morales + sub-ENT, el que consume el visor)
  - intermediate/auditoria/tendencias_parroquial_ncd.json
  - intermediate/auditoria/tendencias_parroquial_chronic.json
"""

from __future__ import annotations

import json
import math
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np

from scipy.stats import kendalltau, theilslopes
from statsmodels.stats.multitest import fdrcorrection

try:
    from statsmodels.stats.diagnostic import acorr_ljungbox
    _HAS_LJUNG = True
except Exception:  # pragma: no cover
    _HAS_LJUNG = False


# ----------------------------------------------------------------------
# Paths
# ----------------------------------------------------------------------
ROOT          = Path(__file__).resolve().parents[2]
INTERMEDIATE  = ROOT / "intermediate"
AUDITORIA     = INTERMEDIATE / "auditoria"
WEBAPP_ASSETS = ROOT / "webapp" / "assets"
REACT_ASSETS  = ROOT / "webapp-react" / "public" / "assets"

POB_PATH      = INTERMEDIATE / "pob_parroquial.json"
RATES_MAIN    = INTERMEDIATE / "ent_parroquial.json"
RATES_NCD     = AUDITORIA / "ent_parroquial_ncd.json"
RATES_CHRONIC = AUDITORIA / "ent_parroquial_chronic.json"

OUT_MAIN      = INTERMEDIATE / "tendencias_parroquial.json"
OUT_NCD       = AUDITORIA / "tendencias_parroquial_ncd.json"
OUT_CHRONIC   = AUDITORIA / "tendencias_parroquial_chronic.json"


# ----------------------------------------------------------------------
# Constantes
# ----------------------------------------------------------------------
PANDEMIC_YEARS = {2020, 2021}

VARIANTS = {
    "serie_completa": None,               # None => no filtrar
    "sin_pandemia":   PANDEMIC_YEARS,     # set => excluir
}

MIN_N_VARIANT = 6        # mínimo de puntos (años) por variante
MIN_CASOS     = 10       # tasa descartada si la serie tiene <10 casos totales en 12 años (ruido)
TASA_POR      = 100_000  # denominador estándar

ALPHA = 0.05


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
def _log(msg: str) -> None:
    print(f"[04_trends] {msg}", flush=True)


def _safe_rate(count: int, pop: float) -> float:
    """Tasa por 100k. Si pop<=0 → NaN (no entra al test)."""
    if pop is None or pop <= 0:
        return float("nan")
    return (count / pop) * TASA_POR


def _ljung_p(series: np.ndarray) -> float:
    """Ljung-Box p-valor con lag = min(3, n//3). Si no hay statsmodels o n<4 → NaN."""
    if not _HAS_LJUNG:
        return float("nan")
    n = len(series)
    if n < 4 or np.all(series == series[0]):
        return float("nan")
    try:
        lag = max(1, min(3, n // 3))
        # dof=0 porque trabajamos con la serie cruda, no con residuos de un modelo
        result = acorr_ljungbox(series, lags=[lag], return_df=True)
        return float(result["lb_pvalue"].iloc[-1])
    except Exception:
        return float("nan")


def _mk_test(years: np.ndarray, rates: np.ndarray) -> Tuple[float, float]:
    """Mann-Kendall via kendalltau variant 'b' — robusto a empates. Si la
    serie es constante, kendalltau retorna NaN; lo mapeamos a (0.0, 1.0)."""
    if len(years) < MIN_N_VARIANT or np.all(rates == rates[0]):
        return 0.0, 1.0
    res = kendalltau(years, rates, variant="b", nan_policy="omit")
    tau = res.statistic
    p   = res.pvalue
    if np.isnan(tau) or np.isnan(p):
        return 0.0, 1.0
    return float(tau), float(p)


def _sen_slope(years: np.ndarray, rates: np.ndarray) -> float:
    """Pendiente de Theil-Sen en unidades de tasa/año."""
    if len(years) < 2 or np.all(rates == rates[0]):
        return 0.0
    try:
        slope, _, _, _ = theilslopes(rates, years, 0.95)
        if np.isnan(slope):
            return 0.0
        return float(slope)
    except Exception:
        return 0.0


def _filter_variant(years: List[int], series: List[float], exclude: set | None
                    ) -> Tuple[np.ndarray, np.ndarray]:
    if exclude is None:
        ys = np.asarray(years,  dtype=float)
        xs = np.asarray(series, dtype=float)
    else:
        keep = [i for i, y in enumerate(years) if y not in exclude]
        ys = np.asarray([years[i]  for i in keep], dtype=float)
        xs = np.asarray([series[i] for i in keep], dtype=float)
    # descartamos NaN
    mask = ~np.isnan(xs)
    return ys[mask], xs[mask]


def _classify(tau: float, p_adj: float) -> str:
    if np.isnan(p_adj) or p_adj >= ALPHA:
        return "Estable"
    return "Ascendente" if tau > 0 else "Descendente"


# ----------------------------------------------------------------------
# Agregación jerárquica: parroquia → provincia → nacional
# ----------------------------------------------------------------------
def _collect_counts(
    rates_doc: dict,
    groups: List[str],
    subent: List[str],
) -> Tuple[Dict[str, Dict[str, Dict[str, List[int]]]],
           Dict[str, Dict[str, Dict[str, List[int]]]]]:
    """Extrae dos diccionarios anidados:
        counts_grupos[dpa6][grupo] = {'casos':[...], 'muertes':[...]}
        counts_subent[dpa6][sub]   = {'casos':[...], 'muertes':[...]}
    """
    cg: Dict[str, Dict[str, Dict[str, List[int]]]] = {}
    cs: Dict[str, Dict[str, Dict[str, List[int]]]] = {}
    for dpa6, entry in rates_doc["parroquias"].items():
        data = entry.get("data", {})
        g = data.get("grupos", {})
        cg[dpa6] = {
            name: {
                "casos":   list(g.get(name, {}).get("casos",   [])),
                "muertes": list(g.get(name, {}).get("muertes", [])),
            }
            for name in groups
        }
        s = data.get("subent", {})
        if s:
            cs[dpa6] = {
                name: {
                    "casos":   list(s.get(name, {}).get("casos",   [])),
                    "muertes": list(s.get(name, {}).get("muertes", [])),
                }
                for name in subent
            }
    return cg, cs


def _aggregate_series(
    series_by_key: Dict[str, Dict[str, Dict[str, List[int]]]],
    pop_by_key:    Dict[str, int],
    key_fn,
    n_years: int,
) -> Tuple[Dict[str, Dict[str, Dict[str, List[int]]]], Dict[str, int]]:
    """Agrega a nivel `prov2` o `nacional` usando key_fn(dpa6) -> nivel_id."""
    out: Dict[str, Dict[str, Dict[str, List[int]]]] = {}
    pops: Dict[str, int] = {}
    for dpa6, groups in series_by_key.items():
        parent = key_fn(dpa6)
        if parent is None:
            continue
        if parent not in out:
            out[parent] = {}
            pops[parent] = 0
        pops[parent] += int(pop_by_key.get(dpa6, 0))
        for gname, cols in groups.items():
            if gname not in out[parent]:
                out[parent][gname] = {"casos":   [0] * n_years,
                                      "muertes": [0] * n_years}
            for col in ("casos", "muertes"):
                vals = cols.get(col, [])
                for i, v in enumerate(vals[:n_years]):
                    out[parent][gname][col][i] += int(v)
    return out, pops


# ----------------------------------------------------------------------
# Run tests con FDR por bloque
# ----------------------------------------------------------------------
def _compute_level(
    counts: Dict[str, Dict[str, Dict[str, List[int]]]],
    pops: Dict[str, int],
    years: List[int],
    level: str,
) -> Dict:
    """Para un nivel (parroquia/provincia/nacional), produce:
        result[entity_id][grupo][metrica][variante] = {tau,p_raw,p_adj,...,clase}
    Aplica FDR BH dentro de cada bloque (grupo, metrica, variante).
    """
    # Paso 1: tests crudos
    raw = {}   # raw[entity][grupo][metrica][variante] = dict con métricas
    fdr_buckets: Dict[Tuple[str, str, str], List[Tuple[str, float]]] = {}
    # fdr_buckets[(grupo, metrica, variante)] = [(entity_id, p_raw), ...]

    for ent_id, groups in counts.items():
        pop = int(pops.get(ent_id, 0))
        raw[ent_id] = {}
        for gname, cols in groups.items():
            raw[ent_id][gname] = {}
            for metrica, colname in (("morbilidad", "casos"),
                                     ("mortalidad", "muertes")):
                serie_cnt = cols.get(colname, [])
                total_cnt = int(sum(serie_cnt))
                # serie de tasas (por 100k). Con pop 2022 como constante,
                # la tasa es simplemente count × 100000 / pop.
                rates = [_safe_rate(c, pop) for c in serie_cnt]
                raw[ent_id][gname][metrica] = {
                    "poblacion":  pop,
                    "total":      total_cnt,
                    "serie_tasa": rates,
                }
                for vname, exclude in VARIANTS.items():
                    ys, xs = _filter_variant(years, rates, exclude)
                    n = len(ys)
                    if n < MIN_N_VARIANT or total_cnt < MIN_CASOS or pop <= 0:
                        raw[ent_id][gname][metrica][vname] = {
                            "tau": 0.0, "p_raw": 1.0, "p_adj": float("nan"),
                            "sen_slope": 0.0, "ljung_p": float("nan"),
                            "n": int(n), "clase": "Estable",
                        }
                        continue
                    tau, p = _mk_test(ys, xs)
                    slope  = _sen_slope(ys, xs)
                    ljp    = _ljung_p(xs)
                    raw[ent_id][gname][metrica][vname] = {
                        "tau": round(tau, 4),
                        "p_raw": round(p, 5),
                        "p_adj": float("nan"),  # FDR pendiente
                        "sen_slope": round(slope, 5),
                        "ljung_p": round(ljp, 4) if not np.isnan(ljp) else None,
                        "n": int(n),
                        "clase": "Estable",      # se actualiza tras FDR
                    }
                    bucket = (gname, metrica, vname)
                    fdr_buckets.setdefault(bucket, []).append((ent_id, p))

    # Paso 2: FDR Benjamini-Hochberg por bucket
    for (gname, metrica, vname), entries in fdr_buckets.items():
        if not entries:
            continue
        ids   = [e[0] for e in entries]
        pvals = np.array([e[1] for e in entries], dtype=float)
        _, p_adj = fdrcorrection(pvals, alpha=ALPHA, method="indep")
        for ent_id, p_a in zip(ids, p_adj):
            node = raw[ent_id][gname][metrica][vname]
            node["p_adj"] = round(float(p_a), 5)
            node["clase"] = _classify(node["tau"], float(p_a))

    _log(f"  {level}: {len(raw)} entidades, {sum(len(v) for v in fdr_buckets.values())} tests MK con FDR")
    return raw


# ----------------------------------------------------------------------
# Pipeline por esquema
# ----------------------------------------------------------------------
def _pipeline_for_scheme(
    rates_path: Path,
    pob_by_dpa6: Dict[str, int],
    esquema_label: str,
) -> dict:
    _log(f"---- esquema: {esquema_label} ----")
    _log(f"  leyendo {rates_path}")
    rates_doc = json.loads(rates_path.read_text(encoding="utf-8"))
    years   = list(rates_doc["anios"])
    groups  = list(rates_doc["grupos"])
    subent  = list(rates_doc.get("subent", []))
    n_years = len(years)

    # Counts a nivel parroquia
    cg_parr, cs_parr = _collect_counts(rates_doc, groups, subent)

    # Poblaciones parroquia
    pop_parr = {dpa6: int(pob_by_dpa6.get(dpa6, 0)) for dpa6 in cg_parr}

    # Agregaciones
    def prov_key(dpa6: str) -> str | None:
        return dpa6[:2].zfill(2) if dpa6 and len(dpa6) >= 2 else None

    def nac_key(_dpa6: str) -> str | None:
        return "EC"

    cg_prov, pop_prov = _aggregate_series(cg_parr, pop_parr, prov_key, n_years)
    cg_nac,  pop_nac  = _aggregate_series(cg_parr, pop_parr, nac_key,  n_years)

    # Tendencias de grupos
    _log("  tests MK+Sen+FDR grupos…")
    t_parr_g = _compute_level(cg_parr, pop_parr, years, "parroquia/grupos")
    t_prov_g = _compute_level(cg_prov, pop_prov, years, "provincia/grupos")
    t_nac_g  = _compute_level(cg_nac,  pop_nac,  years, "nacional/grupos")

    # Tendencias de subent (solo main scheme las trae)
    t_parr_s: Dict = {}
    t_prov_s: Dict = {}
    t_nac_s:  Dict = {}
    if cs_parr:
        cs_prov, _ = _aggregate_series(cs_parr, pop_parr, prov_key, n_years)
        cs_nac,  _ = _aggregate_series(cs_parr, pop_parr, nac_key,  n_years)
        _log("  tests MK+Sen+FDR subent…")
        t_parr_s = _compute_level(cs_parr, pop_parr, years, "parroquia/subent")
        t_prov_s = _compute_level(cs_prov, pop_prov, years, "provincia/subent")
        t_nac_s  = _compute_level(cs_nac,  pop_nac,  years, "nacional/subent")

    # Armado del JSON
    out = {
        "generado": datetime.now().isoformat(timespec="seconds"),
        "esquema":  esquema_label,
        "anios":    years,
        "grupos":   groups,
        "subent":   subent,
        "variantes": list(VARIANTS.keys()),
        "niveles":  ["parroquia", "provincia", "nacional"],
        "alpha":    ALPHA,
        "fdr_method": "benjamini-hochberg (statsmodels fdrcorrection)",
        "pretest": "ljung-box (lag = min(3, n//3), solo flag informativo)",
        "min_n_variant": MIN_N_VARIANT,
        "min_casos":     MIN_CASOS,
        "tasa_por":      TASA_POR,
        "denominador": {
            "fuente": "CPV 2022 (INEC) vía pob_parroquial.json",
            "nota":   "denominador estático 2022; trends sobre tasas escaladas por pop constante ⇒ tau idéntico a MK sobre counts, Sen slope en unidades tasa/año",
        },
        "pandemia_excluye": sorted(PANDEMIC_YEARS),
        "niveles_data": {
            "parroquia": {"grupos": t_parr_g, "subent": t_parr_s},
            "provincia": {"grupos": t_prov_g, "subent": t_prov_s},
            "nacional":  {"grupos": t_nac_g,  "subent": t_nac_s},
        },
    }
    _log(f"  esquema {esquema_label} ok — parroquias={len(t_parr_g)} provincias={len(t_prov_g)} nacional={len(t_nac_g)}")
    return out


# ----------------------------------------------------------------------
# Resumen impreso (nacional)
# ----------------------------------------------------------------------
def _print_summary(doc: dict, label: str) -> None:
    years = doc["anios"]
    _log(f"---- resumen nacional {label} ----")
    nac_g = doc["niveles_data"]["nacional"]["grupos"].get("EC", {})
    for gname, metrics in nac_g.items():
        for metrica in ("morbilidad", "mortalidad"):
            node = metrics.get(metrica, {})
            full = node.get("serie_completa", {})
            sinp = node.get("sin_pandemia",   {})
            if not full or not sinp:
                continue
            _log(
                f"    {gname:14s} {metrica:10s} "
                f"serie_completa tau={full.get('tau',0):+.3f} p_adj={full.get('p_adj',1):.3f} sen={full.get('sen_slope',0):+.3f} {full.get('clase','-')} | "
                f"sin_pandemia  tau={sinp.get('tau',0):+.3f} p_adj={sinp.get('p_adj',1):.3f} sen={sinp.get('sen_slope',0):+.3f} {sinp.get('clase','-')}"
            )


# ----------------------------------------------------------------------
# Distribución de clases (por variante × grupo × métrica — nivel parroquia)
# ----------------------------------------------------------------------
def _class_distribution(doc: dict) -> dict:
    out = {"parroquia": {}, "provincia": {}, "nacional": {}}
    for level in out:
        parr = doc["niveles_data"][level]["grupos"]
        level_out = {}
        for ent_id, groups in parr.items():
            for gname, metrics in groups.items():
                for metrica in ("morbilidad", "mortalidad"):
                    node = metrics.get(metrica, {})
                    for vname, res in node.items():
                        if vname not in VARIANTS:
                            continue
                        clase = res.get("clase", "Estable")
                        k = (gname, metrica, vname)
                        level_out.setdefault(k, {"Ascendente": 0, "Descendente": 0, "Estable": 0})
                        level_out[k][clase] = level_out[k].get(clase, 0) + 1
        out[level] = {f"{g}|{m}|{v}": d for (g, m, v), d in level_out.items()}
    return out


# ----------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------
def main() -> None:
    t0 = time.time()
    _log("cargando CPV 2022…")
    pob_doc = json.loads(POB_PATH.read_text(encoding="utf-8"))
    pob_by_dpa6 = {str(k): int(v) for k, v in pob_doc["poblacion"].items()}
    _log(f"  {len(pob_by_dpa6)} parroquias con población")

    doc_main    = _pipeline_for_scheme(RATES_MAIN,    pob_by_dpa6, "morales")
    doc_ncd     = _pipeline_for_scheme(RATES_NCD,     pob_by_dpa6, "ncd")
    doc_chronic = _pipeline_for_scheme(RATES_CHRONIC, pob_by_dpa6, "chronic")

    # Escribir outputs
    AUDITORIA.mkdir(parents=True, exist_ok=True)
    OUT_MAIN.write_text(json.dumps(doc_main, ensure_ascii=False, indent=None), encoding="utf-8")
    OUT_NCD.write_text(json.dumps(doc_ncd, ensure_ascii=False, indent=None), encoding="utf-8")
    OUT_CHRONIC.write_text(json.dumps(doc_chronic, ensure_ascii=False, indent=None), encoding="utf-8")
    _log(f"escrito: {OUT_MAIN.relative_to(ROOT)}  ({OUT_MAIN.stat().st_size/1024:.1f} KB)")
    _log(f"escrito: {OUT_NCD.relative_to(ROOT)}  ({OUT_NCD.stat().st_size/1024:.1f} KB)")
    _log(f"escrito: {OUT_CHRONIC.relative_to(ROOT)}  ({OUT_CHRONIC.stat().st_size/1024:.1f} KB)")

    # Resumen nacional
    _print_summary(doc_main, "morales")

    # Distribución de clases nivel parroquia (snapshot por variante)
    dist = _class_distribution(doc_main)
    _log("---- distribución de clases (parroquia | grupo | métrica | variante) ----")
    for level in ("parroquia",):
        for key, counts in sorted(dist[level].items()):
            total = sum(counts.values())
            asc = counts.get("Ascendente", 0)
            des = counts.get("Descendente", 0)
            est = counts.get("Estable", 0)
            _log(f"    {level:10s} {key:45s}  N={total}  Asc={asc}  Des={des}  Est={est}")

    _log(f"tiempo total: {time.time()-t0:.1f}s")


if __name__ == "__main__":
    main()
