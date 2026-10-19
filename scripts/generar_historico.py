"""Genera docs/historico.json: evolución del Gobierno central, sueldos de altos cargos y contexto.

Entradas (todas en datos/historico/):
- estado_pge.csv y sueldos.json (scripts/historico_estado.py y scripts/sueldos.py);
- contexto.csv: inflación y población de España por año (se crea con --contexto, ver abajo).

Inflación y población: Banco Mundial (indicadores FP.CPI.TOTL.ZG y SP.POP.TOTL, que toman los datos
del INE), en la copia de datahub (https://github.com/datasets/cpi y https://github.com/datasets/population).
Para regenerar contexto.csv: py scripts/generar_historico.py --contexto <ruta a cpi.csv> <ruta a population.csv>

Uso: py scripts/generar_historico.py
"""
import collections
import csv
import datetime
import json
import re
import sys

from comun import RAIZ

HIST = RAIZ / "datos" / "historico"
SALIDA = RAIZ / "docs" / "historico.json"

# Años sin ley de presupuestos nueva: rige la del año indicado (prorrogada)
PRORROGADOS = {2019: 2018, 2020: 2018, 2024: 2023, 2025: 2023}
ULTIMO = 2025

# Presidentes del Gobierno desde 1977 (fecha de toma de posesión)
GOBIERNOS = [
    {"presidente": "Adolfo Suárez", "partido": "UCD", "desde": "1977-07-04"},
    {"presidente": "Leopoldo Calvo-Sotelo", "partido": "UCD", "desde": "1981-02-26"},
    {"presidente": "Felipe González", "partido": "PSOE", "desde": "1982-12-02"},
    {"presidente": "José María Aznar", "partido": "PP", "desde": "1996-05-05"},
    {"presidente": "José Luis Rodríguez Zapatero", "partido": "PSOE", "desde": "2004-04-17"},
    {"presidente": "Mariano Rajoy", "partido": "PP", "desde": "2011-12-21"},
    {"presidente": "Pedro Sánchez", "partido": "PSOE", "desde": "2018-06-02"},
]

# Gobierno que elaboró cada presupuesto (no siempre el que lo ejecutó: el de 2018 lo preparó el Gobierno de
# Rajoy y lo aplicó el de Sánchez; 2019 y 2020 prorrogaron ese mismo presupuesto)
AUTOR = {**{a: "José Luis Rodríguez Zapatero" for a in range(2007, 2012)},
         **{a: "Mariano Rajoy" for a in range(2012, 2021)},
         **{a: "Pedro Sánchez" for a in range(2021, 2026)}}

ESTATUTARIOS = {"03": "Tribunal de Cuentas", "04": "Tribunal Constitucional", "05": "Consejo de Estado",
                "08": "Consejo General del Poder Judicial"}
CATEGORIAS = [
    ("gobierno_altos", "Altos cargos de los ministerios"),
    ("gobierno_asesores", "Asesores de los ministerios"),
    ("congreso", "Congreso de los Diputados"),
    ("senado", "Senado"),
    ("justicia", "Cúpula judicial y fiscal (Ministerio de Justicia)"),
    ("organos", "Órganos constitucionales y otros"),
    ("organismos", "Organismos públicos"),
]


def categoria(r):
    s, cg = r["seccion"], r["centro"]
    if s == "02":
        return {"02002": "congreso", "02003": "senado"}.get(cg, "organos")
    if s in ESTATUTARIOS:
        return "organos"
    if r["programa"][:4] in ("112A", "112B"):
        return "justicia"   # Tribunales de justicia y Ministerio Fiscal: altos cargos de la carrera judicial y fiscal
    if cg[2] != "0" or s == "60":
        return "organismos"
    return "gobierno_altos" if r["articulo"] == "10" else "gobierno_asesores"


MINUSCULAS = {"de", "del", "la", "las", "los", "el", "y", "e", "con", "para", "en", "a", "al", "por"}


def nombre_ministerio(texto):
    """'Ministerio Para La Transición Ecológica Y El Reto Demográfico' -> 'Transición Ecológica y el Reto Demográfico'."""
    t = re.sub(r"^Ministerio (?:de |del |para (?:la |el )?)?", "", texto, flags=re.I).strip()
    t = re.sub(r"^(?:la|el|los) ", "", t, flags=re.I)
    palabras = t.split(" ")
    return " ".join(p.lower() if i and p.lower() in MINUSCULAS else p for i, p in enumerate(palabras))


def es_ministerio(r):
    return r["seccion_nombre"].lower().startswith("ministerio") and r["centro"][2] == "0"


def gobierna(anyo):
    """Presidente que gobernó la mayor parte del año."""
    mitad = f"{anyo}-07-01"
    return [g["presidente"] for g in GOBIERNOS if g["desde"] <= mitad][-1]


def contexto(cpi, pob):
    filas = {}
    with open(cpi, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["Country Code"] == "ESP":
                filas.setdefault(int(r["Year"]), {})["inflacion"] = round(float(r["CPI"]), 3)
    with open(pob, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["Country Code"] == "ESP":
                filas.setdefault(int(r["Year"]), {})["poblacion"] = int(float(r["Value"]))
    with open(HIST / "contexto.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["anyo", "inflacion", "poblacion"])
        for a in sorted(filas):
            w.writerow([a, filas[a].get("inflacion", ""), filas[a].get("poblacion", "")])
    print("->", HIST / "contexto.csv")


def main():
    if "--contexto" in sys.argv:
        i = sys.argv.index("--contexto")
        contexto(sys.argv[i + 1], sys.argv[i + 2])
    ctx = {}
    with open(HIST / "contexto.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            ctx[int(r["anyo"])] = {"inflacion": float(r["inflacion"]) if r["inflacion"] else None,
                                   "poblacion": int(r["poblacion"]) if r["poblacion"] else None}
    # Índice de precios encadenado (base: último año con inflación conocida = 100)
    anyos_ipc = sorted(a for a, v in ctx.items() if v["inflacion"] is not None)
    base_ipc = anyos_ipc[-1]
    indice = {anyos_ipc[0]: 1.0}
    for a in anyos_ipc[1:]:
        indice[a] = indice[a - 1] * (1 + ctx[a]["inflacion"] / 100)
    factor = {a: indice[base_ipc] / v for a, v in indice.items()}   # multiplica € del año a -> € de base_ipc

    cat = collections.defaultdict(collections.Counter)
    ministerios = collections.defaultdict(lambda: collections.defaultdict(collections.Counter))
    n_min = collections.defaultdict(set)
    n_se = collections.defaultdict(set)
    with open(HIST / "estado_pge.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            a, imp = int(r["anyo"]), int(r["importe"])
            cat[a][categoria(r)] += imp
            if es_ministerio(r) and categoria(r).startswith("gobierno"):
                nombre = nombre_ministerio(r["seccion_nombre"])
                ministerios[a][nombre]["altos" if r["articulo"] == "10" else "asesores"] += imp
                n_min[a].add(r["seccion"])
                if r["articulo"] == "10" and r["centro_nombre"].lower().startswith("secretaría de estado"):
                    n_se[a].add(r["centro"])
    for a, origen in PRORROGADOS.items():
        cat[a] = cat[origen]
        ministerios[a] = ministerios[origen]
        n_min[a], n_se[a] = n_min[origen], n_se[origen]

    serie = []
    for a in range(min(cat), ULTIMO + 1):
        c = cat[a]
        pob = ctx.get(a, {}).get("poblacion")
        total = sum(c.values())
        serie.append({
            "anyo": a,
            "prorrogado": PRORROGADOS.get(a),
            "autor": AUTOR[a],
            "gobierna": gobierna(a),
            **{k: c[k] for k, _ in CATEGORIAS},
            "total": total,
            "poblacion": pob,
            "factor_ipc": round(factor[a], 4) if a in factor else None,
            "ministerios": len(n_min[a]),
            "secretarias_estado": len(n_se[a]),
            "por_ministerio": sorted(
                [{"nombre": n, "altos": v["altos"], "asesores": v["asesores"]} for n, v in ministerios[a].items()],
                key=lambda x: -(x["altos"] + x["asesores"])),
        })
        print(a, f"{total / 1e6:6.1f} M€", f"{len(n_min[a])} ministerios", f"{len(n_se[a])} secr. Estado",
              "prorrogado de " + str(PRORROGADOS[a]) if a in PRORROGADOS else "")

    sueldos = json.loads((HIST / "sueldos.json").read_text(encoding="utf-8"))
    for s in sueldos["serie"]:
        s["factor_ipc"] = round(factor[s["anyo"]], 4) if s["anyo"] in factor else None
    salida = {
        "generado": datetime.date.today().isoformat(),
        "base_ipc": base_ipc,
        "categorias": [{"id": k, "nombre": n} for k, n in CATEGORIAS],
        "estado": serie,
        "gobiernos": GOBIERNOS,
        "sueldos": sueldos,
        "fuentes": [
            {"texto": "Presupuestos Generales del Estado 2007-2023, partida a partida (Fundación Civio, a partir de la SEPG)",
             "url": "https://github.com/civio/presupuesto-pge"},
            {"texto": "Leyes de Presupuestos Generales del Estado (BOE)", "url": "https://www.boe.es/buscar/legislacion.php"},
            {"texto": "Inflación (IPC) y población: Banco Mundial, con datos del INE",
             "url": "https://datos.bancomundial.org/indicador/FP.CPI.TOTL.ZG?locations=ES"},
        ],
    }
    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    print("->", SALIDA)


if __name__ == "__main__":
    main()
