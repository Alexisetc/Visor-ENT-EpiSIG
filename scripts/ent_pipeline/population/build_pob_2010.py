"""
build_pob_2010.py
==================

Calcula la población por parroquia (DPA6) a partir del microdato CPV 2010
(1 fila = 1 persona). La columna ``P13`` contiene el DPA6 de la parroquia
de residencia habitual.

Entrada : ``inputs/poblacion/raw/CPV2010_personas.csv``  (~3.66 GB, ~14.48 M filas)
Salida  : ``intermediate/pob_parroquial_2010.json``

Uso
---
    python -m scripts.ent_pipeline.population.build_pob_2010

Notas
-----
* Se lee en chunks de 1 000 000 filas para no reventar RAM.
* Validación de sanidad: el total debe caer en [14.0 M, 15.0 M].
"""

from __future__ import annotations

import json
import re
import sys
import time
from collections import Counter
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parents[2]  # scripts/ent_pipeline/population/ -> project root
INPUTS_RAW = PROJECT_ROOT / "inputs" / "poblacion" / "raw"
INTERMEDIATE = PROJECT_ROOT / "intermediate"

CSV_IN = INPUTS_RAW / "CPV2010_personas.csv"
OUT_JSON = INTERMEDIATE / "pob_parroquial_2010.json"

CHUNK_SIZE = 1_000_000
DPA6_RE = re.compile(r"^\d{6}$")


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def main() -> int:
    if not CSV_IN.exists():
        log(f"[ERROR] No existe el CSV de entrada: {CSV_IN}")
        return 2

    INTERMEDIATE.mkdir(parents=True, exist_ok=True)

    size_gb = CSV_IN.stat().st_size / (1024 ** 3)
    log("=" * 78)
    log(f"[build_pob_2010] CPV 2010 microdato")
    log(f"  Input  : {CSV_IN}  ({size_gb:.2f} GB)")
    log(f"  Chunks : {CHUNK_SIZE:,} filas cada uno")
    log("=" * 78)

    counter: Counter[str] = Counter()
    t0 = time.perf_counter()
    total_filas = 0
    n_chunks = 0

    # Leer solo la columna P13 para acelerar I/O y reducir memoria.
    reader = pd.read_csv(
        CSV_IN,
        sep=",",
        encoding="utf-8",
        usecols=["P13"],
        dtype={"P13": "string"},
        chunksize=CHUNK_SIZE,
        low_memory=False,
    )

    for chunk in reader:
        n_chunks += 1
        # Normalizar DPA6: strip, zfill a 6 dígitos, tomar los primeros 6.
        s = chunk["P13"].fillna("").astype(str).str.strip().str.zfill(6).str[:6]
        vc = s.value_counts(dropna=False)
        for dpa, n in vc.items():
            counter[str(dpa)] += int(n)
        total_filas += len(chunk)
        if n_chunks % 2 == 0 or n_chunks == 1:
            elapsed = time.perf_counter() - t0
            rate = total_filas / elapsed if elapsed > 0 else 0
            log(
                f"  chunk {n_chunks:3d} | {total_filas:>12,} filas | "
                f"{elapsed:6.1f}s | {rate/1000:6.0f} K filas/s | "
                f"{len(counter):>4} DPA acumuladas"
            )

    elapsed = time.perf_counter() - t0
    log("-" * 78)
    log(f"  Total chunks  : {n_chunks}")
    log(f"  Total filas   : {total_filas:,}")
    log(f"  Tiempo total  : {elapsed/60:.2f} min")

    # Filtrar solo DPA6 válidos (6 dígitos exactos).
    pob_valida: dict[str, int] = {}
    total_personas = 0
    total_descartadas = 0
    descartadas_muestra: list[tuple[str, int]] = []

    for dpa, n in counter.items():
        if DPA6_RE.match(dpa):
            pob_valida[dpa] = n
            total_personas += n
        else:
            total_descartadas += n
            if len(descartadas_muestra) < 10:
                descartadas_muestra.append((dpa, n))

    log(f"  DPA válidas   : {len(pob_valida):,}")
    log(f"  DPA inválidas : {len(counter) - len(pob_valida):,} "
        f"(=> {total_descartadas:,} personas descartadas)")
    if descartadas_muestra:
        log(f"  Muestra inválidas: {descartadas_muestra[:5]}")
    log(f"  Personas total: {total_personas:,} (tras filtro DPA6)")

    # Validación de sanidad.
    if not (14_000_000 <= total_personas <= 15_000_000):
        log(f"[ERROR] total_personas={total_personas:,} fuera de [14.0M, 15.0M]")
        return 3

    # Ordenar por DPA6 para salida estable.
    pob_out = {k: pob_valida[k] for k in sorted(pob_valida.keys())}

    out = {
        "_meta": {
            "fuente": "INEC · CPV 2010 · microdato CPV2010S_CSV_Poblacion_1.csv",
            "columna_dpa": "P13 (DPA6 residencia habitual)",
            "n_parroquias": len(pob_out),
            "n_personas_total": total_personas,
            "n_filas_leidas": total_filas,
            "n_chunks": n_chunks,
            "tiempo_seg": round(elapsed, 1),
        },
        "poblacion": pob_out,
    }
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    size_kb = OUT_JSON.stat().st_size / 1024
    log(f"  OK -> {OUT_JSON}  ({size_kb:.1f} KB)")
    log("=" * 78)
    return 0


if __name__ == "__main__":
    sys.exit(main())
