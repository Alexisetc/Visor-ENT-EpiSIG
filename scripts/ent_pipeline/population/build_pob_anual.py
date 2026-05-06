"""
build_pob_anual.py
===================

Combina las tres fuentes previas para producir la población por parroquia y
año para el periodo 2013-2024, mediante interpolación **log-share** entre
CPV 2010 y CPV 2022, multiplicada por la proyección INEC cantonal del año.

Entradas
--------
* ``intermediate/pob_parroquial_2010.json``     (CPV 2010 microdato)
* ``intermediate/pob_parroquial.json``          (CPV 2022 snapshot)
* ``intermediate/pob_cantonal_anual.json``      (INEC proyecciones 2010-2035)

Método
------
Sea ``p`` una parroquia con DPA6, ``c = DPA4(p)`` su cantón. Para cada año
``y ∈ [2013..2024]``:

    α_y        = clip((y - 2010) / 12, 0, 1)
    log_s_y(p) = (1-α_y) · log(s10(p)) + α_y · log(s22(p))
    share_y(p) = exp(log_s_y(p)) / Σ_{p'∈c} exp(log_s_y(p'))
    pob_y(p)   = round(share_y(p) · pob_cantonal_INEC(c, y))

donde ``s10(p) = pob_p_2010 / Σ_{p'∈c} pob_p'_2010`` y análogo ``s22``.

Si ``s10 == 0`` (parroquia creada post-2010 o sin registros CPV 2010),
se usa ``s10 = s22 / 1000`` (valor ínfimo que se normaliza al final del
paso log-lineal).

Si ``s22 == 0`` (no matcheada en CPV 2022) → se registra como parroquia sin
serie y queda fuera del cálculo normalizado; reutiliza la proporción
residual.

Salida
------
``intermediate/pob_parroquial_anual.json`` con:
  * ``anios`` : [2013..2024]
  * ``poblacion_anual`` : DPA6 -> [pob_2013, ..., pob_2024]
  * ``poblacion``       : DPA6 -> pob_2022 (snapshot, retrocompat)

También se copia a:
  * ``webapp/assets/pob_parroquial.json`` (backup previo en ``_legacy/``)
  * ``webapp-react/public/assets/pob_parroquial.json`` (backup previo en ``_legacy/``)

Uso
---
    python -m scripts.ent_pipeline.population.build_pob_anual
"""

from __future__ import annotations

import json
import math
import shutil
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parents[2]
INTERMEDIATE = PROJECT_ROOT / "intermediate"
WEBAPP_ASSETS = PROJECT_ROOT / "webapp" / "assets"
WEBAPP_REACT_ASSETS = PROJECT_ROOT / "webapp-react" / "public" / "assets"

IN_POB_2010 = INTERMEDIATE / "pob_parroquial_2010.json"
IN_POB_2022 = INTERMEDIATE / "pob_parroquial.json"
IN_POB_CANT = INTERMEDIATE / "pob_cantonal_anual.json"
# GeoJSON de parroquias del visor — fuente de la geometría visible.
# Parroquias presentes acá pero ausentes en CPV se incorporan como
# "phantom" con share residual (ver doc del método).
IN_GEOJSON = WEBAPP_ASSETS / "parroquias_otp_simpl.geojson"
OUT_JSON = INTERMEDIATE / "pob_parroquial_anual.json"

ANIOS_OBJETIVO = list(range(2013, 2025))  # 2013..2024 inclusive.
ANIO_ANCLA_INI = 2010
ANIO_ANCLA_FIN = 2022

# Factor para parroquias "phantom" (en geojson pero sin CPV 2010 ni CPV
# 2022): se inicializan con `share_22 = mediana_cantón × PHANTOM_SCALE`
# antes de re-normalizar el cantón. 0.3 supone que las parroquias
# recién creadas (post-CPV) o zonas en estudio típicamente albergan
# un tercio de la población media de las parroquias hermanas — una
# heurística conservadora coherente con el patrón observado en CONALI:
# las parroquias nuevas se hivan de territorios menos poblados.
PHANTOM_SCALE = 0.30


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def cargar_json(p: Path) -> dict:
    if not p.exists():
        raise FileNotFoundError(f"No existe el archivo: {p}")
    return json.loads(p.read_text(encoding="utf-8"))


def backup_y_copiar(origen: Path, destino: Path) -> None:
    """
    Si ``destino`` existe, lo mueve a ``_legacy/`` con sufijo de versión
    preservando el nombre, y luego copia ``origen`` a ``destino``.
    """
    destino.parent.mkdir(parents=True, exist_ok=True)
    legacy_dir = destino.parent / "_legacy"
    legacy_dir.mkdir(parents=True, exist_ok=True)

    if destino.exists():
        # Determinar siguiente versión disponible v0, v1, ...
        base_name = destino.stem
        ext = destino.suffix
        i = 0
        while True:
            cand = legacy_dir / f"{base_name}.v{i}{ext}"
            if not cand.exists():
                break
            i += 1
        shutil.move(str(destino), str(cand))
        log(f"  Backup previo   -> {cand}")
    shutil.copy2(origen, destino)
    log(f"  Copia           -> {destino}")


def main() -> int:
    log("=" * 78)
    log("[build_pob_anual] Interpolación log-share CPV 2010 → CPV 2022 × INEC cantonal")
    log("=" * 78)

    pob_2010_raw = cargar_json(IN_POB_2010)["poblacion"]
    pob_2022_raw = cargar_json(IN_POB_2022)["poblacion"]
    j_cant = cargar_json(IN_POB_CANT)
    anios_cant: list[int] = j_cant["anios"]
    pob_cant_raw: dict[str, list[int]] = j_cant["poblacion"]

    pob_2010 = {str(k).zfill(6): int(v) for k, v in pob_2010_raw.items()
                if str(k).zfill(6).isdigit() and len(str(k).zfill(6)) == 6}
    pob_2022 = {str(k).zfill(6): int(v) for k, v in pob_2022_raw.items()
                if str(k).zfill(6).isdigit() and len(str(k).zfill(6)) == 6}
    pob_cant: dict[str, list[int]] = {
        str(k).zfill(4): [int(x) for x in v] for k, v in pob_cant_raw.items()
    }

    log(f"  CPV 2010   : {len(pob_2010):>5} parroquias · total {sum(pob_2010.values()):>12,}")
    log(f"  CPV 2022   : {len(pob_2022):>5} parroquias · total {sum(pob_2022.values()):>12,}")
    log(f"  INEC cant. : {len(pob_cant):>5} cantones   · rango {anios_cant[0]}-{anios_cant[-1]}")

    # Universo de DPA6: unión de las 3 fuentes (DPA4 presentes en INEC cant).
    universo = set(pob_2010.keys()) | set(pob_2022.keys())
    # Filtrar a parroquias cuyo DPA4 tenga serie cantonal.
    universo = {p for p in universo if p[:4] in pob_cant}
    log(f"  Universo DPA6 CPV (matched cantón): {len(universo)}")

    # === PARROQUIAS PHANTOM ===
    # Cargar el geojson para detectar parroquias presentes en la geometría
    # del visor pero ausentes en CPV 2010/2022 (ej. SOSOTE, JUAN MONTALVO,
    # SEVILLA DON BOSCO, LA MAGDALENA, LA PRIMAVERA — creadas por CONALI
    # post-2022; SHUAR PASTAZA y SINAÍ-CUCHAENTZA — territorios shuar /
    # zonas en estudio). Estas parroquias entran al universo con
    # `phantom_pob_2022 = mediana_cantón × PHANTOM_SCALE` para que la
    # interpolación log-share las distribuya como nuevas parroquias
    # rurales pequeñas, en vez de quedarse sin denominador.
    phantom_codes: set[str] = set()
    if IN_GEOJSON.exists():
        geojson = cargar_json(IN_GEOJSON)
        # Parroquias del geojson cuyo DPA4 tiene serie cantonal y NO están
        # en ninguna fuente CPV.
        for feat in geojson.get("features", []):
            pr = feat.get("properties", {})
            code = str(pr.get("DPA_PARROQ", "")).zfill(6)
            if not code or len(code) != 6 or not code.isdigit():
                continue  # Skip códigos no estándar (ZONA EN ESTUDIO, etc.)
            if code in universo:
                continue
            if code[:4] not in pob_cant:
                continue  # Sin proyección cantonal → no podemos reconstruir
            phantom_codes.add(code)
        log(f"  Phantom (geojson sin CPV)       : {len(phantom_codes)}")

        # Para cada phantom, calcular pob_2022 sintética = mediana del
        # cantón × PHANTOM_SCALE y agregarla a pob_2022 (la metodología
        # log-share existente la procesará igual que cualquier otra).
        from statistics import median as _median
        for code in sorted(phantom_codes):
            dpa4 = code[:4]
            siblings = [p for p in universo if p[:4] == dpa4]
            sibling_pobs = [pob_2022[p] for p in siblings if pob_2022.get(p, 0) > 0]
            if sibling_pobs:
                phantom_22 = max(1, int(_median(sibling_pobs) * PHANTOM_SCALE))
            else:
                # Sin hermanos con CPV — usar 1/N de la población cantonal 2022
                # como fallback de último recurso.
                cant_2022 = pob_cant[dpa4][idx_anio[2022] if 2022 in idx_anio else 0]
                phantom_22 = max(1, int(cant_2022 / max(1, len(siblings) + 1)))
            pob_2022[code] = phantom_22
            universo.add(code)
            log(f"    + phantom {code}  cant={dpa4}  pob_2022_sint={phantom_22:>5,}  (mediana×{PHANTOM_SCALE})")
    else:
        log(f"  [WARN] geojson no encontrado: {IN_GEOJSON} — sin parroquias phantom")

    log(f"  Universo final              : {len(universo)}")

    # Agrupar por cantón.
    cant_to_parr: dict[str, list[str]] = defaultdict(list)
    for p in universo:
        cant_to_parr[p[:4]].append(p)

    # Índices de años cantonales que queremos.
    idx_anio = {y: anios_cant.index(y) for y in ANIOS_OBJETIVO}
    idx_2022 = anios_cant.index(2022)

    # Salida.
    pob_anual: dict[str, list[int]] = {}
    # Validación aditividad: max |delta| por (cantón, año).
    max_abs_delta = 0
    peor_caso: tuple[str, int, int, int] | None = None
    n_cantones_ok = 0
    n_cantones_alerta = 0

    # Para diagnóstico:
    n_post_2010 = 0  # parroquias con s10==0 pero s22>0 (post CPV 2010).
    n_sin_2022 = 0   # parroquias con s22==0.
    n_ambos_cero = 0
    n_serie_completa = 0

    for dpa4, parrs in cant_to_parr.items():
        # Cálculo de poblaciones cantonales por fuente censal.
        tot10_c = sum(pob_2010.get(p, 0) for p in parrs)
        tot22_c = sum(pob_2022.get(p, 0) for p in parrs)

        if tot22_c == 0:
            # Cantón sin información CPV 2022 (extremadamente raro) — shares uniformes.
            log(f"  [WARN] DPA4 {dpa4}: tot22_c==0 · se usa share uniforme")
            shares_10 = {p: 1 / len(parrs) for p in parrs}
            shares_22 = {p: 1 / len(parrs) for p in parrs}
        else:
            # s22 base (por parroquia dentro del cantón).
            shares_22 = {
                p: (pob_2022.get(p, 0) / tot22_c) if tot22_c > 0 else 0.0
                for p in parrs
            }
            # s10 base.
            if tot10_c > 0:
                shares_10 = {
                    p: (pob_2010.get(p, 0) / tot10_c) if tot10_c > 0 else 0.0
                    for p in parrs
                }
            else:
                # Cantón completamente nuevo post-2010 — shares iguales a s22.
                shares_10 = dict(shares_22)

        # Aplicar reglas: s10=0 pero s22>0  -> s10 = s22/1000.
        for p in parrs:
            if shares_10.get(p, 0.0) == 0.0 and shares_22.get(p, 0.0) > 0.0:
                shares_10[p] = shares_22[p] / 1000.0
                n_post_2010 += 1
            if shares_22.get(p, 0.0) == 0.0:
                # Parroquia sin CPV 2022: usar share_10 (reducido) como fallback.
                if shares_10.get(p, 0.0) > 0.0:
                    shares_22[p] = shares_10[p] / 1000.0
                    n_sin_2022 += 1
                else:
                    n_ambos_cero += 1

        # Construir log-shares.
        log_s10 = {p: math.log(s) if s > 0 else None for p, s in shares_10.items()}
        log_s22 = {p: math.log(s) if s > 0 else None for p, s in shares_22.items()}

        # Series por año.
        parr_anual_rel: dict[str, list[float]] = {p: [] for p in parrs}
        for y in ANIOS_OBJETIVO:
            alpha_raw = (y - ANIO_ANCLA_INI) / (ANIO_ANCLA_FIN - ANIO_ANCLA_INI)
            alpha = max(0.0, min(1.0, alpha_raw))

            # Computar log_share mixto.
            ls_y_raw: dict[str, float] = {}
            for p in parrs:
                l10 = log_s10.get(p)
                l22 = log_s22.get(p)
                if l10 is None and l22 is None:
                    ls_y_raw[p] = None  # mantendrá 0.
                    continue
                if l10 is None:
                    ls_y_raw[p] = l22
                elif l22 is None:
                    ls_y_raw[p] = l10
                else:
                    ls_y_raw[p] = (1 - alpha) * l10 + alpha * l22

            # Stabilizar exp restando el máximo antes de exponenciar.
            finite = [v for v in ls_y_raw.values() if v is not None]
            m = max(finite) if finite else 0.0
            share_unnorm: dict[str, float] = {}
            total_exp = 0.0
            for p, v in ls_y_raw.items():
                if v is None:
                    share_unnorm[p] = 0.0
                else:
                    share_unnorm[p] = math.exp(v - m)
                total_exp += share_unnorm[p]

            # Normalizar.
            if total_exp > 0:
                for p in parrs:
                    parr_anual_rel[p].append(share_unnorm[p] / total_exp)
            else:
                # Ningún valor finito — share uniforme.
                for p in parrs:
                    parr_anual_rel[p].append(1.0 / len(parrs))

        # Aplicar al INEC cantonal y validar aditividad.
        cant_serie = pob_cant[dpa4]
        for j, y in enumerate(ANIOS_OBJETIVO):
            target_cant = cant_serie[idx_anio[y]]
            # Calcular población absoluta por redondeo.
            vals_raw = {p: parr_anual_rel[p][j] * target_cant for p in parrs}
            vals_round = {p: int(round(v)) for p, v in vals_raw.items()}
            # Ajuste de redondeo: agregar diferencia al que tenga mayor residuo.
            delta = target_cant - sum(vals_round.values())
            if delta != 0:
                # Orden parroquias por residuo (positivo = sumar, negativo = restar).
                residuos = sorted(
                    parrs,
                    key=lambda p: (vals_raw[p] - vals_round[p]),
                    reverse=(delta > 0),
                )
                paso = 1 if delta > 0 else -1
                for k in range(abs(delta)):
                    p = residuos[k % len(residuos)]
                    # Evitar poblaciones negativas.
                    if vals_round[p] + paso < 0:
                        continue
                    vals_round[p] += paso
            # Registrar |delta| post-ajuste.
            delta_final = target_cant - sum(vals_round.values())
            if abs(delta_final) > abs(max_abs_delta):
                max_abs_delta = delta_final
                peor_caso = (dpa4, y, target_cant, sum(vals_round.values()))

            # Guardar en pob_anual.
            for p in parrs:
                if p not in pob_anual:
                    pob_anual[p] = []
                pob_anual[p].append(vals_round[p])

        if abs(target_cant - sum(vals_round.values())) <= 2:
            n_cantones_ok += 1
        else:
            n_cantones_alerta += 1

    # Diagnóstico de cobertura.
    for p, serie in pob_anual.items():
        if len(serie) == len(ANIOS_OBJETIVO) and all(v > 0 for v in serie):
            n_serie_completa += 1

    # Validación de aditividad anual nacional.
    totales_nac_parr = {y: 0 for y in ANIOS_OBJETIVO}
    for p, serie in pob_anual.items():
        for j, y in enumerate(ANIOS_OBJETIVO):
            totales_nac_parr[y] += serie[j]
    totales_nac_cant = {y: 0 for y in ANIOS_OBJETIVO}
    for dpa4, serie in pob_cant.items():
        if dpa4 in cant_to_parr:  # solo cantones con parroquias en el universo
            for y in ANIOS_OBJETIVO:
                totales_nac_cant[y] += serie[idx_anio[y]]
    for y in ANIOS_OBJETIVO:
        d = totales_nac_parr[y] - totales_nac_cant[y]
        if abs(d) > 3 * len(cant_to_parr):  # tolerancia ~3 hab por cantón
            log(f"  [WARN] {y}: suma parroquial={totales_nac_parr[y]:,} "
                f"vs suma cantonal={totales_nac_cant[y]:,} (delta={d:+,})")

    log(f"  Cantones procesados     : {len(cant_to_parr)}")
    log(f"  Parroquias procesadas   : {len(pob_anual)}")
    log(f"  Parroquias serie completa (todos los años >0): {n_serie_completa}")
    log(f"  Parroquias post-CPV2010 (s10=0, s22>0)       : {n_post_2010}")
    log(f"  Parroquias sin CPV2022  (s22=0, s10>0)       : {n_sin_2022}")
    log(f"  Parroquias con ambos 0 (nodata)              : {n_ambos_cero}")
    log(f"  |delta| aditividad máx  : {max_abs_delta} hab")
    if peor_caso:
        log(f"    caso   : DPA4={peor_caso[0]} año={peor_caso[1]} "
            f"cant_INEC={peor_caso[2]:,} suma_parr={peor_caso[3]:,}")

    # Ordenar salida.
    pob_anual_out = {k: pob_anual[k] for k in sorted(pob_anual.keys())}

    # Totales nacionales para el meta.
    totales_nac = {str(y): int(totales_nac_parr[y]) for y in ANIOS_OBJETIVO}

    # Snapshot 2022 desde la fuente CPV 2022 (retrocompat).
    pob_2022_out = {k: int(v) for k, v in sorted(pob_2022.items())}

    out = {
        "_meta": {
            "fuente": "INEC · CPV 2010 + CPV 2022 + Proyecciones Cantonales 2010-2035 (Rev. 2024)",
            "metodo": "log-share interpolation (share log-lineal 2010→2022) × pob_cantonal_y (INEC)",
            "anios_rango": [ANIOS_OBJETIVO[0], ANIOS_OBJETIVO[-1]],
            "n_parroquias": len(pob_anual_out),
            "n_parroquias_serie_completa": n_serie_completa,
            "n_parroquias_post_2010": n_post_2010,
            "n_parroquias_sin_2022": n_sin_2022,
            "n_cantones_origen": len(cant_to_parr),
            "validacion_aditividad_max_delta_hab": int(max_abs_delta),
            "totales_nacionales": totales_nac,
        },
        "anios": ANIOS_OBJETIVO,
        "poblacion_anual": pob_anual_out,
        "poblacion": pob_2022_out,
    }
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    size_kb = OUT_JSON.stat().st_size / 1024
    log(f"  OK -> {OUT_JSON}  ({size_kb:.1f} KB)")

    # Copiar a los dos visores con backup.
    log("  Distribuyendo a visores:")
    backup_y_copiar(OUT_JSON, WEBAPP_ASSETS / "pob_parroquial.json")
    backup_y_copiar(OUT_JSON, WEBAPP_REACT_ASSETS / "pob_parroquial.json")

    # Reporte final de totales por año.
    log("-" * 78)
    log("  Totales nacionales (suma parroquial):")
    for y in ANIOS_OBJETIVO:
        log(f"    {y}: {totales_nac_parr[y]:>12,}")
    log("=" * 78)
    return 0


if __name__ == "__main__":
    sys.exit(main())
