"""
procesar_microdato_egresos.py
==============================

Genera ``ent_parroquial.json`` para el Visor ENT de la presentacion EpiSIG,
a partir del microdato RDACAA de egresos hospitalarios 2013-2023 (SPSS .sav)
consolidado en el respaldo de Leonel Morales (ENT_ART).

Clasificacion ENT: reutiliza el mapping de ``Grupos_ent.R`` (Leonel Morales):

    C00-D48 -> neoplasia
    E00-E90 -> metabolica     (incluye DM, obesidad)
    G00-G99 -> nervioso
    I00-I99 -> circulatorio   (incluye HTA, IAM, ECV)
    J00-J99 -> respiratorio

Ademas calcula **sub-ENT clinicas** para selector secundario:

    E10, E11/E14       -> dm1, dm2
    I10-I15            -> hta
    I21/I22            -> iam
    I60-I69            -> ecv
    N18                -> erc
    E66                -> obesidad
    C50 / C16 / C61    -> ca_mama / ca_est / ca_prost
    F32/F33            -> depresion
    J44                -> epoc

Granularidad geografica: parroquia de residencia (``parr_res``, DPA 6 digitos).
Fallback jerarquico: si el codigo no matchea el GeoJSON de parroquias CONALI,
se agrega a cantones (``cant_res``); si tampoco, a provincia (``prov_res``).

Salida:
    - ``ent_parroquial.json``  (repo: ``assets/ent_parroquial.json``)

Dependencias:
    pip install pyreadstat pandas

Uso:
    python procesar_microdato_egresos.py
"""

from __future__ import annotations
import json
import re
import time
from pathlib import Path

import pandas as pd
import pyreadstat


# ============ RUTAS ============
HERE = Path(__file__).parent
PROJECT_ROOT = HERE.parent                 # Visor ENT EpiSIG/
INPUTS       = PROJECT_ROOT / "inputs"
INTERMEDIATE = PROJECT_ROOT / "intermediate"
ASSETS       = PROJECT_ROOT / "webapp" / "assets"

NAS_EGR = Path(
    r"\\EpiSIG_NAS\EpiSIG\2025\07. Personal_EpiSIG"
    r"\05_Respaldos_fin_gestion\3. Leonel_Morales_09012026"
    r"\PROYECTOS_R\ENT_ART\datos\datos_originales\alexis_egr"
)

# GeoJSON parroquial para resolver matches (publicado por el webapp)
GEOJSON_PARR = ASSETS / "parroquias_otp_simpl.geojson"

# Salida: JSON intermedio consumido por calcular_mcda_prioridad.py
OUT_JSON = INTERMEDIATE / "ent_parroquial.json"

ANIOS = list(range(2013, 2024))
COLS = ["anio_egr", "prov_res", "cant_res", "parr_res",
        "causa3", "cau_cie10", "sexo", "edad", "dia_estad", "con_egrpa"]

# ============ Mapping ENT (Leonel Morales · Grupos_ent.R) ============
def grupo_ent(causa3: str) -> str | None:
    if not isinstance(causa3, str) or len(causa3) < 3:
        return None
    c = causa3.strip().upper()
    if "C00" <= c <= "D48":
        return "neoplasia"
    if "E00" <= c <= "E90":
        return "metabolica"
    if "G00" <= c <= "G99":
        return "nervioso"
    if "I00" <= c <= "I99":
        return "circulatorio"
    if "J00" <= c <= "J99":
        return "respiratorio"
    return None


# Sub-ENT clinicas (selector secundario). Regex sobre causa3.
SUBENT_PATRONES: dict[str, re.Pattern] = {
    "dm1": re.compile(r"^E10$"),
    "dm2": re.compile(r"^E1[14]$"),
    "hta": re.compile(r"^I1[0-5]$"),
    "iam": re.compile(r"^I2[12]$"),
    "ecv": re.compile(r"^I6[0-9]$"),
    "erc": re.compile(r"^N18$"),
    "obesidad": re.compile(r"^E66$"),
    "ca_mama": re.compile(r"^C50$"),
    "ca_est": re.compile(r"^C16$"),
    "ca_prost": re.compile(r"^C61$"),
    "depresion": re.compile(r"^F3[23]$"),
    "epoc": re.compile(r"^J44$"),
}
SUBENT_IDS = list(SUBENT_PATRONES.keys())


def subent_of(causa3: str) -> str | None:
    if not isinstance(causa3, str):
        return None
    c = causa3.strip().upper()
    for sid, rx in SUBENT_PATRONES.items():
        if rx.match(c):
            return sid
    return None


# ============ Cargas ============
def cargar_dpas_validos() -> tuple[set[str], dict[str, dict]]:
    """Lee el GeoJSON parroquial y devuelve el set de DPA_PARROQ validos +
    lookup de metadata (nombre, canton, provincia) por DPA."""
    data = json.loads(GEOJSON_PARR.read_text(encoding="utf-8"))
    valid = set()
    meta = {}
    for f in data["features"]:
        p = f["properties"]
        code = str(p.get("DPA_PARROQ") or "").strip().zfill(6)
        if not code:
            continue
        valid.add(code)
        meta[code] = {
            "nombre": p.get("DPA_DESPAR") or "",
            "cant": p.get("DPA_DESCAN") or "",
            "prov": p.get("DPA_DESPRO") or "",
        }
    print(f"  GeoJSON parroquial: {len(valid)} parroquias validas")
    return valid, meta


# ============ Core: lectura por ano + agregacion en streaming ============
def procesar_anio(
    sav_path: Path,
    anios_idx: dict[int, int],
    valid_parr: set[str],
    # acumuladores mutables compartidos
    acum_grp: dict,  # {dpa6: {grupo: [casos[], muertes[]]}}
    acum_sub: dict,  # {dpa6: {sub:  [casos[], muertes[]]}}
    dpas_no_match: dict,  # {dpa6: count} -> para reporte de calidad
    match_level_stat: dict,  # {'parr': n, 'cant': n, 'prov': n}
) -> int:
    """Procesa un archivo .sav completo (streaming por chunks) y acumula."""
    n_anios = len(anios_idx)
    read_t0 = time.time()
    n = 0

    # pyreadstat lee en chunks; usamos read_file_in_chunks
    for df, _meta in pyreadstat.read_file_in_chunks(
        pyreadstat.read_sav,
        str(sav_path),
        chunksize=200_000,
        usecols=COLS,
        apply_value_formats=False,
    ):
        n += len(df)
        # Normalizacion de claves DPA (strings, 2/4/6 digitos, padding 0)
        df = df.copy()
        df["prov_res"] = df["prov_res"].astype("string").str.strip().str.zfill(2)
        df["cant_res"] = df["cant_res"].astype("string").str.strip().str.zfill(4)
        df["parr_res"] = df["parr_res"].astype("string").str.strip().str.zfill(6)
        df["causa3"] = df["causa3"].astype("string").str.strip().str.upper()
        df["anio_egr"] = pd.to_numeric(df["anio_egr"], errors="coerce").astype("Int64")
        df["con_egrpa"] = pd.to_numeric(df["con_egrpa"], errors="coerce").fillna(0)
        df["muerte"] = (df["con_egrpa"] == 2).astype("int8")

        # Excluir prov_res invalidos (20 = zonas no delimitadas, 88 extranjero, 90 ignorado)
        df = df[~df["prov_res"].isin(["20", "88", "90"])]

        # Clasificacion ENT
        df["grupo"] = df["causa3"].map(grupo_ent)
        df["subent"] = df["causa3"].map(subent_of)

        # Filtrar solo filas ENT (grupo no nulo) — el resto no aporta al visor
        df_ent = df[df["grupo"].notna()].copy()
        if df_ent.empty:
            continue

        # Match parroquial con redirect a cabecera cantonal para parroquias
        # urbanas (dígitos 5-6 < "50"). En CONALI las parroquias urbanas no
        # existen como polígonos independientes: se agregan en la cabecera
        # cantonal cuyo código siempre termina en 50.
        is_urbana = df_ent["parr_res"].str[-2:].lt("50")
        df_ent["parr_norm"] = df_ent["parr_res"]
        # Redirigir urbanas a cabecera cantonal (pref + canton + "50")
        df_ent.loc[is_urbana, "parr_norm"] = (
            df_ent.loc[is_urbana, "cant_res"] + "50"
        )
        is_parr = df_ent["parr_norm"].isin(valid_parr)
        df_ent["match_level"] = "prov"
        df_ent.loc[is_parr, "match_level"] = "parr"
        df_ent.loc[is_parr, "geo_key"] = df_ent.loc[is_parr, "parr_norm"]
        # Fallback cantón para lo que aún no matchee (DPA realmente invalido)
        df_ent.loc[~is_parr, "match_level"] = "cant"
        df_ent.loc[~is_parr, "geo_key"] = df_ent.loc[~is_parr, "cant_res"]

        # Stats de match
        for lvl, cnt in df_ent["match_level"].value_counts().items():
            match_level_stat[lvl] = match_level_stat.get(lvl, 0) + int(cnt)

        # Registrar DPA sin match (para diagnostico)
        no_match = df_ent.loc[~is_parr, "parr_res"].value_counts()
        for k, v in no_match.items():
            dpas_no_match[str(k)] = dpas_no_match.get(str(k), 0) + int(v)

        # ========= Agregacion grupo =========
        grp = (
            df_ent.groupby(["geo_key", "anio_egr", "grupo"], observed=True)
            .agg(casos=("geo_key", "size"), muertes=("muerte", "sum"))
            .reset_index()
        )
        for _, r in grp.iterrows():
            k = str(r["geo_key"])
            year = int(r["anio_egr"])
            if year not in anios_idx:
                continue
            j = anios_idx[year]
            grupo = r["grupo"]
            if k not in acum_grp:
                acum_grp[k] = {}
            if grupo not in acum_grp[k]:
                acum_grp[k][grupo] = ([0] * n_anios, [0] * n_anios)
            c, m = acum_grp[k][grupo]
            c[j] += int(r["casos"])
            m[j] += int(r["muertes"])

        # ========= Agregacion sub-ENT =========
        sub_df = df_ent[df_ent["subent"].notna()]
        if not sub_df.empty:
            sub = (
                sub_df.groupby(["geo_key", "anio_egr", "subent"], observed=True)
                .agg(casos=("geo_key", "size"), muertes=("muerte", "sum"))
                .reset_index()
            )
            for _, r in sub.iterrows():
                k = str(r["geo_key"])
                year = int(r["anio_egr"])
                if year not in anios_idx:
                    continue
                j = anios_idx[year]
                sid = r["subent"]
                if k not in acum_sub:
                    acum_sub[k] = {}
                if sid not in acum_sub[k]:
                    acum_sub[k][sid] = ([0] * n_anios, [0] * n_anios)
                c, m = acum_sub[k][sid]
                c[j] += int(r["casos"])
                m[j] += int(r["muertes"])

    dt = time.time() - read_t0
    print(f"    {sav_path.name}: {n:,} filas  [{dt:.1f}s]")
    return n


def main():
    print(f"[{time.strftime('%H:%M:%S')}] procesar_microdato_egresos.py")
    print(f"  Anios:     {ANIOS[0]}-{ANIOS[-1]}  ({len(ANIOS)} archivos)")
    print(f"  NAS_EGR:   {NAS_EGR}")
    print(f"  GeoJSON:   {GEOJSON_PARR}")
    print(f"  Out JSON:  {OUT_JSON}")
    print()

    if not GEOJSON_PARR.is_file():
        print(f"  [WARN] No existe GeoJSON en {GEOJSON_PARR}")
        print("         Continuando con set vacio (todos los egresos iran a cantonal).")
        valid_parr, parr_meta = set(), {}
    else:
        valid_parr, parr_meta = cargar_dpas_validos()

    anios_idx = {a: i for i, a in enumerate(ANIOS)}

    acum_grp: dict[str, dict[str, tuple]] = {}
    acum_sub: dict[str, dict[str, tuple]] = {}
    dpas_no_match: dict[str, int] = {}
    match_level_stat: dict[str, int] = {}

    total = 0
    t_global = time.time()
    for anio in ANIOS:
        sav = NAS_EGR / f"egresos_hospitalarios_{anio}.sav"
        if not sav.is_file():
            print(f"  [skip] {sav.name} no existe")
            continue
        total += procesar_anio(
            sav, anios_idx, valid_parr,
            acum_grp, acum_sub, dpas_no_match, match_level_stat,
        )
    dt_global = time.time() - t_global
    print(f"\n  Total filas: {total:,}  en {dt_global:.0f}s")

    # ============ Metrica de calidad ============
    sum_match = sum(match_level_stat.values()) or 1
    calidad = {
        "match_parr": round(match_level_stat.get("parr", 0) / sum_match, 4),
        "match_cant": round(match_level_stat.get("cant", 0) / sum_match, 4),
        "match_prov": round(match_level_stat.get("prov", 0) / sum_match, 4),
        "total_egresos_ent": sum_match,
        "dpas_no_match_top": dict(
            sorted(dpas_no_match.items(), key=lambda x: -x[1])[:20]
        ),
    }
    print(f"\n  Calidad match: parr={calidad['match_parr']:.1%}  "
          f"cant={calidad['match_cant']:.1%}  prov={calidad['match_prov']:.1%}")

    # ============ Estructura JSON compacta ============
    parroquias_out = {}
    for dpa, grupos in acum_grp.items():
        m = parr_meta.get(dpa, {})
        if len(dpa) == 6 and dpa in valid_parr:
            mlvl = "parr"
        elif len(dpa) == 4:
            mlvl = "cant"
        else:
            mlvl = "prov"
        entry = {
            "nombre": m.get("nombre", ""),
            "cant": m.get("cant", ""),
            "prov": m.get("prov", ""),
            "match_level": mlvl,
            "data": {
                "grupos": {
                    g: {"casos": casos, "muertes": muertes}
                    for g, (casos, muertes) in grupos.items()
                },
                "subent": {
                    s: {"casos": casos, "muertes": muertes}
                    for s, (casos, muertes) in acum_sub.get(dpa, {}).items()
                },
            },
        }
        parroquias_out[dpa] = entry

    out = {
        "generado": time.strftime("%Y-%m-%d %H:%M:%S"),
        "anios": ANIOS,
        "grupos": ["neoplasia", "metabolica", "nervioso", "circulatorio", "respiratorio"],
        "subent": SUBENT_IDS,
        "calidad": calidad,
        "fuente": (
            "Egresos hospitalarios INEC/MSP 2013-2023 (RDACAA) · "
            "respaldo ENT_ART L. Morales · clasificacion CIE-10 "
            "segun Grupos_ent.R"
        ),
        "parroquias": parroquias_out,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    size_mb = OUT_JSON.stat().st_size / 1024 / 1024
    print(f"\n  OK -> {OUT_JSON}  ({size_mb:.2f} MB)")
    print(f"  Parroquias con datos: {len(parroquias_out)}")


if __name__ == "__main__":
    main()
