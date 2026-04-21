"""
generar_provincias_geojson.py
==============================

Convierte el shapefile oficial INEC ``ORGANIZACION_TERRITORIAL_PROVINCIAL``
(EPSG:32717) a ``provincias_otp.geojson`` (WGS84), para usarlo como overlay
de delimitación provincial en el visor.

Uso: ``python generar_provincias_geojson.py``
"""
from __future__ import annotations
from pathlib import Path

import geopandas as gpd

HERE = Path(__file__).parent
PROJECT_ROOT = HERE.parent
SHP_IN = (PROJECT_ROOT / "inputs" / "shapefiles"
          / "ORGANIZACION_TERRITORIAL_PROVINCIAL"
          / "ORGANIZACION_TERRITORIAL_PROVINCIAL.shp")
GEOJSON_OUT = PROJECT_ROOT / "webapp" / "assets" / "provincias_otp.geojson"


def main():
    print(f"Leyendo {SHP_IN.name} ...")
    g = gpd.read_file(SHP_IN, engine="pyogrio")
    print(f"  {len(g)} provincias · CRS {g.crs}")

    g = g.to_crs(4326)  # a WGS84 para Leaflet
    # Filtrar entidades espurias (zonas en estudio, etc.)
    g["DPA_PROVIN"] = g["DPA_PROVIN"].astype(str).str.zfill(2)
    g = g[g["DPA_PROVIN"].str.match(r"^\d{2}$")].copy()
    g = g[~g["DPA_PROVIN"].isin(["90", "99"])]

    # Simplificación leve (0.0008° ≈ 90 m). Preserva fronteras amazónicas
    # donde los ríos marcan límites provinciales sinuosos (p. ej. Orellana-
    # Pastaza, Napo-Sucumbíos). Tolerancia mayor introduce huecos visibles.
    g["geometry"] = g.geometry.simplify(0.0008, preserve_topology=True)

    keep = ["DPA_PROVIN", "DPA_DESPRO", "geometry"]
    g[keep].to_file(GEOJSON_OUT, driver="GeoJSON", engine="pyogrio")
    kb = GEOJSON_OUT.stat().st_size // 1024
    print(f"\nOK -> {GEOJSON_OUT}  ({kb} KB)")
    for _, r in g.sort_values("DPA_PROVIN").iterrows():
        print(f"  {r['DPA_PROVIN']}  {r['DPA_DESPRO']}")


if __name__ == "__main__":
    main()
