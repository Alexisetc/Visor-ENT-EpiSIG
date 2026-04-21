"""
calcular_mcda_prioridad.py
===========================

Calcula el ranking de ENT priorizadas a nivel parroquial usando Análisis
Multicriterio (MCDA) por **suma ponderada** (Marsh/ISPOR 2016, Baltussen 2006),
simulación del Proyecto F-I+D+i-075 de Priorizacion MCDA (INSPI CZ9, Duque 2026-2028).

Criterios (normalizados [0, 1] respecto al máximo nacional):
  C1 Tasa de mortalidad (x100k)         w=0.30  (letalidad ENT × casos × 100k / pob)
  C2 Tasa de egresos (x100k)            w=0.20  (casos × 100k / pob)
  C3 Carga AVAD simulada                w=0.15  (factor GBD × casos)
  C4 Tendencia CAGR 2015->2023          w=0.15  (crecimiento medio anual compuesto)
  C5 Costo al sistema simulado          w=0.10  (factor costo-caso × casos)
  C6 Brecha equidad urbano-rural        w=0.10  (ratio cabecera / rural del cantón)

Para parroquias con casos_total < UMBRAL (10) se hereda el ranking del cantón
(flag `fuente: heredada_canton`).

Dependencias: pip install pandas
Uso:          python calcular_mcda_prioridad.py
"""

from __future__ import annotations
import json
import unicodedata
from pathlib import Path
from collections import defaultdict

HERE = Path(__file__).parent
PROJECT_ROOT = HERE.parent
ENT_JSON = PROJECT_ROOT / "intermediate" / "ent_parroquial.json"
POB_JSON = PROJECT_ROOT / "intermediate" / "pob_parroquial.json"
OUT_JSON = PROJECT_ROOT / "webapp" / "assets" / "priorizacion_mcda.json"

UMBRAL_CASOS_PROPIO = 10  # parroquias con < esto heredan ranking del cantón

# Pesos Marsh/ISPOR 2016 (editables para sensibilidad)
PESOS = {
    "mortalidad":  0.30,
    "egresos":     0.20,
    "avad":        0.15,
    "tendencia":   0.15,
    "costo":       0.10,
    "equidad":     0.10,
}

# Factores por ENT (plausibles, de GBD 2021 / OPS 2022)
# letalidad: proporción de casos que mueren
# avad_por_caso: años de vida ajustados por discapacidad (AVAD/DALY)
# costo_por_caso: USD estimado al sistema de salud por caso
ENT_FACTORES = {
    # Letalidad hospitalaria Ecuador (MSP 2023), AVAD (GBD 2021 Ecuador),
    # costo promedio por egreso (OPS, ajustes locales).
    "circulatorio":  {"letalidad":0.14, "avad":14.2, "costo":2200, "color":"#ea1d2c"},
    "neoplasia":     {"letalidad":0.15, "avad":17.0, "costo":3400, "color":"#756bb1"},
    "metabolica":    {"letalidad":0.04, "avad":9.1,  "costo":1600, "color":"#e88a2c"},
    "respiratorio":  {"letalidad":0.05, "avad":7.8,  "costo":1050, "color":"#31a354"},
    "nervioso":      {"letalidad":0.07, "avad":11.2, "costo":1650, "color":"#6c7a89"},
}

ENT_IDS = list(ENT_FACTORES.keys())


def cagr(serie):
    s = [v for v in serie if v is not None]
    if len(s) < 2 or s[0] <= 0:
        return 0.0
    n = len(s) - 1
    try:
        return ((s[-1] / s[0]) ** (1 / n) - 1) * 100
    except Exception:
        return 0.0


def casos_totales_ent(parr, ent_id):
    """Suma casos 2013->2023 de esa ENT grupo en esa parroquia."""
    g = parr.get("data", {}).get("grupos", {}).get(ent_id)
    if not g:
        return 0, []
    serie = g.get("casos", [])
    return sum(v or 0 for v in serie), serie


def main():
    print("[calcular_mcda_prioridad]")
    ent = json.loads(ENT_JSON.read_text(encoding="utf-8"))
    pob = json.loads(POB_JSON.read_text(encoding="utf-8"))
    poblacion = pob.get("poblacion", {})

    parroquias = ent["parroquias"]
    n_anios = len(ent["anios"])
    print(f"  {len(parroquias)} parroquias · {n_anios} años · {len(ENT_IDS)} ENT")

    # ============ Paso 1 — calcular a_ij (criterio × ENT × parroquia) ============
    # Agregamos todo a la vez para luego normalizar por max nacional
    raw = {}  # raw[dpa][ent] = dict(mortalidad, egresos, avad, tendencia, costo, equidad)
    # equidad: ratio cabecera/rural por cantón (mismo valor para todas las parroquias del cantón)
    cant_cabecera = defaultdict(lambda: 0)
    cant_rural    = defaultdict(lambda: 0)
    for dpa, p in parroquias.items():
        cant = dpa[:4]
        ultimo_dig = dpa[-2:]
        total_cas = sum(
            casos_totales_ent(p, e)[0] for e in ENT_IDS
        )
        if ultimo_dig == "50":   # cabecera cantonal
            cant_cabecera[cant] += total_cas
        else:
            cant_rural[cant] += total_cas

    for dpa, p in parroquias.items():
        pob_val = poblacion.get(dpa, 0)
        raw[dpa] = {}
        cant = dpa[:4]
        for e in ENT_IDS:
            fact = ENT_FACTORES[e]
            total, serie = casos_totales_ent(p, e)
            total_2023 = serie[-1] if serie else 0
            # Criterios crudos
            mort_abs = total_2023 * fact["letalidad"]
            tasa_mort = (mort_abs / pob_val * 100000) if pob_val else 0
            tasa_egr  = (total_2023 / pob_val * 100000) if pob_val else 0
            avad_abs  = total_2023 * fact["avad"]
            tend_pct  = cagr(serie)
            costo_abs = total_2023 * fact["costo"]
            # equidad: ratio cabecera/rural, capped; higher = más concentrado en cabecera
            c_cab = cant_cabecera[cant]
            c_rur = cant_rural[cant] or 1
            equidad = min(c_cab / c_rur, 10.0) / 10.0  # [0, 1]
            raw[dpa][e] = {
                "mortalidad": tasa_mort,
                "egresos": tasa_egr,
                "avad": avad_abs,
                "tendencia": max(0, tend_pct),  # valorar crecimiento
                "costo": costo_abs,
                "equidad": equidad,
            }

    # ============ Paso 2 — normalizar por max nacional ============
    max_por = {k: 0.0 for k in PESOS}
    for dpa, per_ent in raw.items():
        for e, crits in per_ent.items():
            for k in PESOS:
                if crits[k] > max_por[k]:
                    max_por[k] = crits[k]
    print("  Max nacional por criterio:")
    for k, v in max_por.items():
        print(f"    {k:<12} {v:,.2f}")

    # ============ Paso 3 — computar score MCDA ============
    parroquia_out = {}
    parroquia_canton = defaultdict(list)  # cant -> lista de (score[], dpa)
    por_canton_scores = defaultdict(lambda: {e: [] for e in ENT_IDS})

    for dpa, per_ent in raw.items():
        p = parroquias[dpa]
        pob_val = poblacion.get(dpa, 0)
        cant_dpa = dpa[:4]
        scores = []
        for e, crits in per_ent.items():
            normalized = {}
            s = 0.0
            for k, w in PESOS.items():
                a = (crits[k] / max_por[k]) if max_por[k] > 0 else 0.0
                normalized[k] = round(a, 4)
                s += w * a
            scores.append({
                "ent": e,
                "score": round(s, 4),
                "color": ENT_FACTORES[e]["color"],
                "normalized": normalized,
            })
            por_canton_scores[cant_dpa][e].append(s)
        scores.sort(key=lambda x: -x["score"])
        for i, sc in enumerate(scores):
            sc["rank"] = i + 1

        total_casos = sum(
            casos_totales_ent(p, e)[0] for e in ENT_IDS
        )
        parroquia_out[dpa] = {
            "nombre": p.get("nombre", ""),
            "cant": p.get("cant", ""),
            "prov": p.get("prov", ""),
            "pob_2022": pob_val,
            "casos_total": total_casos,
            "fuente": "propia" if total_casos >= UMBRAL_CASOS_PROPIO else "heredada_canton",
            "ranking": scores,
        }

    # ============ Paso 4 — fallback cantonal para parroquias chicas ============
    canton_rank = {}
    for cant, per_ent_scores in por_canton_scores.items():
        # promedio por ENT (proxy del cantón)
        agg = []
        for e in ENT_IDS:
            lst = per_ent_scores[e]
            if not lst:
                continue
            agg.append({
                "ent": e,
                "score": round(sum(lst) / len(lst), 4),
                "color": ENT_FACTORES[e]["color"],
            })
        agg.sort(key=lambda x: -x["score"])
        for i, sc in enumerate(agg):
            sc["rank"] = i + 1
        canton_rank[cant] = agg

    # ============ Paso 4b — agregados por provincia (fallback de 2do nivel) ============
    # Para parroquias sin cantón con data (casos cantonales tambien = 0)
    prov_scores = defaultdict(lambda: {e: [] for e in ENT_IDS})
    for cant, per_ent_scores in por_canton_scores.items():
        prov = cant[:2]
        for e in ENT_IDS:
            prov_scores[prov][e].extend(per_ent_scores[e])
    prov_rank = {}
    for prov, per_ent_scores in prov_scores.items():
        agg = []
        for e in ENT_IDS:
            lst = per_ent_scores[e]
            if not lst:
                continue
            agg.append({"ent": e, "score": round(sum(lst)/len(lst), 4),
                        "color": ENT_FACTORES[e]["color"]})
        agg.sort(key=lambda x: -x["score"])
        for i, sc in enumerate(agg):
            sc["rank"] = i + 1
        prov_rank[prov] = agg

    # Aplicar fallback para parroquias que sí están en ent_parroquial pero con <UMBRAL
    n_heredadas = 0
    for dpa, pr in parroquia_out.items():
        if pr["fuente"] == "heredada_canton":
            cant = dpa[:4]
            prov = dpa[:2]
            if cant in canton_rank and canton_rank[cant]:
                pr["ranking"] = canton_rank[cant]
                n_heredadas += 1
            elif prov in prov_rank and prov_rank[prov]:
                pr["ranking"] = prov_rank[prov]
                pr["fuente"] = "heredada_provincia"
                n_heredadas += 1

    # ============ Paso 4c — cubrir parroquias huerfanas (en shapefile, no en ENT) ============
    # Usa la lista completa de centroides CONALI (1049). Las que no existen en
    # parroquia_out hereden el ranking cantonal; si no hay, del provincial.
    try:
        import geopandas as gpd
        CENTROIDES = PROJECT_ROOT / "inputs" / "shapefiles" / "CENTROIDES_PARROQUIAS" / "CENTROIDES_PARROQUIAS.shp"
        cent = gpd.read_file(CENTROIDES, engine="pyogrio")
        cent["DPA"] = cent["DPA_PARROQ"].astype(str).str.zfill(6)
        cent = cent[cent["DPA"].str.match(r"^\d{6}$")]
        n_huerf = 0
        for _, r in cent.iterrows():
            dpa = r["DPA"]
            if dpa in parroquia_out:
                continue
            cant = dpa[:4]; prov = dpa[:2]
            if cant in canton_rank and canton_rank[cant]:
                ranking = canton_rank[cant]; fuente = "heredada_canton"
            elif prov in prov_rank and prov_rank[prov]:
                ranking = prov_rank[prov]; fuente = "heredada_provincia"
            else:
                ranking = []; fuente = "sin_data"
            parroquia_out[dpa] = {
                "nombre": str(r.get("DPA_DESPAR", "") or ""),
                "cant":   str(r.get("DPA_DESCAN", "") or ""),
                "prov":   str(r.get("DPA_DESPRO", "") or ""),
                "pob_2022": poblacion.get(dpa, 0),
                "casos_total": 0,
                "fuente": fuente,
                "ranking": ranking,
            }
            n_huerf += 1
        print(f"  Parroquias huerfanas (no estaban en ENT) agregadas: {n_huerf}")
    except Exception as e:
        print(f"  AVISO: no se pudo cargar CENTROIDES para completar huerfanas: {e}")

    print(f"  Parroquias con ranking heredado: {n_heredadas}")
    print(f"  Parroquias con ranking propio: {sum(1 for p in parroquia_out.values() if p['fuente']=='propia')}")
    print(f"  Total parroquias MCDA: {len(parroquia_out)}")

    # QA: top-1 nacional
    cuenta_top1 = defaultdict(int)
    for pr in parroquia_out.values():
        if pr["ranking"]:
            cuenta_top1[pr["ranking"][0]["ent"]] += 1
    print("\n  Distribucion de ENT #1 (QA):")
    for e, n in sorted(cuenta_top1.items(), key=lambda x: -x[1]):
        print(f"    {e:<14} {n} parroquias")

    out = {
        "_meta": {
            "es_simulacion": True,
            "metodologia": (
                "MCDA suma ponderada (Marsh/ISPOR 2016, Baltussen 2006) aplicado a "
                "nivel parroquial. Para parroquias con <10 casos totales 2013-2023 "
                "el ranking se hereda del canton para reducir ruido. Reemplazar con "
                "los resultados del Proyecto INSPI F-I+D+i-075 de Priorizacion MCDA "
                "(Duque 2026-2028) cuando esten disponibles. Pesos editables para "
                "analisis de sensibilidad."
            ),
            "nivel": "parroquial_con_fallback_cantonal",
            "umbral_casos_propio": UMBRAL_CASOS_PROPIO,
        },
        "criterios": [
            {"id":"mortalidad","peso":PESOS["mortalidad"],"nombre":"Tasa de mortalidad ×100k"},
            {"id":"egresos",   "peso":PESOS["egresos"],   "nombre":"Tasa de egresos ×100k"},
            {"id":"avad",      "peso":PESOS["avad"],      "nombre":"Carga AVAD (GBD)"},
            {"id":"tendencia", "peso":PESOS["tendencia"], "nombre":"Tendencia CAGR 2015→2023"},
            {"id":"costo",     "peso":PESOS["costo"],     "nombre":"Costo al sistema (OPS)"},
            {"id":"equidad",   "peso":PESOS["equidad"],   "nombre":"Brecha urbano-rural"},
        ],
        "ent_factores": ENT_FACTORES,
        "parroquias": parroquia_out,
        "cantones_agregados": canton_rank,
    }
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    kb = OUT_JSON.stat().st_size // 1024
    print(f"\n  OK -> {OUT_JSON} ({kb} KB)")


if __name__ == "__main__":
    main()
