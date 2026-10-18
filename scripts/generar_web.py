"""Genera docs/datos.json para la web a partir de los resultados del año (datos/<año>/) y la población del INE.

Uso: py scripts/generar_web.py [año]
"""
import collections
import csv
import datetime
import json

from comun import ANYO, RAIZ, SALIDAS, metadatos, ruta

ENTRADA = SALIDAS / "autonomico_unidades.csv"
LOCAL = SALIDAS / "local_ccaa.json"
ESTATAL = SALIDAS / "estatal.json"
SALIDA = RAIZ / "docs" / "datos.json"
# Población a mitad del año de los datos; si el INE aún no la tiene, la fecha disponible más cercana
FECHAS_POBLACION = [f"{ANYO}-07-01", f"{ANYO + 1}-01-01", f"{ANYO}-01-01"]

# Código INE de comunidad (el mismo que usa el mapa) y nombre en la tabla 56940 del INE
CCAA = {
    "Andalucía": ("01", "Andalucía"),
    "Aragón": ("02", "Aragón"),
    "Asturias": ("03", "Asturias, Principado de"),
    "Illes Balears": ("04", "Balears, Illes"),
    "Canarias": ("05", "Canarias"),
    "Cantabria": ("06", "Cantabria"),
    "Castilla y León": ("07", "Castilla y León"),
    "Castilla-La Mancha": ("08", "Castilla - La Mancha"),
    "Cataluña": ("09", "Cataluña"),
    "Comunitat Valenciana": ("10", "Comunitat Valenciana"),
    "Extremadura": ("11", "Extremadura"),
    "Galicia": ("12", "Galicia"),
    "Comunidad de Madrid": ("13", "Madrid, Comunidad de"),
    "Región de Murcia": ("14", "Murcia, Región de"),
    "Navarra": ("15", "Navarra, Comunidad Foral de"),
    "País Vasco": ("16", "País Vasco"),
    "La Rioja": ("17", "Rioja, La"),
    "Ceuta": ("18", "Ceuta"),
    "Melilla": ("19", "Melilla"),
}

def poblacion():
    global FECHA_POBLACION
    datos = json.loads(ruta("ine", "poblacion.json").read_text(encoding="utf-8"))
    fechas = {p["Fecha"][:10] for serie in datos for p in serie["Data"]}
    FECHA_POBLACION = next((f for f in FECHAS_POBLACION if f in fechas), None)
    if FECHA_POBLACION is None:
        raise SystemExit(f"El INE no tiene población de {ANYO} en ruta {ruta('ine', 'poblacion.json')}")
    pob = {}
    for serie in datos:
        nombre = serie["Nombre"]
        if "Todas las edades" not in nombre or "Hombres" in nombre or "Mujeres" in nombre:
            continue
        for p in serie["Data"]:
            if p["Fecha"].startswith(FECHA_POBLACION):
                pob[nombre] = int(p["Valor"])
    salida = {}
    for ccaa, (_, nombre_ine) in CCAA.items():
        clave = next((k for k in pob if f". {nombre_ine}. " in k), None)
        if clave is None:
            raise SystemExit(f"El INE aún no publica la población a {FECHA_POBLACION} de {ccaa}")
        salida[ccaa] = pob[clave]
    salida["_total"] = next(v for k, v in pob.items() if k.startswith("Total Nacional"))
    return salida


def main():
    meta = metadatos()
    pob = poblacion()
    local = json.loads(LOCAL.read_text(encoding="utf-8"))
    por_ccaa = collections.defaultdict(list)
    with open(ENTRADA, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            por_ccaa[r["ccaa"]].append(r)

    comunidades = []
    for ccaa, (codigo, _) in CCAA.items():
        filas = por_ccaa[ccaa]
        if not filas:
            print(f"AVISO: {ccaa} no tiene datos autonómicos de {ANYO}; queda fuera de la web")
            continue
        partes = collections.defaultdict(lambda: {"altos": 0.0, "eventual": 0.0})
        unidades = collections.defaultdict(lambda: {"altos": 0.0, "eventual": 0.0})
        fuentes = {}
        for r in filas:
            campo = "altos" if r["articulo"] == "10" else "eventual"
            imp = float(r["importe"])
            partes[r["tipo"]][campo] += imp
            unidades[(r["unidad"], r["tipo"])][campo] += imp
            fuentes[r["url"]] = r["fuente"]
        partes = {t: {k: round(v) for k, v in p.items()} for t, p in partes.items()}
        avisos = []
        municipios = []
        if ccaa in local:
            l = local[ccaa]
            partes["local"] = {"electos": l["electos_aytos"], "diputaciones": l["diputaciones"] + l["otras_entidades"],
                               "eventual": l["eventual"], "directivos": l["directivos"]}
            avisos += l["avisos"]
            if l["pob_sin_datos"] > 0.02 * pob[ccaa]:
                habitantes = f"{l['pob_sin_datos']:,}".replace(",", ".")
                pct = 100 * l["pob_sin_datos"] / pob[ccaa]
                avisos.append(f"Alcaldes y concejales: sin datos de municipios con {habitantes} habitantes ({pct:.0f} % de la población).")
            municipios = l["municipios"]
        comunidades.append({
            "id": codigo,
            "nombre": ccaa,
            "poblacion": pob[ccaa],
            "base": filas[0]["base"],
            "partes": partes,
            "unidades": sorted(
                [{"nombre": u, "tipo": t, "altos": round(v["altos"]), "eventual": round(v["eventual"])}
                 for (u, t), v in unidades.items()],
                key=lambda x: -(x["altos"] + x["eventual"])),
            "fuentes": [{"texto": t, "url": u} for u, t in fuentes.items()],
            "faltan": meta["faltan"].get(ccaa, []),
            "avisos": avisos,
            "municipios": municipios,
            "notas": meta["notas"].get(ccaa, []),
        })

    salida = {
        "anyo": ANYO,
        "generado": datetime.date.today().isoformat(),
        "poblacion": {"fecha": FECHA_POBLACION, "total": pob["_total"],
                      "fuente": "INE, Estadística Continua de Población (tabla 56940)",
                      "url": "https://www.ine.es/jaxiT3/Tabla.htm?t=56940"},
        "fuentes_local": meta["local"],
        "comunidades": comunidades,
        "estado": json.loads(ESTATAL.read_text(encoding="utf-8")),
    }
    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")

    # Resumen por consola: opción por defecto de la web (gobierno + parlamento + local sin directivos)
    filas = []
    for c in comunidades:
        p = c["partes"]
        nucleo = sum(p.get(t, {}).get(k, 0) for t in ("gobierno", "parlamento") for k in ("altos", "eventual"))
        nucleo += sum(p.get("local", {}).get(k, 0) for k in ("electos", "diputaciones", "eventual"))
        filas.append((nucleo / c["poblacion"], c["nombre"], nucleo))
    for per, nombre, tot in sorted(filas, reverse=True):
        print(f"{nombre:22s} {tot / 1e6:6.1f} M€  {per:6.2f} €/hab")
    print("->", SALIDA)


if __name__ == "__main__":
    main()
