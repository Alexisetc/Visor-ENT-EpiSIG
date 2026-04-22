"""Fase 1 — Perfilado de calidad de datos crudos INEC.

Lee los 12 años de egresos (2013-2024) + 12 años de defunciones, genera
un HTML con siete bloques de observaciones (A-G) que el revisor usa
para definir las reglas de limpieza de la Fase 2.

Uso:
    python -m scripts.ent_pipeline.01_profile                  # ambos
    python -m scripts.ent_pipeline.01_profile --tipo egresos   # solo uno
    python -m scripts.ent_pipeline.01_profile --no-cache       # fuerza rebuild

Outputs:
    intermediate/profile_egresos.html
    intermediate/profile_defunciones.html
    intermediate/profile_<tipo>_data.json
    intermediate/<tipo>_all.parquet  (cache vía io_inec)
"""
from __future__ import annotations
import argparse
import base64
import io
import json
import sys
from datetime import datetime
from pathlib import Path

import matplotlib
matplotlib.use('Agg')                       # headless — genera PNG sin GUI
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from jinja2 import Environment, FileSystemLoader, select_autoescape

# Import relativo robusto (sirve tanto `python -m` como `python 01_profile.py`)
try:
    from . import config as C
    from .io_inec import load_all
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from ent_pipeline import config as C
    from ent_pipeline.io_inec import load_all


TEMPLATE_DIR = Path(__file__).resolve().parent / 'templates'


# ──────────────────────────────────────────────────────────────────────────
# Helpers de gráficas → base64 PNG (para embeber en HTML sin dependencias)
# ──────────────────────────────────────────────────────────────────────────
def fig_to_base64(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight', dpi=110)
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode('ascii')


def plot_rows_per_year(rows_year: dict, title: str) -> str:
    fig, ax = plt.subplots(figsize=(8, 3))
    years = sorted(rows_year.keys())
    vals  = [rows_year[y] for y in years]
    ax.bar(years, vals, color='#1a1b4a', edgecolor='white')
    for y, v in zip(years, vals):
        ax.text(y, v, f'{v:,}', ha='center', va='bottom', fontsize=8)
    ax.set_title(title, fontsize=11)
    ax.set_ylabel('nº de registros')
    ax.grid(axis='y', alpha=0.3)
    fig.tight_layout()
    return fig_to_base64(fig)


def plot_missing_heatmap(df: pd.DataFrame, cols: list[str], title: str) -> str:
    years = sorted(df['anio'].unique())
    mat = np.zeros((len(cols), len(years)))
    for j, y in enumerate(years):
        sub = df[df['anio'] == y]
        n = len(sub)
        if n == 0:
            continue
        for i, c in enumerate(cols):
            if c not in sub.columns:
                mat[i, j] = 100  # 100% "missing" — columna no existe
            else:
                mat[i, j] = sub[c].isna().mean() * 100
    fig, ax = plt.subplots(figsize=(10, max(3, 0.33 * len(cols))))
    im = ax.imshow(mat, aspect='auto', cmap='RdYlGn_r', vmin=0, vmax=100)
    ax.set_xticks(range(len(years)))
    ax.set_xticklabels(years, rotation=45, ha='right', fontsize=8)
    ax.set_yticks(range(len(cols)))
    ax.set_yticklabels(cols, fontsize=8)
    ax.set_title(title, fontsize=11)
    for i in range(len(cols)):
        for j in range(len(years)):
            v = mat[i, j]
            if v > 0.05:
                color = 'white' if v > 50 else 'black'
                ax.text(j, i, f'{v:.0f}', ha='center', va='center', fontsize=6.5, color=color)
    cbar = fig.colorbar(im, ax=ax, fraction=0.025)
    cbar.set_label('% missing', fontsize=8)
    fig.tight_layout()
    return fig_to_base64(fig)


def plot_hist(series: pd.Series, title: str, bins: int = 30) -> str:
    clean = series.dropna()
    if clean.empty:
        return ''
    fig, ax = plt.subplots(figsize=(6, 3))
    ax.hist(clean, bins=bins, color='#1a1b4a', edgecolor='white')
    ax.set_title(title, fontsize=10)
    ax.grid(axis='y', alpha=0.3)
    fig.tight_layout()
    return fig_to_base64(fig)


def plot_ent_trend(df_agg: pd.DataFrame, title: str) -> str:
    """df_agg: index=anio, columns=grupos ENT, values=conteos."""
    if df_agg.empty:
        return ''
    fig, ax = plt.subplots(figsize=(10, 4))
    colors = {'cardio': '#e63946', 'neoplasia': '#8338ec',
              'resp': '#3a86ff',   'diabren': '#fb8500',
              'digest': '#06a77d', 'no_clasificado': '#6b7280'}
    for col in df_agg.columns:
        ax.plot(df_agg.index, df_agg[col], marker='o', lw=2,
                label=col, color=colors.get(col, '#999'))
    ax.set_title(title, fontsize=11)
    ax.set_ylabel('nº de registros')
    ax.grid(alpha=0.3)
    ax.legend(fontsize=9, ncol=3, loc='upper left')
    fig.tight_layout()
    return fig_to_base64(fig)


# ──────────────────────────────────────────────────────────────────────────
# Bloques de perfilado
# ──────────────────────────────────────────────────────────────────────────
def block_a_volumen(df: pd.DataFrame, info: dict, tipo: str) -> dict:
    """Bloque A — totales por año, hashes, cambios de schema."""
    rows_year = info.get('rows_year', {})
    rows_year = {int(k): int(v) for k, v in rows_year.items()}

    # Cambios de schema: columnas extra/missing por año
    schema_changes = []
    for y in sorted(rows_year.keys()):
        extras   = info.get('extra_by_year', {}).get(str(y), info.get('extra_by_year', {}).get(y, []))
        missing  = info.get('missing_by_year', {}).get(str(y), info.get('missing_by_year', {}).get(y, []))
        if extras or missing:
            schema_changes.append({
                'anio': y,
                'columnas_extra':    sorted(extras)[:15],    # cap 15 para HTML
                'columnas_ausentes': sorted(missing),
            })

    return {
        'title': 'A · Integridad y volumen',
        'total_rows':   int(len(df)),
        'rows_year':    rows_year,
        'rows_year_total': sum(rows_year.values()),
        'hashes':       info.get('hashes', {}),
        'schema_changes': schema_changes,
        'plot_rows':    plot_rows_per_year(rows_year, f'{tipo.capitalize()} · registros por año'),
        'note':  (
            'Comparar estos totales contra los metadatos oficiales INEC (`.ods` '
            'en `inputs/' + tipo + '/diccionarios/`). Discrepancias > 0.5% '
            'indican que el archivo local difiere del publicado.'
        ),
    }


def block_b_calidad(df: pd.DataFrame, critical_cols: list[str]) -> dict:
    """Bloque B — missing, top-5 y estadísticos por columna crítica."""
    cols_info = []
    for col in critical_cols:
        if col not in df.columns:
            cols_info.append({
                'col': col, 'exists': False,
                'pct_missing': 100, 'top5': [], 'stats': None,
            })
            continue
        s = df[col]
        n_total = len(s)
        n_miss = int(s.isna().sum())
        pct_miss = (n_miss / n_total * 100) if n_total else 0

        # Top-5 valores no nulos
        top5 = s.dropna().astype(str).value_counts().head(5)
        top5_list = [{'val': k, 'n': int(v), 'pct': float(v / n_total * 100)} for k, v in top5.items()]

        # Stats numéricos si aplica
        stats = None
        if pd.api.types.is_numeric_dtype(s):
            vals = s.dropna()
            if not vals.empty:
                stats = {
                    'min':    float(vals.min()),
                    'max':    float(vals.max()),
                    'mean':   float(vals.mean()),
                    'median': float(vals.median()),
                    'n_unique': int(vals.nunique()),
                }
        else:
            stats = {'n_unique': int(s.dropna().nunique())}

        cols_info.append({
            'col': col, 'exists': True,
            'pct_missing': round(pct_miss, 2),
            'n_missing': n_miss,
            'top5': top5_list,
            'stats': stats,
        })

    return {
        'title': 'B · Calidad por columna crítica',
        'cols': cols_info,
        'heatmap': plot_missing_heatmap(df, critical_cols, 'Heatmap % missing por columna × año'),
    }


def block_c_geografia(df: pd.DataFrame, tipo: str) -> dict:
    """Bloque C — integridad referencial DPA (residencia).

    Nota INEC: las columnas son jerárquicas completas — `parr_res` ya es DPA-6.
    """
    prov_col = 'prov_res'
    parr_col = 'parr_res'

    if parr_col not in df.columns:
        # Caso defunciones 2015+ (perdieron cant_res/parr_res): fallback al lugar
        # de fallecimiento que sí conserva granularidad parroquial.
        if 'parr_fall' in df.columns:
            parr_col = 'parr_fall'
            prov_col = 'prov_fall'
        else:
            return {'title': 'C · Integridad referencial DPA',
                    'error': f'No hay granularidad parroquial disponible (falta {parr_col} y también parr_fall)'}

    df_nz = df.dropna(subset=[parr_col]).copy()
    # parr_* ya viene como DPA6 completo (ver nota arriba) — cast a int → str zfill
    df_nz['parroquia_key'] = (
        df_nz[parr_col].astype('Int64').astype(str).str.replace('<NA>', '', regex=False).str.zfill(6)
    )
    parrs_unicas = df_nz['parroquia_key'].nunique()

    # Intentar cargar el GeoJSON parroquial para cruzar
    geo_keys = None
    try:
        import json as _json
        gpath = C.ROOT / 'webapp-react' / 'public' / 'assets' / 'parroquias_otp_simpl.geojson'
        if not gpath.exists():
            gpath = C.ROOT / 'webapp' / 'assets' / 'parroquias_otp_simpl.geojson'
        if gpath.exists():
            data = _json.loads(gpath.read_text(encoding='utf-8'))
            geo_keys = set()
            for feat in data.get('features', []):
                p = feat.get('properties', {})
                dpa = str(p.get('DPA_PARROQ') or p.get('DPA_PARROQU') or '').strip()
                if dpa:
                    geo_keys.add(dpa.zfill(6)[-6:])
    except Exception as e:
        print(f"[profile] aviso: no se pudo leer GeoJSON: {e}", file=sys.stderr)

    # Exclusiones provinciales (Morales) — ahora usando `prov_col` de verdad
    excl_counts = {}
    if prov_col in df.columns:
        prov_as_str = df[prov_col].dropna().astype(int).astype(str).str.zfill(2)
        for pcode, pname in C.PROV_EXCLUIDAS_LABEL.items():
            n = int((prov_as_str == pcode).sum())
            excl_counts[pcode] = {'nombre': pname, 'n': n,
                                  'pct': round(n / len(df) * 100, 3) if len(df) else 0}

    # % de DPA huérfanos (sin match en GeoJSON)
    orphans = None
    if geo_keys:
        mask_orphan = ~df_nz['parroquia_key'].isin(geo_keys)
        orphans = {
            'n':   int(mask_orphan.sum()),
            'pct': round(mask_orphan.mean() * 100, 2),
            'top': df_nz.loc[mask_orphan, 'parroquia_key'].value_counts().head(10).to_dict(),
            'geo_n': len(geo_keys),
        }

    return {
        'title': 'C · Integridad referencial DPA (residencia)',
        'parr_col_usada': parr_col,
        'parrs_unicas_data': int(parrs_unicas),
        'exclusiones': excl_counts,
        'orphans': orphans,
        'note': (
            'Las provincias 20/88/90 se excluyeron en el estudio Morales. '
            'La decisión de excluirlas o reportarlas aparte se toma tras revisar '
            'este bloque. El GeoJSON del visor (parroquias_otp_simpl) contiene '
            '<b>1,050 parroquias rurales + cabeceras cantonales</b> (códigos '
            'terminados en 50+ o =x01). Registros huérfanos típicamente son '
            '<b>parroquias urbanas</b> (ej. Tarqui en Guayaquil = 090112, '
            'Iñaquito en Quito = 170150): el enfoque recomendado para Fase 2 '
            'es agregar los huérfanos a la cabecera cantonal más cercana '
            '(parr_key → prov2+cant2+"50") y documentar la agregación. '
            'Columna DPA usada para el cruce: <code>' + parr_col + '</code>.'
        ),
    }


def block_d_cie10(df: pd.DataFrame, tipo: str) -> dict:
    """Bloque D — distribución CIE-10 y clasificación en 5 grupos ENT."""
    cause_col = 'cau_cie10' if tipo == 'egresos' else 'causa4'
    if cause_col not in df.columns:
        # fallback — usar la primera columna que empiece con 'cau' o 'causa'
        for alt in df.columns:
            if str(alt).startswith(('cau', 'causa')):
                cause_col = alt
                break

    # Top-50 global
    top50 = (df[cause_col].dropna().astype(str)
             .value_counts().head(50))
    top50_list = [{'code': k, 'n': int(v), 'pct': float(v / len(df) * 100)} for k, v in top50.items()]

    # Clasificación preliminar
    codes_norm = df[cause_col].dropna().astype(str).map(C.normalize_cie10)
    grupos = codes_norm.map(lambda c: C.classify_cie10(c) or 'no_clasificado')
    clasif_counts = grupos.value_counts().to_dict()
    total_clas = int(sum(clasif_counts.values()))
    clasif = []
    for k in list(C.ENT_KEYS) + ['no_clasificado']:
        n = int(clasif_counts.get(k, 0))
        clasif.append({
            'grupo': k,
            'label': C.ENT_GRUPOS[k]['label'] if k in C.ENT_GRUPOS else 'No clasificado (resto)',
            'n': n,
            'pct': round(n / total_clas * 100, 2) if total_clas else 0,
        })

    # Tendencia anual por grupo
    tmp = df[[cause_col, 'anio']].dropna(subset=[cause_col]).copy()
    tmp['grupo'] = tmp[cause_col].astype(str).map(C.normalize_cie10).map(
        lambda c: C.classify_cie10(c) or 'no_clasificado')
    agg = tmp.groupby(['anio', 'grupo']).size().unstack(fill_value=0)
    agg = agg[[c for c in (list(C.ENT_KEYS) + ['no_clasificado']) if c in agg.columns]]

    return {
        'title': 'D · Distribución CIE-10 y clasificación ENT',
        'cause_col': cause_col,
        'n_total': int(len(codes_norm)),
        'top50': top50_list,
        'clasif': clasif,
        'plot_trend': plot_ent_trend(agg, f'Registros por grupo ENT · {tipo}'),
        'note': (
            'Reglas CIE-10 Morales aplicadas (prefijo 3-char): C00-D48 (−D64.9) = '
            'neoplasia; I00-I99 = cardio; J30-J98 (−J69, −J96) = resp crónicas; '
            'E10-E14 + N00-N18 = diabetes/renales; K00-K92 = digestivas. '
            'Registros marcados "no_clasificado" caen fuera de los 5 grupos '
            '— NO son errores, son otras patologías (infecciosas, lesiones, '
            'etc.) que el estudio no analiza.'
        ),
    }


def block_e_demografia(df: pd.DataFrame) -> dict:
    """Bloque E — estratificación demográfica."""
    plots = {}
    if 'sexo' in df.columns:
        vc = df['sexo'].value_counts(dropna=False).head(8)
        fig, ax = plt.subplots(figsize=(5, 3))
        ax.bar([str(v) for v in vc.index], vc.values, color='#1a1b4a')
        ax.set_title('Distribución sexo (códigos crudos)', fontsize=10)
        plots['sexo'] = fig_to_base64(fig)

    if 'edad' in df.columns and 'cod_edad' in df.columns:
        # solo considerar cod_edad=5 (años) para no mezclar meses/días
        years_only = df[df['cod_edad'] == 5]['edad'].dropna()
        if not years_only.empty:
            bins_age = [0, 1, 5, 15, 45, 65, 200]
            labels   = ['<1', '1-4', '5-14', '15-44', '45-64', '65+']
            cats = pd.cut(years_only, bins=bins_age, right=False, labels=labels)
            vc = cats.value_counts().reindex(labels, fill_value=0)
            fig, ax = plt.subplots(figsize=(7, 3))
            ax.bar(labels, vc.values, color='#1a1b4a')
            for lab, v in zip(labels, vc.values):
                ax.text(lab, v, f'{v:,}', ha='center', va='bottom', fontsize=8)
            ax.set_title('Distribución grupos etarios (cod_edad=5, en años)', fontsize=10)
            plots['edad'] = fig_to_base64(fig)

    if 'etnia' in df.columns:
        vc = df['etnia'].value_counts(dropna=False).head(10)
        fig, ax = plt.subplots(figsize=(6, 3))
        ax.barh([str(v) for v in vc.index][::-1], vc.values[::-1], color='#1a1b4a')
        ax.set_title('Etnia (top 10 códigos crudos)', fontsize=10)
        plots['etnia'] = fig_to_base64(fig)

    return {'title': 'E · Estratificación demográfica', 'plots': plots}


def block_f_temporalidad(df: pd.DataFrame, tipo: str) -> dict:
    """Bloque F — meses vacíos, ruptura 2020-2021."""
    anio_col = 'anio_egr' if tipo == 'egresos' else 'anio_fall'
    mes_col  = 'mes_egr'  if tipo == 'egresos' else 'mes_fall'

    months_by_year = {}
    if anio_col in df.columns and mes_col in df.columns:
        tmp = df[[anio_col, mes_col]].dropna()
        if not tmp.empty:
            grp = tmp.groupby([anio_col, mes_col]).size().unstack(fill_value=0)
            months_by_year = {int(y): {int(m): int(v) for m, v in row.items()}
                               for y, row in grp.iterrows()}

    # Caída pandemia: comparar 2020 vs promedio (2017-2019)
    pandemic = None
    if len(df) and anio_col in df.columns:
        yearly = df[anio_col].value_counts().sort_index()
        pre = yearly.loc[[y for y in (2017, 2018, 2019) if y in yearly.index]].mean()
        pandemic = {
            'pre_2020_avg': float(pre) if pd.notna(pre) else None,
            'n_2020': int(yearly.get(2020, 0)),
            'n_2021': int(yearly.get(2021, 0)),
            'delta_2020_pct': round((yearly.get(2020, 0) - pre) / pre * 100, 2) if pre else None,
        }

    # Detectar meses-cero
    zero_months = []
    for y, months in months_by_year.items():
        for m in range(1, 13):
            if months.get(m, 0) == 0:
                zero_months.append({'anio': y, 'mes': m})

    return {
        'title': 'F · Temporalidad (rupturas + huecos)',
        'months_by_year': months_by_year,
        'pandemic': pandemic,
        'zero_months': zero_months[:30],
        'n_zero_months_total': len(zero_months),
    }


def block_g_contraste(df_egr, df_def) -> dict:
    """Bloque G — proporción defunciones/egresos por grupo ENT (letalidad indirecta)."""
    if df_egr is None or df_def is None:
        return {'title': 'G · Contraste Defunciones vs Egresos',
                'note': 'Solo disponible cuando se procesan ambos tipos en la misma corrida.'}

    def agg_ent(df, cause_col):
        codes = df[cause_col].dropna().astype(str).map(C.normalize_cie10)
        grp = codes.map(lambda c: C.classify_cie10(c) or 'no_clasificado')
        return grp.value_counts()

    ve = agg_ent(df_egr, 'cau_cie10')
    vd = agg_ent(df_def, 'causa4')
    rows = []
    for k in list(C.ENT_KEYS):
        n_eg = int(ve.get(k, 0))
        n_def = int(vd.get(k, 0))
        ratio = (n_def / n_eg * 100) if n_eg else None
        rows.append({
            'grupo': k,
            'label': C.ENT_GRUPOS[k]['label'],
            'egresos':     n_eg,
            'defunciones': n_def,
            'ratio_mort_sobre_egr_pct': round(ratio, 2) if ratio is not None else None,
        })
    return {'title': 'G · Contraste Defunciones vs Egresos', 'rows': rows,
            'note': 'Ratio alto sugiere alta letalidad hospitalaria o subreporte de egresos.'}


# ──────────────────────────────────────────────────────────────────────────
# Render HTML
# ──────────────────────────────────────────────────────────────────────────
def render_html(blocks: dict, meta: dict) -> str:
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=select_autoescape(['html', 'xml']),
    )
    tpl = env.get_template('profile_report.html.j2')
    return tpl.render(blocks=blocks, meta=meta)


def profile_tipo(tipo: str, use_cache: bool = True, df_other: pd.DataFrame | None = None
                 ) -> tuple[pd.DataFrame, str]:
    df, info = load_all(tipo, use_cache=use_cache)
    crit_cols = C.CRITICAL_COLS_EGR if tipo == 'egresos' else C.CRITICAL_COLS_DEF

    blocks = {
        'A': block_a_volumen(df, info, tipo),
        'B': block_b_calidad(df, crit_cols),
        'C': block_c_geografia(df, tipo),
        'D': block_d_cie10(df, tipo),
        'E': block_e_demografia(df),
        'F': block_f_temporalidad(df, tipo),
    }
    if tipo == 'egresos' and df_other is not None:
        blocks['G'] = block_g_contraste(df, df_other)
    elif tipo == 'defunciones' and df_other is not None:
        blocks['G'] = block_g_contraste(df_other, df)

    meta = {
        'tipo': tipo,
        'generado': datetime.now().isoformat(timespec='seconds'),
        'pipeline_version': '0.1.0',
        'n_rows': int(len(df)),
        'n_cols': int(len(df.columns)),
        'years':  sorted(int(y) for y in df['anio'].unique()),
        'hashes': info.get('hashes', {}),
    }

    html = render_html(blocks, meta)
    out_html = C.INTERMEDIATE / f'profile_{tipo}.html'
    out_html.write_text(html, encoding='utf-8')
    print(f"[profile] HTML → {out_html.relative_to(C.ROOT)}", file=sys.stderr)

    # JSON paralelo (sin imágenes) para diff en corridas futuras
    compact = {k: {kk: vv for kk, vv in v.items() if not str(kk).startswith('plot') and kk != 'heatmap'}
               for k, v in blocks.items()}
    out_json = C.INTERMEDIATE / f'profile_{tipo}_data.json'
    out_json.write_text(json.dumps({'meta': meta, 'blocks': compact},
                                   indent=2, ensure_ascii=False, default=str),
                        encoding='utf-8')
    print(f"[profile] JSON → {out_json.relative_to(C.ROOT)}", file=sys.stderr)
    return df, str(out_html)


def main():
    p = argparse.ArgumentParser(description='Perfilado de datos crudos INEC')
    p.add_argument('--tipo', choices=['egresos', 'defunciones', 'both'], default='both')
    p.add_argument('--no-cache', action='store_true', help='Fuerza rebuild del parquet')
    args = p.parse_args()

    use_cache = not args.no_cache

    df_egr = df_def = None
    if args.tipo in ('egresos', 'both'):
        df_egr, _ = profile_tipo('egresos', use_cache=use_cache)
    if args.tipo in ('defunciones', 'both'):
        df_def, _ = profile_tipo('defunciones', use_cache=use_cache, df_other=df_egr)
    # si quisimos ambos, regenerar egresos con bloque G cruzado
    if args.tipo == 'both' and df_def is not None:
        profile_tipo('egresos', use_cache=True, df_other=df_def)

    print('\n[profile] Listo. Abre los HTML en el navegador:', file=sys.stderr)
    for t in (('egresos',), ('defunciones',))[:(1 if args.tipo != 'both' else 2)]:
        fp = C.INTERMEDIATE / f'profile_{t[0]}.html'
        if fp.exists():
            print(f'  · file:///{fp.as_posix()}', file=sys.stderr)


if __name__ == '__main__':
    main()
