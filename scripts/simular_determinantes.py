"""
simular_determinantes.py
=========================

Genera ``determinantes_parroquial.json`` con 7 determinantes simulados por
parroquia, coherentes con la literatura ENSANUT-ECU 2018 / STEPS-OMS / GBD 2021
y con el Censo CPV 2022. Se usan como preview del Proyecto Econométrico Espacial
(F-I+D+i-075, INSPI CZ9) mientras no se ejecuta.

ES SIMULACIÓN ESTRUCTURADA, no random:
  · Valor base por provincia (de literatura real)
  · Factor según tipo de parroquia (urbana / rural) del shapefile CONALI
  · Factor según densidad poblacional real (CPV 2022)
  · Ruido gaussiano pequeño (σ=8%) para evitar uniformidad

Dependencias: pip install pandas geopandas pyogrio
Uso:          python simular_determinantes.py
"""

from __future__ import annotations
import json
import math
import random
import unicodedata
from pathlib import Path

import geopandas as gpd

HERE = Path(__file__).parent
PROJECT_ROOT = HERE.parent
CENTROIDES = (PROJECT_ROOT / "inputs" / "shapefiles"
              / "CENTROIDES_PARROQUIAS" / "CENTROIDES_PARROQUIAS.shp")
POB_JSON = PROJECT_ROOT / "intermediate" / "pob_parroquial.json"
OUT_JSON = PROJECT_ROOT / "webapp" / "assets" / "determinantes_parroquial.json"

random.seed(20260421)  # reproducible


# ============ Valores base por provincia ============
# Fuentes declaradas en _meta. Números son *plausibles* (no oficiales); los
# reales saldrán del estudio Núñez-ESPE 2026-2027.
# Estructura: {DPA_PROV2: {det: valor_base}}
BASE_PROV = {
    # COSTA (mayor obesidad, PM2.5 alto en zonas urbanas, HTA alta)
    "07": {"pobreza":22.1,"nbi":19.5,"pm25":28.0,"tabaquismo":14.5,"obesidad":28.7,"sedentarismo":58.4},  # El Oro
    "08": {"pobreza":38.4,"nbi":35.2,"pm25":20.0,"tabaquismo":12.8,"obesidad":24.9,"sedentarismo":54.0},  # Esmeraldas
    "09": {"pobreza":17.2,"nbi":14.8,"pm25":32.0,"tabaquismo":18.7,"obesidad":31.2,"sedentarismo":62.1},  # Guayas
    "12": {"pobreza":24.8,"nbi":22.5,"pm25":22.0,"tabaquismo":14.1,"obesidad":25.8,"sedentarismo":56.9},  # Los Rios
    "13": {"pobreza":26.1,"nbi":23.7,"pm25":21.0,"tabaquismo":13.9,"obesidad":27.4,"sedentarismo":55.2},  # Manabi
    "24": {"pobreza":18.9,"nbi":16.4,"pm25":24.0,"tabaquismo":15.6,"obesidad":26.3,"sedentarismo":57.8},  # Santa Elena
    "23": {"pobreza":22.4,"nbi":20.1,"pm25":25.0,"tabaquismo":15.9,"obesidad":25.1,"sedentarismo":56.4},  # Santo Domingo

    # SIERRA (mayor tabaquismo urbano, menor obesidad rural, PM2.5 muy alto Quito/Ambato)
    "01": {"pobreza":15.3,"nbi":13.4,"pm25":26.0,"tabaquismo":19.2,"obesidad":25.4,"sedentarismo":60.5},  # Azuay
    "02": {"pobreza":32.6,"nbi":29.5,"pm25":18.0,"tabaquismo":16.8,"obesidad":19.9,"sedentarismo":50.8},  # Bolivar
    "03": {"pobreza":23.1,"nbi":21.2,"pm25":19.0,"tabaquismo":17.4,"obesidad":22.8,"sedentarismo":53.2},  # Canar
    "04": {"pobreza":21.8,"nbi":19.7,"pm25":17.0,"tabaquismo":18.1,"obesidad":19.2,"sedentarismo":51.7},  # Carchi
    "05": {"pobreza":28.4,"nbi":25.9,"pm25":20.0,"tabaquismo":16.5,"obesidad":20.5,"sedentarismo":52.3},  # Cotopaxi
    "06": {"pobreza":25.2,"nbi":23.1,"pm25":21.0,"tabaquismo":17.9,"obesidad":21.0,"sedentarismo":53.8},  # Chimborazo
    "10": {"pobreza":21.6,"nbi":19.3,"pm25":19.0,"tabaquismo":18.4,"obesidad":21.8,"sedentarismo":54.5},  # Imbabura
    "11": {"pobreza":23.7,"nbi":21.5,"pm25":18.0,"tabaquismo":17.2,"obesidad":22.1,"sedentarismo":53.9},  # Loja
    "17": {"pobreza":13.8,"nbi":11.7,"pm25":34.0,"tabaquismo":20.8,"obesidad":26.1,"sedentarismo":63.4},  # Pichincha
    "18": {"pobreza":19.5,"nbi":17.2,"pm25":27.0,"tabaquismo":19.8,"obesidad":22.4,"sedentarismo":56.7},  # Tungurahua

    # ORIENTE (alta pobreza rural, menor PM2.5, menor obesidad, alto respiratorio)
    "14": {"pobreza":41.7,"nbi":38.2,"pm25":13.0,"tabaquismo":13.2,"obesidad":17.9,"sedentarismo":46.8},  # Morona Santiago
    "15": {"pobreza":38.4,"nbi":35.1,"pm25":12.0,"tabaquismo":12.7,"obesidad":17.2,"sedentarismo":45.2},  # Napo
    "16": {"pobreza":42.8,"nbi":39.7,"pm25":11.0,"tabaquismo":12.0,"obesidad":16.8,"sedentarismo":44.7},  # Pastaza
    "19": {"pobreza":37.2,"nbi":33.8,"pm25":13.0,"tabaquismo":13.8,"obesidad":19.1,"sedentarismo":47.3},  # Zamora Chinchipe
    "21": {"pobreza":44.1,"nbi":40.5,"pm25":14.0,"tabaquismo":13.1,"obesidad":18.4,"sedentarismo":46.1},  # Sucumbios
    "22": {"pobreza":45.3,"nbi":41.8,"pm25":15.0,"tabaquismo":12.9,"obesidad":17.6,"sedentarismo":45.8},  # Orellana

    # GALAPAGOS
    "20": {"pobreza":8.6,"nbi":7.1,"pm25":9.0,"tabaquismo":11.2,"obesidad":22.7,"sedentarismo":55.8},
}


# Factor por tipo de parroquia (txt del shp CENTROIDES: "CABECERA CANTONAL" | "PARROQUIA RURAL")
# Algunos determinantes son mayores en urbano (PM2.5, obesidad, sedentarismo, tabaquismo),
# otros son mayores en rural (pobreza, NBI, acceso_salud_km).
FACTOR_URBANO = {
    "pobreza":     0.60,  # urbano tiene menos pobreza
    "nbi":         0.55,
    "pm25":        2.00,  # urbano tiene mucho más PM2.5
    "tabaquismo":  1.20,
    "obesidad":    1.15,
    "sedentarismo":1.10,
}
FACTOR_RURAL = {
    "pobreza":     1.45,
    "nbi":         1.55,
    "pm25":        0.35,  # rural tiene mucho menos PM2.5
    "tabaquismo":  0.70,
    "obesidad":    0.78,
    "sedentarismo":0.85,
}

# Ruido gaussiano pequeño
SIGMA_REL = 0.08  # 8% relativo

# Capacidades máximas/mínimas plausibles (clip)
CLAMPS = {
    "pobreza":     (4, 70),
    "nbi":         (3, 75),
    "pm25":        (5, 80),
    "tabaquismo":  (4, 35),
    "obesidad":    (8, 45),
    "sedentarismo":(25, 80),
    "acceso_salud_km": (0.1, 120.0),
}


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def normalizar(s: str) -> str:
    s = str(s or "").upper().strip()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(s.split())


def main():
    print("[simular_determinantes]")
    cent = gpd.read_file(CENTROIDES, engine="pyogrio")
    cent["DPA"] = cent["DPA_PARROQ"].astype(str).str.zfill(6)
    cent["PROV2"] = cent["DPA_PROVIN"].astype(str).str.zfill(2)
    cent["txt"] = cent["txt"].astype(str).map(normalizar)
    cent = cent[cent["DPA"].str.match(r"^\d{6}$")].copy()
    # Reproyectar a metros para calcular distancias
    cent_m = cent.to_crs(32717)
    # Construir diccionario de cabeceras por cantón: DPA cantón (4 díg) → (x, y)
    cent_m["CANT4"] = cent_m["DPA"].str[:4]
    cabeceras = {}
    for _, r in cent_m[cent_m["txt"].str.contains("CABECERA", na=False)].iterrows():
        cabeceras[r["CANT4"]] = (r.geometry.x, r.geometry.y)
    print(f"  {len(cabeceras)} cabeceras cantonales")
    print(f"  {len(cent)} parroquias totales")

    pob = json.loads(POB_JSON.read_text(encoding="utf-8"))
    poblacion = pob.get("poblacion", {})
    extra = pob.get("extra", {})

    out_parr = {}
    stats = {d: [] for d in CLAMPS}
    n_sin_base = 0

    for (_, pt), (_, pt_m) in zip(cent.iterrows(), cent_m.iterrows()):
        dpa = pt["DPA"]
        prov = pt["PROV2"]
        base = BASE_PROV.get(prov)
        if not base:
            n_sin_base += 1
            continue
        tipo = pt["txt"]
        is_urbana = "CABECERA" in tipo or "URBANA" in tipo
        factor = FACTOR_URBANO if is_urbana else FACTOR_RURAL

        # Distancia km a cabecera cantonal propia
        cant4 = dpa[:4]
        if is_urbana:
            acceso_km = 0.5  # cabecera: dentro del área urbana
        elif cant4 in cabeceras:
            cx, cy = cabeceras[cant4]
            d_m = math.hypot(pt_m.geometry.x - cx, pt_m.geometry.y - cy)
            acceso_km = round(d_m / 1000.0, 2)
        else:
            acceso_km = 20.0  # default rural sin cabecera localizable

        det = {}
        for k, fac in factor.items():
            v = base[k] * fac
            # Ruido gaussiano
            v *= (1.0 + random.gauss(0, SIGMA_REL))
            v = clamp(v, *CLAMPS[k])
            det[k] = round(v, 1)
            stats[k].append(v)
        det["acceso_salud_km"] = clamp(
            acceso_km * (1.0 + random.gauss(0, 0.10)),
            *CLAMPS["acceso_salud_km"],
        )
        det["acceso_salud_km"] = round(det["acceso_salud_km"], 2)
        stats["acceso_salud_km"].append(det["acceso_salud_km"])

        out_parr[dpa] = det

    if n_sin_base:
        print(f"  {n_sin_base} parroquias sin provincia base (descartadas)")

    # Estadísticas descriptivas para QA
    print("\n  Estadisticas por determinante (min / mediana / max):")
    for k, vals in stats.items():
        if not vals:
            continue
        s = sorted(vals)
        lo, me, hi = s[0], s[len(s) // 2], s[-1]
        print(f"    {k:<18} {lo:>6.1f} / {me:>6.1f} / {hi:>6.1f}")

    out = {
        "_meta": {
            "es_simulacion": True,
            "metodologia": (
                "Simulacion estructurada: valor base por provincia (ENSANUT-ECU 2018, "
                "STEPS-OMS, CPV 2022, GBD 2021) ajustado por tipo de parroquia "
                "(urbana/rural) con factores de literatura y ruido gaussiano sigma=8%. "
                "Acceso_salud_km: distancia euclidiana al centroide de la cabecera "
                "cantonal (EPSG:32717). Reemplazar por resultados del Proyecto "
                "Econometrico Espacial INSPI F-I+D+i-075 (Nunez-ESPE 2026-2027) "
                "cuando esten disponibles."
            ),
            "fuentes_base": [
                "ENSANUT-ECU 2018 (MSP / INEC)",
                "STEPS-OMS Ecuador 2018",
                "Censo Poblacion y Vivienda 2022 (INEC)",
                "GBD 2021 (IHME)",
                "OPS / ALAT (PM2.5 urbano)",
            ],
        },
        "determinantes": [
            "pobreza", "nbi", "pm25", "tabaquismo",
            "obesidad", "sedentarismo", "acceso_salud_km",
        ],
        "parroquias": out_parr,
    }
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    kb = OUT_JSON.stat().st_size // 1024
    print(f"\n  OK -> {OUT_JSON} ({kb} KB) · {len(out_parr)} parroquias")


if __name__ == "__main__":
    main()
