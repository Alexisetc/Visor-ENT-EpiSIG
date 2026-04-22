"""
Verificación Fase 4 vs estudio Morales — nivel nacional agregado.

Complementa `verify_trend_vs_study.py` (que valida el engine a nivel causa
CIE-10 individual con 118 causas significativas del estudio).

Este script:
  1. Carga `intermediate/tendencias_parroquial.json` (Fase 4 output).
  2. Extrae las tendencias nacionales (clave `nacional` en `nivel='nacional'`)
     para los 5 grupos Morales × {morbilidad, mortalidad} × {serie_completa,
     sin_pandemia}.
  3. Carga MK_EGR.xlsx y MK_DEF.xlsx para obtener las causas significativas.
  4. Construye mapping causa → grupo Morales (usando los rangos CIE-10 del
     esquema Morales en config.py).
  5. Reporta:
     · Conteo de causas significativas por grupo + dirección
     · Tendencia nacional Fase 4 del grupo correspondiente
     · Consistencia direccional (Morales mayoría ↑ vs Fase 4 τ>0?)

Objetivo: responder "¿las conclusiones Morales 2017-2023 son consistentes
con las nuestras 2013-2024 (FDR-corregido)?".
"""
import json
import sys
import io
from pathlib import Path
import pandas as pd

# Forzar stdout a UTF-8 en Windows (cp1252 no soporta τ, ↑, ↓, →).
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "ENT_ART" / "datos" / "datos_limpios"
FASE4 = ROOT / "intermediate" / "tendencias_parroquial.json"

# Mapping causa CIE-10 (3 dígitos) → grupo Morales (5 grupos amplios)
# Replica exacta de config.py (pipeline Fase 2)
MORALES_RANGES = {
    'circulatorio':  [('I00', 'I99')],
    'neoplasia':     [('C00', 'C99'), ('D00', 'D48')],
    'metabolica':    [('E00', 'E90')],
    'respiratorio':  [('J00', 'J99')],
    'nervioso':      [('G00', 'G99')],
}


def causa_to_grupo(causa):
    """Clasifica un código CIE-10 de 3 dígitos al grupo Morales."""
    causa = str(causa).strip().upper()
    if len(causa) < 3:
        return None
    for grupo, rangos in MORALES_RANGES.items():
        for lo, hi in rangos:
            if lo <= causa <= hi:
                return grupo
    return None


def fmt_trend(t):
    """Formato compacto para imprimir una tendencia."""
    if not t or t.get('clase') is None:
        return '—'
    tau = t.get('tau')
    p = t.get('p_adj', t.get('p_raw'))
    sen = t.get('sen_slope')
    clase = t.get('clase')
    n = t.get('n')
    tau_s = f"{tau:+.3f}" if tau is not None else '—'
    p_s = f"{p:.4f}" if p is not None else '—'
    sen_s = f"{sen:+.2f}" if sen is not None else '—'
    return f"τ={tau_s} p_adj={p_s} sen={sen_s} clase={clase} n={n}"


def main():
    # 1. Cargar Fase 4
    if not FASE4.exists():
        print(f"ERROR: no existe {FASE4}")
        sys.exit(1)
    with open(FASE4, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Estructura:
    #   data['niveles_data']['nacional']['grupos']['EC'][grupo][metrica][variante]
    nacional = (
        data.get('niveles_data', {})
        .get('nacional', {})
        .get('grupos', {})
        .get('EC', {})
    )
    if not nacional:
        print("ERROR: no se encontró data['niveles_data']['nacional']['grupos']['EC']")
        print(f"Estructura top-level: {list(data.keys())}")
        sys.exit(1)

    print("\n" + "=" * 90)
    print("TENDENCIAS NACIONALES FASE 4 (2013-2024, 5 grupos Morales)")
    print("=" * 90)
    grupos_orden = ['circulatorio', 'neoplasia', 'metabolica', 'respiratorio', 'nervioso']
    for g in grupos_orden:
        if g not in nacional:
            print(f"\n  {g.upper()} — (sin datos)")
            continue
        print(f"\n  {g.upper()}")
        for metrica in ['morbilidad', 'mortalidad']:
            m = nacional[g].get(metrica, {})
            sc = m.get('serie_completa', {})
            sp = m.get('sin_pandemia', {})
            print(f"    {metrica:11} serie_completa : {fmt_trend(sc)}")
            print(f"    {metrica:11} sin_pandemia   : {fmt_trend(sp)}")

    # 2. Cargar causas significativas Morales
    print("\n" + "=" * 90)
    print("CORRESPONDENCIA CAUSAS MORALES 2017-2023 → GRUPOS FASE 4")
    print("=" * 90)

    for tipo, fname in [('egresos', 'MK_EGR.xlsx'), ('defunciones', 'MK_DEF.xlsx')]:
        path = DATA / fname
        if not path.exists():
            print(f"\n  {tipo.upper()}: {path} NO EXISTE")
            continue
        mk = pd.read_excel(path)
        cause_col = mk.columns[0]
        tau_col = 'tau'
        p_col = 'p_value'

        # Clasificar cada causa significativa a un grupo Morales
        bucket = {g: {'up': 0, 'down': 0, 'ninguno': 0} for g in grupos_orden}
        bucket['fuera_ent'] = {'up': 0, 'down': 0}
        for _, row in mk.iterrows():
            causa = str(row[cause_col]).strip()
            tau = float(row[tau_col])
            grupo = causa_to_grupo(causa)
            dir_ = 'up' if tau > 0 else 'down'
            if grupo is None:
                bucket['fuera_ent'][dir_] += 1
            else:
                bucket[grupo][dir_] += 1

        print(f"\n  {tipo.upper()} — {len(mk)} causas significativas en el estudio")
        print(f"  {'grupo':<15}{'↑ Asc':>8}{'↓ Desc':>8}  {'nacional Fase 4 (metrica)':<60}")
        print("  " + "-" * 95)
        metrica = 'morbilidad' if tipo == 'egresos' else 'mortalidad'
        for g in grupos_orden:
            up = bucket[g]['up']
            down = bucket[g]['down']
            f4 = nacional.get(g, {}).get(metrica, {}).get('serie_completa', {})
            if f4:
                tau4 = f4.get('tau')
                clase = f4.get('clase')
                p_adj = f4.get('p_adj')
                f4_str = f"τ={tau4:+.3f} p_adj={p_adj:.4f} → {clase}" if tau4 is not None else '—'
            else:
                f4_str = '—'
            print(f"  {g:<15}{up:>8}{down:>8}  {f4_str:<60}")
        up = bucket['fuera_ent']['up']
        down = bucket['fuera_ent']['down']
        print(f"  {'(fuera ENT)':<15}{up:>8}{down:>8}  (no aplica — esos códigos quedan en no_ent)")

    # 3. Resumen de consistencia direccional
    print("\n" + "=" * 90)
    print("CONSISTENCIA DIRECCIONAL Morales 2017-2023 (individual) vs Fase 4 (agregado)")
    print("=" * 90)
    print()
    print("  Nota metodológica: el estudio Morales analiza 118 causas CIE-10 individuales")
    print("  con MK puntual (sin FDR). Fase 4 agrega al nivel de 5 grupos Morales y aplica")
    print("  FDR-BH por bucket (nivel × grupo × métrica × variante). La comparación directa")
    print("  requiere agregar causas → grupo, que es lo que se muestra arriba.")
    print()
    print("  Una mayoría Morales-Ascendente en un grupo + Fase 4 Ascendente confirma el")
    print("  patrón con mejor control estadístico (FDR) + rango temporal ampliado (2013-2024).")


if __name__ == '__main__':
    main()
