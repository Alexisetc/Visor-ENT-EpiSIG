"""Pipeline ENT — procesamiento reproducible de datos crudos INEC
(Egresos Hospitalarios + Defunciones Generales) para el Visor EpiSIG.

Fases:
  0. Organización de inputs (manual, ya ejecutado)
  1. Perfilado de calidad → HTML (`01_profile.py`)
  2. Limpieza y clasificación ENT (`02_clean.py`)
  3. Cálculo de tasas parroquiales (`03_rates.py`)
  4. Tendencias MK + Sen + FDR (`04_trends.py`)
  5. Export JSON al visor React (`05_export_visor.py`)
"""
__version__ = "0.1.0"
