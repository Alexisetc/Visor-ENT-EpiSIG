"""
build_pob_cantonal.py
======================

Procesa las proyecciones cantonales INEC 2010-2035 (Rev. 2024) desde un
archivo Excel con 24 hojas provinciales, y produce un JSON plano por
DPA4 con la serie anual completa.

Entrada
-------
``inputs/poblacion/raw/proyecciones_cantonales_INEC.xlsx``

Estructura del libro
--------------------
* 25 hojas : ``Indice`` (descartada) + 24 provincias.
* Cada hoja provincial:
    - ``skiprows=14`` para posicionar el header lógico (primera fila = total provincial).
    - Col 0 : vacía (margen del estilo).
    - Col 1 : nombre cantón (primera fila = nombre provincia / total provincial; se descarta).
    - Col 2..27 : 26 años 2010..2035 (anuales, NO quinquenios).

Salida
------
``intermediate/pob_cantonal_anual.json``
Estructura:
    {
        "_meta": {...},
        "anios": [2010, ..., 2035],
        "poblacion": {"0101": [pob_2010, ..., pob_2035], ...}
    }

Uso
---
    python -m scripts.ent_pipeline.population.build_pob_cantonal
"""

from __future__ import annotations

import json
import sys
import unicodedata
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parents[2]
INPUTS_RAW = PROJECT_ROOT / "inputs" / "poblacion" / "raw"
INTERMEDIATE = PROJECT_ROOT / "intermediate"
GEOJSON = PROJECT_ROOT / "webapp" / "assets" / "parroquias_otp_simpl.geojson"

XLSX_IN = INPUTS_RAW / "proyecciones_cantonales_INEC.xlsx"
OUT_JSON = INTERMEDIATE / "pob_cantonal_anual.json"

ANIOS = list(range(2010, 2036))  # 2010..2035 inclusive -> 26 valores.
SKIPROWS = 14

# Aliases INEC → CONALI-DPA cuando el nombre del cantón difiere.
# Clave: (provincia_norm, canton_norm) tal como viene en el Excel INEC.
# Valor: (provincia_norm, canton_norm) tal como aparece en el GeoJSON DPA.
CANT_ALIASES: dict[tuple[str, str], tuple[str, str]] = {
    ("PICHINCHA", "QUITO"): ("PICHINCHA", "DISTRITO METROPOLITANO DE QUITO"),
    ("ORELLANA", "ORELLANA"): ("ORELLANA", "FRANCISCO DE ORELLANA"),
}


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def norm(s) -> str:
    if s is None:
        return ""
    s = str(s).upper().strip()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("Ñ", "N").replace("\xa0", " ").replace("\ufeff", "").replace("�", "")
    return " ".join(s.split())


def construir_dict_cantones() -> tuple[dict[tuple[str, str], str], dict[str, tuple[str, str]]]:
    """
    Retorna:
      - cant_to_dpa4   : (prov_norm, cant_norm) -> DPA4
      - dpa4_nombre    : DPA4 -> (prov_nombre_original, cant_nombre_original)
    """
    geo = json.loads(GEOJSON.read_text(encoding="utf-8"))
    cant_to_dpa4: dict[tuple[str, str], str] = {}
    dpa4_nombre: dict[str, tuple[str, str]] = {}
    for f in geo["features"]:
        p = f["properties"]
        dpa6 = str(p.get("DPA_PARROQ", "")).zfill(6)
        if len(dpa6) != 6 or not dpa6.isdigit():
            continue
        dpa4 = dpa6[:4]
        prov_raw = p.get("DPA_DESPRO", "")
        cant_raw = p.get("DPA_DESCAN", "")
        key = (norm(prov_raw), norm(cant_raw))
        cant_to_dpa4[key] = dpa4
        dpa4_nombre.setdefault(dpa4, (str(prov_raw), str(cant_raw)))
    log(f"  GeoJSON -> {len(cant_to_dpa4)} cantones (DPA4) de referencia")
    return cant_to_dpa4, dpa4_nombre


def es_fila_total_provincial(nombre_norm: str, sheet_norm: str) -> bool:
    """Detecta la primera fila de la hoja (total provincial)."""
    if not nombre_norm:
        return True
    if nombre_norm == sheet_norm:
        return True
    # Evita encabezados sueltos tipo "TOTAL", "SUBTOTAL", "PROVINCIA".
    for prefijo in ("TOTAL", "SUBTOTAL", "PROVINCIA"):
        if nombre_norm.startswith(prefijo):
            return True
    return False


def provincia_del_sheet(sheet_name: str) -> str:
    """
    Devuelve el nombre canónico (DPA) de la provincia asociada a una hoja.
    Aplica aliases de nombre conocidos (Cañar, Manabí, Los Ríos...).
    """
    sheet_alias = {
        "CAÑAR": "CAÑAR",
        "CANAR": "CAÑAR",
        "BOLIVAR": "BOLIVAR",
        "LOS RIOS": "LOS RIOS",
        "MANABI": "MANABI",
        "GALAPAGOS": "GALAPAGOS",
        "SUCUMBIOS": "SUCUMBIOS",
        "SANTO DOMINGO": "SANTO DOMINGO DE LOS TSACHILAS",
        "SANTA ELENA": "SANTA ELENA",
        "MORONA": "MORONA SANTIAGO",
        "NAPO": "NAPO",
        "PASTAZA": "PASTAZA",
        "ZAMORA": "ZAMORA CHINCHIPE",
        "AZUAY": "AZUAY",
        "CARCHI": "CARCHI",
        "COTOPAXI": "COTOPAXI",
        "CHIMBORAZO": "CHIMBORAZO",
        "EL ORO": "EL ORO",
        "ESMERALDAS": "ESMERALDAS",
        "GUAYAS": "GUAYAS",
        "IMBABURA": "IMBABURA",
        "LOJA": "LOJA",
        "PICHINCHA": "PICHINCHA",
        "TUNGURAHUA": "TUNGURAHUA",
        "ORELLANA": "ORELLANA",
    }
    return sheet_alias.get(norm(sheet_name), norm(sheet_name))


def main() -> int:
    if not XLSX_IN.exists():
        log(f"[ERROR] No existe el XLSX de entrada: {XLSX_IN}")
        return 2
    if not GEOJSON.exists():
        log(f"[ERROR] No existe el GeoJSON de referencia: {GEOJSON}")
        return 2

    INTERMEDIATE.mkdir(parents=True, exist_ok=True)

    log("=" * 78)
    log("[build_pob_cantonal] Proyecciones cantonales INEC 2010-2035")
    log(f"  Input : {XLSX_IN}")
    log("=" * 78)

    cant_to_dpa4, dpa4_nombre = construir_dict_cantones()

    xls = pd.ExcelFile(XLSX_IN)
    sheets_provinciales = [s for s in xls.sheet_names if norm(s) != "INDICE"]
    log(f"  Hojas provinciales: {len(sheets_provinciales)}")

    poblacion: dict[str, list[int]] = {}
    no_match: list[tuple[str, str]] = []
    matched_aliases: list[tuple[str, str, str, str]] = []
    n_filas_leidas = 0

    for sheet in sheets_provinciales:
        prov_canonica = provincia_del_sheet(sheet)
        prov_norm = norm(prov_canonica)
        sheet_norm = norm(sheet)

        df = pd.read_excel(
            XLSX_IN,
            sheet_name=sheet,
            header=None,
            skiprows=SKIPROWS,
            engine="openpyxl",
        )
        if df.shape[1] < 28:
            log(f"  [WARN] sheet '{sheet}': shape={df.shape} (se esperaban 28 cols). Se recorta.")
        # Cols: 0 vacía, 1 nombre, 2..27 son los 26 años.
        # La PRIMERA fila con nombre no-vacío es el total provincial (se descarta).
        # A partir de ahí, solo se filtran encabezados espurios tipo TOTAL/SUBTOTAL/PROVINCIA.
        total_row_seen = False
        for _, row in df.iterrows():
            nombre = row[1] if len(row) > 1 else None
            if not pd.notna(nombre):
                continue
            nombre_norm = norm(nombre)
            if not total_row_seen:
                # Primera fila no-vacía del sheet = total provincial.
                total_row_seen = True
                continue
            # Defensivo: encabezados extraviados mid-sheet.
            if nombre_norm.startswith(("TOTAL", "SUBTOTAL", "PROVINCIA")):
                continue

            # Vector de 26 años.
            valores_raw = row[2:2 + len(ANIOS)].tolist()
            if not all(pd.notna(v) for v in valores_raw):
                # Cantón con celdas vacías — reportar y saltar.
                log(f"  [WARN] sheet '{sheet}' cantón '{nombre}' tiene celdas vacías. Se omite.")
                continue
            try:
                valores = [int(round(float(v))) for v in valores_raw]
            except (TypeError, ValueError) as e:
                log(f"  [WARN] conversión numérica falló para '{nombre}': {e}")
                continue

            # Buscar DPA4 por match exacto.
            key = (prov_norm, nombre_norm)
            dpa4 = cant_to_dpa4.get(key)

            # Fallback por alias.
            if dpa4 is None and key in CANT_ALIASES:
                alias_key = CANT_ALIASES[key]
                dpa4 = cant_to_dpa4.get(alias_key)
                if dpa4 is not None:
                    matched_aliases.append(
                        (prov_canonica, str(nombre), alias_key[0], alias_key[1])
                    )

            if dpa4 is None:
                no_match.append((prov_canonica, str(nombre)))
                continue

            if dpa4 in poblacion:
                log(f"  [WARN] DPA4 {dpa4} ya visto; se reemplaza ({nombre}).")
            poblacion[dpa4] = valores
            n_filas_leidas += 1

    log(f"  Cantones matcheados : {len(poblacion)} / {len(cant_to_dpa4)} (referencia)")
    if matched_aliases:
        log(f"  Matches vía alias   : {len(matched_aliases)}")
        for p, c, pa, ca in matched_aliases:
            log(f"    - INEC '{p} / {c}'  ->  DPA '{pa} / {ca}'")
    if no_match:
        log(f"  [WARN] Cantones INEC sin match en DPA: {len(no_match)}")
        for p, c in no_match[:20]:
            log(f"    - {p} / {c}")

    # Cantones DPA sin proyección (en GeoJSON pero no resueltos desde INEC).
    dpa4_sin_pob = [d for d in dpa4_nombre.keys() if d not in poblacion]
    if dpa4_sin_pob:
        log(f"  [WARN] Cantones DPA sin proyección INEC: {len(dpa4_sin_pob)}")
        for d in dpa4_sin_pob[:20]:
            p, c = dpa4_nombre[d]
            log(f"    - DPA4 {d}  ({p} / {c})")

    # Validación: suma nacional 2022 debería ser ≈ 17 720 000.
    idx_2022 = ANIOS.index(2022)
    total_2022 = sum(v[idx_2022] for v in poblacion.values())
    log(f"  Suma nacional 2022  : {total_2022:,}")
    if abs(total_2022 - 17_720_000) > 50_000:
        log(
            f"  [ERROR] La suma nacional 2022 se aleja demasiado de 17 720 000 "
            f"(delta={total_2022 - 17_720_000:+,})."
        )
        # No abortamos, solo alertamos — puede haber cantones sin match.
    total_2010 = sum(v[ANIOS.index(2010)] for v in poblacion.values())
    total_2035 = sum(v[ANIOS.index(2035)] for v in poblacion.values())
    log(f"  Suma nacional 2010  : {total_2010:,}")
    log(f"  Suma nacional 2035  : {total_2035:,}")

    # Ordenar salida por DPA4.
    poblacion_out = {k: poblacion[k] for k in sorted(poblacion.keys())}

    out = {
        "_meta": {
            "fuente": "INEC · Proyecciones cantonales 2010-2035 (Rev. 2024)",
            "archivo": XLSX_IN.name,
            "anios_rango": [ANIOS[0], ANIOS[-1]],
            "n_cantones": len(poblacion_out),
            "n_cantones_sin_match": len(no_match),
            "n_cantones_via_alias": len(matched_aliases),
            "validacion_2022": {
                "suma_nacional": total_2022,
                "referencia": 17_720_000,
                "delta": total_2022 - 17_720_000,
            },
        },
        "anios": ANIOS,
        "poblacion": poblacion_out,
    }
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    size_kb = OUT_JSON.stat().st_size / 1024
    log(f"  OK -> {OUT_JSON}  ({size_kb:.1f} KB)")
    log("=" * 78)
    return 0


if __name__ == "__main__":
    sys.exit(main())
