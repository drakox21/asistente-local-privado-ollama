"""Escenario, no factura. USD; no llamadas de red."""
import json, statistics
from pathlib import Path
rows=json.loads((Path(__file__).resolve().parents[1]/"evidencias/mediciones.json").read_text(encoding="utf-8"))["resultados"]
inp=statistics.mean(r["entrada_tokens"] for r in rows)
out=statistics.mean(r["salida_tokens"] for r in rows)
seconds=statistics.mean(r["total_s"] for r in rows[1:])
for volume in (1000,10000,100000):
 api=volume*(inp*.10+out*.10)/1e6
 energy=.35*seconds*volume/3600*.15
 local=1500/36+2*15+energy
 print(f"{volume} consultas: API estimada USD {api:.4f}; local escenario USD {local:.2f}; electricidad activa USD {energy:.4f}")
