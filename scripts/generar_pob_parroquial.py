"""
generar_pob_parroquial.py  (v2)
================================

Genera ``pob_parroquial.json`` con la población oficial INEC del Censo de
Población y Vivienda 2022, vinculando cada parroquia con su DPA_PARROQ del
GeoJSON CONALI mediante match por triple (provincia + cantón + parroquia)
normalizado.

Fuente: ``2022_CPV_NACIONAL_DENSIDAD_POBLACIONAL.xlsx`` (INEC).
Cobertura: ~99.8% de las parroquias (2 sin match por nombres de cantón que
difieren entre INEC y CONALI; se reportan).
"""

from __future__ import annotations
import json
import unicodedata
from pathlib import Path

import pandas as pd

HERE = Path(__file__).parent
PROJECT_ROOT = HERE.parent
INPUTS       = PROJECT_ROOT / "inputs"
INTERMEDIATE = PROJECT_ROOT / "intermediate"
ASSETS       = PROJECT_ROOT / "webapp" / "assets"

CPV     = INPUTS / "2022_CPV_NACIONAL_DENSIDAD_POBLACIONAL.xlsx"
GEOJSON = ASSETS / "parroquias_otp_simpl.geojson"
OUT     = INTERMEDIATE / "pob_parroquial.json"


def norm(s) -> str:
    if s is None:
        return ""
    s = str(s).upper().strip()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("Ñ", "N").replace("\xa0", " ").replace("�", "")
    return " ".join(s.split())


def main():
    print(f"[pob_parroquial v2]  CPV 2022")
    df = pd.read_excel(CPV, sheet_name=0, header=None, skiprows=17)
    df = df[[1, 2, 3, 4, 5, 6]].dropna(how="all").copy()
    df.columns = ["prov", "cant", "parr", "pob", "sup", "dens"]
    df = df.dropna(subset=["prov", "cant", "parr", "pob"])
    for c in ("prov", "cant", "parr"):
        df[c + "_n"] = df[c].apply(norm)
    print(f"  CPV: {len(df)} filas · {df['prov_n'].nunique()} provincias")

    geo = json.loads(GEOJSON.read_text(encoding="utf-8"))
    g_rows = []
    for f in geo["features"]:
        p = f["properties"]
        g_rows.append({
            "dpa":    str(p.get("DPA_PARROQ", "")).zfill(6),
            "prov_n": norm(p.get("DPA_DESPRO", "")),
            "cant_n": norm(p.get("DPA_DESCAN", "")),
            "parr_n": norm(p.get("DPA_DESPAR", "")),
            "prov_nombre": p.get("DPA_DESPRO", ""),
            "cant_nombre": p.get("DPA_DESCAN", ""),
            "parr_nombre": p.get("DPA_DESPAR", ""),
        })
    g = pd.DataFrame(g_rows)
    print(f"  GeoJSON: {len(g)} polígonos")

    # Match por triple normalizado
    m = df.merge(g, on=["prov_n", "cant_n", "parr_n"], how="inner")
    print(f"  Match exacto: {len(m)}/{len(df)} ({len(m)/len(df)*100:.2f}%)")

    no_match = df[~df.set_index(["prov_n", "cant_n", "parr_n"]).index.isin(
        m.set_index(["prov_n", "cant_n", "parr_n"]).index
    )]
    if len(no_match):
        print(f"  Sin match: {len(no_match)}")
        for _, r in no_match.iterrows():
            print(f"    - {r['prov']} / {r['cant']} / {r['parr']} (pob={int(r['pob'])})")

    # Construir salida: DPA -> pob
    pob = {}
    meta = {}
    for _, r in m.iterrows():
        dpa = r["dpa"]
        pob[dpa] = int(r["pob"])
        meta[dpa] = {
            "superficie_km2": float(r["sup"]) if pd.notna(r["sup"]) else None,
            "densidad":       float(r["dens"]) if pd.notna(r["dens"]) else None,
        }

    # Parroquias del GeoJSON que no están en CPV (cruce inverso) — marcar
    no_cpv = g[~g["dpa"].isin(pob.keys())]
    if len(no_cpv):
        print(f"  Parroquias en GeoJSON sin pob CPV: {len(no_cpv)}")
        for _, r in no_cpv.head(10).iterrows():
            print(f"    - DPA {r['dpa']} {r['prov_nombre']} / {r['cant_nombre']} / {r['parr_nombre']}")

    out = {
        "_meta": {
            "fuente": "INEC · Censo de Población y Vivienda 2022 · Tabla 3 Densidad poblacional",
            "archivo": CPV.name,
            "match_exacto": f"{len(m)}/{len(df)} ({len(m)/len(df)*100:.2f}%)",
            "cobertura_geojson": f"{len(pob)}/{len(g)} ({len(pob)/len(g)*100:.2f}%)",
        },
        "poblacion": pob,
        "extra": meta,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(f"\n  OK -> {OUT} ({OUT.stat().st_size // 1024} KB)")
    print(f"  Total parroquias con pob real CPV 2022: {len(pob)}")
    print(f"  Poblacion total cubierta: {sum(pob.values()):,}")


if __name__ == "__main__":
    main()
