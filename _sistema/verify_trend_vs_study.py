"""
Verificación del motor de tendencia del visor React vs. el estudio Morales.

El estudio (`ENT_ART/codigo/codigo_limpio/resultados_*.R`) usa Mann-Kendall
no paramétrico (paquete `Kendall` de R, función `MannKendall()`). El resultado
oficial se persiste en `ENT_ART/datos/datos_limpios/MK_DEF.xlsx` y MK_EGR.xlsx.

Este script:
  1. Lee las series anuales originales 2017-2023 por causa CIE-10
     (EGR_ENFERM_f_AN.xlsx, DEF_ENFERM_f_AN.xlsx).
  2. Lee los resultados oficiales (MK_DEF.xlsx, MK_EGR.xlsx) — tabla solo
     con causas que el estudio marcó como significativas (p<0.05).
  3. Recalcula con scipy.stats.kendalltau (MK) + OLS/t-test (mi implementación
     actual en JS) sobre las mismas series.
  4. Reporta diferencias lado a lado.

Objetivo: responder honestamente al usuario si el motor actual (OLS+t) da
la misma conclusión que el estudio (MK) y qué tan distinto es el p-valor.
"""
import sys
from pathlib import Path
import pandas as pd
import numpy as np
from scipy import stats

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "ENT_ART" / "datos" / "datos_limpios"


def load_series(path: Path, year_cols=None):
    """Lee tabla causa × año y devuelve dict {causa: np.array(7,)}."""
    df = pd.read_excel(path)
    # Detectar la columna de causa (primera columna string)
    cause_col = df.columns[0]
    # Columnas de años: strings '2017'..'2023' o int
    if year_cols is None:
        year_cols = [c for c in df.columns if str(c) in {'2017','2018','2019','2020','2021','2022','2023'}]
    series = {}
    for _, row in df.iterrows():
        cause = str(row[cause_col]).strip()
        if not cause or cause.lower() == 'nan':
            continue
        vals = np.array([row[c] for c in year_cols], dtype=float)
        if np.any(np.isnan(vals)):
            continue
        series[cause] = vals
    return series, [int(c) for c in year_cols]


def mann_kendall(y):
    """Mann-Kendall via scipy. Replica el paquete Kendall::MannKendall() de R."""
    years = np.arange(len(y))
    tau, p = stats.kendalltau(years, y, variant='b')  # variant b = tau_b (igual que R)
    return {'tau': tau, 'p_value': p}


def ols_ttest(years, y):
    """OLS + test t bilateral — mi implementación actual."""
    n = len(y)
    slope, intercept, r, p, se = stats.linregress(years, y)
    annual_pct = (slope / y.mean()) * 100 if y.mean() > 0 else 0
    return {'slope': slope, 'annual_pct': annual_pct, 'p_value': p, 'r2': r**2}


def variacion_acumulada(y):
    """var_por del estudio: ∏(1+VAR_i)−1 en % — variación acumulada fin-vs-principio."""
    if y[0] == 0:
        return float('nan')
    return (y[-1] / y[0] - 1) * 100


def main():
    # --- EGRESOS ---
    print("\n" + "="*80)
    print("EGRESOS HOSPITALARIOS 2017-2023 — MK (estudio) vs MK (scipy) vs OLS (mi impl)")
    print("="*80)
    egr_path = DATA / "EGR_ENFERM_f_AN.xlsx"
    mk_egr_path = DATA / "MK_EGR.xlsx"
    if not egr_path.exists():
        print(f"  NO EXISTE: {egr_path}")
    else:
        series, years = load_series(egr_path)
        print(f"\n  Causas con serie completa 2017-2023: {len(series)}")
        mk_ref = pd.read_excel(mk_egr_path)
        print(f"  Causas significativas según estudio: {len(mk_ref)}")
        print()
        print(f"  {'causa':<8}{'tau_estudio':>12}{'p_estudio':>12}  |{'tau_scipy':>11}{'p_scipy':>11}  |{'slope':>9}{'p_ols':>9}{'r2':>7}  |{'var_por_est':>12}{'var_acum':>11}  dir_est dir_mk dir_ols")
        print("  " + "-"*150)
        ref_causes = set(str(c).strip() for c in mk_ref.iloc[:,0])
        for causa in sorted(ref_causes):
            if causa not in series:
                print(f"  {causa:<8}  (sin serie anual)")
                continue
            y = series[causa]
            mk = mann_kendall(y)
            ols = ols_ttest(np.array(years), y)
            row_est = mk_ref[mk_ref.iloc[:,0].astype(str).str.strip() == causa].iloc[0]
            tau_est = float(row_est['tau'])
            p_est = float(row_est['p_value'])
            var_est = float(row_est['var_por'])
            var_calc = variacion_acumulada(y)
            dir_est = 'up' if tau_est > 0 else 'down'
            dir_mk = 'up' if mk['tau'] > 0 else 'down'
            dir_ols = 'up' if ols['slope'] > 0 else 'down'
            print(f"  {causa:<8}{tau_est:>12.4f}{p_est:>12.4f}  |{mk['tau']:>11.4f}{mk['p_value']:>11.4f}  |{ols['slope']:>9.2f}{ols['p_value']:>9.4f}{ols['r2']:>7.3f}  |{var_est:>12.2f}{var_calc:>11.2f}  {dir_est:>7}{dir_mk:>7}{dir_ols:>7}")

    # --- DEFUNCIONES ---
    print("\n" + "="*80)
    print("DEFUNCIONES 2017-2023 — MK (estudio) vs MK (scipy) vs OLS (mi impl)")
    print("="*80)
    def_path = DATA / "DEF_ENFERM_f_AN.xlsx"
    mk_def_path = DATA / "MK_DEF.xlsx"
    if not def_path.exists():
        print(f"  NO EXISTE: {def_path}")
    else:
        series, years = load_series(def_path)
        print(f"\n  Causas con serie completa 2017-2023: {len(series)}")
        mk_ref = pd.read_excel(mk_def_path)
        print(f"  Causas significativas según estudio: {len(mk_ref)}")
        print()
        print(f"  {'causa':<8}{'tau_estudio':>12}{'p_estudio':>12}  |{'tau_scipy':>11}{'p_scipy':>11}  |{'slope':>9}{'p_ols':>9}{'r2':>7}  |{'var_por_est':>12}{'var_acum':>11}  dir_est dir_mk dir_ols")
        print("  " + "-"*150)
        ref_causes = set(str(c).strip() for c in mk_ref.iloc[:,0])
        for causa in sorted(ref_causes):
            if causa not in series:
                print(f"  {causa:<8}  (sin serie anual)")
                continue
            y = series[causa]
            mk = mann_kendall(y)
            ols = ols_ttest(np.array(years), y)
            row_est = mk_ref[mk_ref.iloc[:,0].astype(str).str.strip() == causa].iloc[0]
            tau_est = float(row_est['tau'])
            p_est = float(row_est['p_value'])
            var_est = float(row_est['var_por'])
            var_calc = variacion_acumulada(y)
            dir_est = 'up' if tau_est > 0 else 'down'
            dir_mk = 'up' if mk['tau'] > 0 else 'down'
            dir_ols = 'up' if ols['slope'] > 0 else 'down'
            print(f"  {causa:<8}{tau_est:>12.4f}{p_est:>12.4f}  |{mk['tau']:>11.4f}{mk['p_value']:>11.4f}  |{ols['slope']:>9.2f}{ols['p_value']:>9.4f}{ols['r2']:>7.3f}  |{var_est:>12.2f}{var_calc:>11.2f}  {dir_est:>7}{dir_mk:>7}{dir_ols:>7}")


if __name__ == '__main__':
    main()
