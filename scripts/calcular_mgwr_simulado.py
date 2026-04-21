"""
calcular_mgwr_simulado.py
==========================

Simula los betas locales de una **Regresión Geográficamente Ponderada
Multiescala (MGWR, Oshan et al. 2020)** por parroquia y ENT. Los betas
nacionales base provienen de literatura (GBD 2021, Lancet Planetary Health
2022 para PM2.5-respiratorio, Lancet Diabetes 2020 para obesidad-DM2). La
variación espacial se genera con kernels gaussianos anclados en focos
reales (Quito, Guayaquil, Ambato/Cuenca para PM2.5; Amazonía para pobreza;
Costa urbana para obesidad) usando los centroides parroquiales (EPSG:32717).

Preview del Proyecto Econométrico Espacial INSPI F-I+D+i-075
(Núñez-ESPE 2026-2027). Reemplazar cuando se ejecute.

Dependencias: pip install geopandas pyogrio numpy
Uso:          python calcular_mgwr_simulado.py
"""

from __future__ import annotations
import json
import math
import random
from pathlib import Path

import numpy as np
import geopandas as gpd

HERE = Path(__file__).parent
PROJECT_ROOT = HERE.parent
CENTROIDES = (PROJECT_ROOT / "inputs" / "shapefiles"
              / "CENTROIDES_PARROQUIAS" / "CENTROIDES_PARROQUIAS.shp")
OUT_JSON = PROJECT_ROOT / "webapp" / "assets" / "mgwr_betas.json"

random.seed(20260421)
np.random.seed(20260421)

ENTS = ["circulatorio", "neoplasia", "metabolica", "respiratorio", "nervioso"]
DETS = ["pobreza", "pm25", "sedentarismo", "acceso_salud_km", "obesidad", "tabaquismo"]

# Betas nacionales base (OLS simulado, plausibles de literatura)
# Signo: + aumenta riesgo, - protector
BETA_BASE = {
    "circulatorio":  {"pobreza": 0.28, "pm25": 0.22, "sedentarismo": 0.20, "acceso_salud_km":  0.12, "obesidad": 0.30, "tabaquismo": 0.25},
    "neoplasia":     {"pobreza": 0.15, "pm25": 0.18, "sedentarismo": 0.12, "acceso_salud_km":  0.18, "obesidad": 0.20, "tabaquismo": 0.35},
    "metabolica":    {"pobreza": 0.22, "pm25": 0.10, "sedentarismo": 0.38, "acceso_salud_km":  0.15, "obesidad": 0.48, "tabaquismo": 0.12},
    "respiratorio":  {"pobreza": 0.25, "pm25": 0.45, "sedentarismo": 0.08, "acceso_salud_km":  0.20, "obesidad": 0.10, "tabaquismo": 0.32},
    "nervioso":      {"pobreza": 0.20, "pm25": 0.15, "sedentarismo": 0.18, "acceso_salud_km":  0.10, "obesidad": 0.18, "tabaquismo": 0.15},
}

# Focos de anclaje (x, y UTM-17S) — el determinante pesa más cerca del foco
# Coordenadas aprox. de centros urbanos y regionales.
ANCHORS = {
    "pm25":            [(780000, 9977000, 60000), (624000, 9755000, 60000), (764000, 9862000, 40000)],  # Quito, Guayaquil, Ambato
    "obesidad":        [(624000, 9755000, 80000), (655000, 9635000, 80000), (580000, 9590000, 70000)],  # Guayaquil, Machala, Manta
    "pobreza":         [(950000, 9950000, 180000),(900000, 9850000, 180000),(1050000,9900000,180000)],  # Amazonia (Sucumbios, Orellana, Napo)
    "sedentarismo":    [(780000, 9977000, 90000), (624000, 9755000, 90000), (720000, 9680000, 70000)],  # urbano Sierra/Costa
    "acceso_salud_km": [(950000, 9900000, 200000),(1020000,9700000,200000)],  # Oriente profundo
    "tabaquismo":      [(780000, 9977000, 100000),(720000, 9680000, 90000)],  # Sierra urbana
}

# Amplitud local (cuánto puede crecer el β respecto al base en el foco)
GAIN_LOCAL = 1.8


def kernel_factor(x, y, anchors):
    """Factor 1.0 + (GAIN_LOCAL-1) * max_i(exp(-d_i^2/(2*bw_i^2)))."""
    if not anchors:
        return 1.0
    best = 0.0
    for (ax, ay, bw) in anchors:
        d2 = (x - ax) ** 2 + (y - ay) ** 2
        k = math.exp(-d2 / (2 * bw * bw))
        if k > best:
            best = k
    return 1.0 + (GAIN_LOCAL - 1.0) * best


def main():
    print("[calcular_mgwr_simulado]")
    cent = gpd.read_file(CENTROIDES, engine="pyogrio")
    cent["DPA"] = cent["DPA_PARROQ"].astype(str).str.zfill(6)
    cent = cent[cent["DPA"].str.match(r"^\d{6}$")].copy()
    cent_m = cent.to_crs(32717)
    print(f"  {len(cent_m)} centroides UTM-17S")

    parroquias_out = {}
    r2_vals = []
    for _, r in cent_m.iterrows():
        dpa = r["DPA"]
        x, y = r.geometry.x, r.geometry.y
        betas = {}
        for ent in ENTS:
            b_ent = {}
            for det in DETS:
                base = BETA_BASE[ent][det]
                fac = kernel_factor(x, y, ANCHORS.get(det, []))
                noise = 1.0 + random.gauss(0, 0.07)
                v = base * fac * noise
                b_ent[det] = round(v, 3)
            betas[ent] = b_ent
        # R² local: más alto donde más determinantes "activos" localmente
        ent1 = "circulatorio"
        sum_abs = sum(abs(v) for v in betas[ent1].values())
        r2 = 0.45 + min(0.45, (sum_abs - 1.2) * 0.35) + random.gauss(0, 0.03)
        r2 = max(0.30, min(0.92, r2))
        r2_vals.append(r2)
        parroquias_out[dpa] = {
            "r2_local": round(r2, 3),
            "betas": betas,
        }

    print(f"  R² local: min {min(r2_vals):.2f} · mediana {sorted(r2_vals)[len(r2_vals)//2]:.2f} · max {max(r2_vals):.2f}")

    out = {
        "_meta": {
            "es_simulacion": True,
            "metodologia": (
                "MGWR simulado (Oshan et al. 2020) con betas nacionales base "
                "(GBD 2021, Lancet Planetary Health 2022) moduladas por kernel "
                "gaussiano geografico anclado en focos reales (Quito/Guayaquil/"
                "Ambato para PM2.5; Amazonia para pobreza; Costa urbana para "
                "obesidad). Reemplazar con resultados del Proyecto INSPI "
                "F-I+D+i-075 (Nunez-ESPE 2026-2027)."
            ),
            "ents": ENTS,
            "determinantes_modelados": DETS,
            "gain_local": GAIN_LOCAL,
        },
        "ents": ENTS,
        "determinantes_modelados": DETS,
        "parroquias": parroquias_out,
    }
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    kb = OUT_JSON.stat().st_size // 1024
    print(f"\n  OK -> {OUT_JSON} ({kb} KB) · {len(parroquias_out)} parroquias")


if __name__ == "__main__":
    main()
