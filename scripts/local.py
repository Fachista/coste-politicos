"""Nivel local por comunidad autónoma.

- Alcaldes y concejales: ISPA (lo percibido por cada persona, con asistencias). Si un ayuntamiento no
  envió datos a ISPA, se usa su concepto 100 (órganos de gobierno) de la liquidación en CONPREL.
- Diputaciones, cabildos y consejos insulares: ISPA (presidentes y diputados/consejeros); las que no
  enviaron datos, desde CONPREL.
- Comarcas, mancomunidades, áreas metropolitanas y entidades menores: CONPREL, concepto 100.
- Asesores (personal eventual): CONPREL, concepto 110, todas las entidades locales.
- Directivos: CONPREL, concepto 101, todas las entidades locales.
Ceuta y Melilla se excluyen: ya cuentan en el nivel autonómico.

Lee datos/fuentes/<año>/ispa y conprel; escribe datos/<año>/local_ccaa.json y datos/<año>/municipios.csv
(todos los municipios con su población, para el buscador de la web).
Uso: py scripts/local.py [año]
"""
import collections
import csv
import json
import re
import unicodedata
import warnings

import openpyxl
import pyodbc

from comun import SALIDAS, ruta

warnings.filterwarnings("ignore")
ISPA = ruta("ispa")
CONPREL = ruta("conprel", "Liquidaciones.accdb")
SALIDA = SALIDAS / "local_ccaa.json"

# Código de comunidad en CONPREL -> nombre usado en la web
CCAA_CONPREL = {
    "01": "Andalucía", "02": "Aragón", "03": "Asturias", "04": "Illes Balears", "05": "Canarias",
    "06": "Cantabria", "07": "Castilla y León", "08": "Castilla-La Mancha", "09": "Cataluña",
    "10": "Extremadura", "11": "Galicia", "12": "Comunidad de Madrid", "13": "Región de Murcia",
    "14": "Navarra", "15": "País Vasco", "16": "La Rioja", "17": "Comunitat Valenciana",
}
OTRAS = {"AE": "entidades menores", "GG": "comunidades de villa y tierra", "MM": "mancomunidades",
         "RR": "comarcas", "TT": "áreas metropolitanas"}


def norm(texto):
    """Normaliza nombres de municipio: sin tildes ni signos, artículo pospuesto delante."""
    t = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode().lower().strip()
    m = re.match(r"^(.*?)\s*\((el|la|los|las|l'|els|les|o|a|os|as|lo|s'|es|sa|ses|le)\)$", t)
    if m:
        t = m.group(2) + " " + m.group(1)
    return re.sub(r"[^a-z0-9]", "", t)


def variantes(texto):
    """Nombres bilingües ('Alacant/Alicante'): devuelve todas las formas normalizadas."""
    partes = re.split(r"\s*/\s*|\s*-\s*(?=[A-ZÁÉÍÓÚ])", str(texto))
    return {norm(p) for p in partes if p.strip()} | {norm(texto)}


def leer_tabla(ruta, cabecera):
    ws = openpyxl.load_workbook(ruta, read_only=True, data_only=True).worksheets[0]
    filas = [[c for c in r if c is not None] for r in ws.iter_rows(values_only=True)]
    i = next(k for k, r in enumerate(filas) if r and str(r[0]).strip().upper().startswith(cabecera))
    return [r for r in filas[i + 1:] if len(r) >= 3]


def main():
    con = pyodbc.connect(r"DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=" + str(CONPREL) + ";ReadOnly=1")
    cur = con.cursor()
    prov_ccaa = {r.Provincia.strip(): r.CCAA.strip() for r in cur.execute("SELECT Provincia, CCAA FROM tb_Provincias")}
    prov_var = {r.Provincia.strip(): variantes(r.Nombre.strip()) for r in cur.execute("SELECT Provincia, Nombre FROM tb_Provincias")}
    # Ajustes de nombres de provincia que difieren entre fuentes
    for cod, extra in {"01": {"alava", "araba"}, "07": {"illesbalears", "balears", "baleares"}, "20": {"gipuzkoa", "guipuzcoa"},
                       "48": {"bizkaia", "vizcaya"}, "15": {"acoruna", "lacoruna"}, "35": {"laspalmas", "palmaslas"},
                       "38": {"santacruzdetenerife"}, "12": {"castellon", "castello"}, "46": {"valencia"}, "03": {"alicante", "alacant"}}.items():
        prov_var.setdefault(cod, set()).update(extra)

    def provincia(nombre):
        v = variantes(nombre)
        return next((c for c, vs in prov_var.items() if v & vs), None)

    # --- Inventario CONPREL ---
    ente = {}       # idente -> (codente, nombre, nombre principal, poblacion)
    for r in cur.execute("SELECT idente, codente, nombreente, nombreppal, poblacion FROM tb_inventario"):
        ente[int(r.idente)] = (r.codente.strip(), r.nombreente.strip(), r.nombreppal.strip(), int(r.poblacion or 0))
    imp = collections.defaultdict(collections.Counter)   # idente -> {100,101,110}
    for r in cur.execute("SELECT idente, cdcta, importer FROM tb_economica WHERE tipreig='G' AND cdcta IN ('100   ','101   ','110   ')"):
        imp[int(r.idente)][r.cdcta.strip()] += float(r.importer or 0)

    def ccaa_de(codente):
        return CCAA_CONPREL.get(prov_ccaa.get(codente[:2], ""))

    # Ayuntamientos de CONPREL por (provincia, nombre normalizado)
    aytos_conprel = {}
    for i, (cod, nom, ppal, pob) in ente.items():
        if cod[5:7] == "AA":
            for v in variantes(nom):
                aytos_conprel[(cod[:2], v)] = i

    res = collections.defaultdict(lambda: collections.defaultdict(float))
    # Detalle por municipio: (provincia, nombre normalizado) -> nombre, electos, asesores
    municipios = collections.defaultdict(dict)

    def muni(cc, cp, nombre):
        claves = [(cp, v) for v in variantes(nombre)]
        clave = next((k for k in claves if k in municipios[cc]), claves[0])
        return municipios[cc].setdefault(clave, {"nombre": str(nombre), "provincia": cp, "electos": 0.0, "eventual": 0.0})
    avisos = collections.defaultdict(list)

    # --- Alcaldes y concejales (ISPA) ---
    ccaa_ispa = {}
    for fichero in ("retribuciones_alcaldes.xlsx", "retribuciones_concejales.xlsx"):
        for r in leer_tabla(ISPA / fichero, "AYUNTAMIENTO"):
            if len(r) < 5 or not isinstance(r[4], (int, float)):
                continue
            ayto, prov, total = r[0], r[1], float(r[4])
            cp = provincia(prov)
            if cp is None:
                raise SystemExit(f"Provincia sin reconocer en ISPA: {prov}")
            cc = CCAA_CONPREL.get(prov_ccaa[cp])
            if cc is None:
                continue
            res[cc]["electos_aytos"] += total
            muni(cc, cp, ayto)["electos"] += total
            ccaa_ispa[(cp, norm(ayto))] = cc

    # --- Ayuntamientos que no enviaron datos a ISPA: se toman de CONPREL si existen ---
    for r in leer_tabla(ISPA / "ayuntamientos_sin_remitir.xlsx", "AYUNTAMIENTO"):
        if len(r) < 4 or not isinstance(r[3], (int, float)):
            continue
        ayto, prov, pob = str(r[0]).rstrip("* ").strip(), r[1], int(r[3])
        cp = provincia(prov)
        if cp is None or CCAA_CONPREL.get(prov_ccaa.get(cp)) is None:
            continue
        cc = CCAA_CONPREL[prov_ccaa[cp]]
        if (cp, norm(ayto)) in ccaa_ispa:
            continue   # aparece también en ISPA (remitido sin firma)
        idente = next((aytos_conprel[(cp, v)] for v in variantes(ayto) if (cp, v) in aytos_conprel), None)
        if idente is not None and imp[idente]["100"] > 0:
            res[cc]["electos_aytos_conprel"] += imp[idente]["100"]
            res[cc]["pob_imputada"] += pob
            muni(cc, cp, ayto)["electos"] += imp[idente]["100"]
        else:
            res[cc]["pob_sin_datos"] += pob

    # --- Diputaciones, cabildos y consejos insulares (ISPA) ---
    def ccaa_corporacion(nombre):
        n = norm(nombre)
        if n.startswith("cabildo"):
            return "Canarias"
        if n.startswith("consellinsular") or n.startswith("consejoinsular"):
            return "Illes Balears"
        m = re.search(r"(?:provincial|foral) de (.+)$", str(nombre), re.I)
        cp = provincia(m.group(1)) if m else None
        return CCAA_CONPREL.get(prov_ccaa.get(cp, ""))

    for r in leer_tabla(ISPA / "presidentes_diputaciones.xlsx", "DIPUTACI"):
        if isinstance(r[-1], (int, float)):
            cc = ccaa_corporacion(r[0])
            if cc is None:
                raise SystemExit(f"Corporación sin comunidad: {r[0]}")
            res[cc]["diputaciones"] += float(r[-1])
    for r in leer_tabla(ISPA / "consejeros_diputaciones.xlsx", "DIPUTADO/A"):
        if len(r) >= 4 and isinstance(r[3], (int, float)):
            cc = ccaa_corporacion(r[1])
            if cc is None:
                raise SystemExit(f"Corporación sin comunidad: {r[1]}")
            res[cc]["diputaciones"] += float(r[3])
    # Las que no remitieron a ISPA (Cuenca, Guadalajara, Formentera, Fuerteventura): CONPREL
    for i, (cod, nom, ppal, pob) in ente.items():
        n = norm(nom)
        if cod[5:7] == "DD" and any(x in n for x in ("cuenca", "guadalajara", "fuerteventura")):
            res[ccaa_de(cod)]["diputaciones_conprel"] += imp[i]["100"]
    # Formentera: su consell insular va integrado en el ayuntamiento de Formentera (nota de CONPREL)

    # --- CONPREL: otras entidades, asesores y directivos ---
    for i, (cod, nom, ppal, pob) in ente.items():
        cc = ccaa_de(cod)
        if cc is None:
            continue   # Ceuta, Melilla
        tipo = cod[5:7]
        if tipo in OTRAS:
            res[cc]["otras_entidades"] += imp[i]["100"]
        res[cc]["eventual"] += imp[i]["110"]
        res[cc]["directivos"] += imp[i]["101"]
        if tipo in ("AA", "AO", "AV") and imp[i]["110"]:
            # Asesores del ayuntamiento y de sus organismos, para el detalle por municipio
            muni(cc, cod[:2], ppal)["eventual"] += imp[i]["110"]

    # Cobertura de CONPREL (asesores y directivos): ayuntamientos presentes frente a ISPA
    aytos_cp = collections.Counter(ccaa_de(c) for c, *_ in ente.values() if c[5:7] == "AA")
    if aytos_cp["Navarra"] < 100:
        avisos["Navarra"].append(f"Asesores municipales: Hacienda solo publica la liquidación de {aytos_cp['Navarra']} ayuntamientos navarros (Pamplona incluida).")
    alava = [nom for c, nom, *_ in ente.values() if c[:2] == "01" and c[5:7] == "AA"]
    if len(alava) < 10:
        avisos["País Vasco"].append("Asesores municipales: Hacienda no incluye los ayuntamientos de Álava, tampoco Vitoria-Gasteiz.")

    # Todos los municipios, con su población (inventario de CONPREL), para el buscador de la web
    nombres_prov = {cp: r for cp, r in ((r.Provincia.strip(), r.Nombre.strip())
                                        for r in cur.execute("SELECT Provincia, Nombre FROM tb_Provincias"))}
    with open(SALIDAS / "municipios.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ccaa", "provincia", "municipio", "poblacion", "electos", "eventual"])
        for cc in CCAA_CONPREL.values():
            for (cp, _), m in sorted(municipios[cc].items(), key=lambda x: x[1]["nombre"]):
                idente = next((aytos_conprel[(cp, v)] for v in variantes(m["nombre"]) if (cp, v) in aytos_conprel), None)
                pob = ente[idente][3] if idente is not None else 0
                w.writerow([cc, nombres_prov.get(cp, cp), m["nombre"], pob, round(m["electos"]), round(m["eventual"])])
    print("->", SALIDAS / "municipios.csv")

    salida = {}
    for cc in CCAA_CONPREL.values():
        d = res[cc]
        # Detalle: los 15 municipios con más gasto en electos + asesores
        top = sorted(municipios[cc].values(), key=lambda m: -(m["electos"] + m["eventual"]))[:15]
        salida[cc] = {
            "electos_aytos": round(d["electos_aytos"] + d["electos_aytos_conprel"]),
            "electos_aytos_conprel": round(d["electos_aytos_conprel"]),
            "diputaciones": round(d["diputaciones"] + d["diputaciones_conprel"]),
            "otras_entidades": round(d["otras_entidades"]),
            "eventual": round(d["eventual"]),
            "directivos": round(d["directivos"]),
            "pob_sin_datos": int(d["pob_sin_datos"]),
            "pob_imputada": int(d["pob_imputada"]),
            "avisos": avisos.get(cc, []),
            "municipios": [{"nombre": m["nombre"], "electos": round(m["electos"]), "eventual": round(m["eventual"])} for m in top],
        }
        s = salida[cc]
        print(f"{cc:22s} aytos={s['electos_aytos'] / 1e6:6.1f} (cp {s['electos_aytos_conprel'] / 1e6:4.1f}) dip={s['diputaciones'] / 1e6:5.1f} "
              f"otras={s['otras_entidades'] / 1e6:4.1f} event={s['eventual'] / 1e6:5.1f} direct={s['directivos'] / 1e6:5.1f} "
              f"sin datos={s['pob_sin_datos']:>8,}")
    tot = collections.Counter()
    for s in salida.values():
        tot.update({k: v for k, v in s.items() if isinstance(v, int)})
    print("TOTAL", {k: f"{v / 1e6:.1f}M" if v > 1e5 else v for k, v in tot.items()})
    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    print("->", SALIDA)


if __name__ == "__main__":
    main()
