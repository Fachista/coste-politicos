"""Nivel estatal (2024).

- Gobierno central: artículos 10 (altos cargos) y 11 (personal eventual) de los Presupuestos Generales del
  Estado vigentes ese año (en 2024, los de 2023 prorrogados). Resumen general por artículos y secciones (Estado, organismos
  autónomos y resto de entidades). Las secciones de ministerios son 'gobierno'; Tribunal de Cuentas,
  Tribunal Constitucional, Consejo de Estado y CGPJ, 'estatutario'; los organismos, 'organismo'.
  La sección 01 (Casa del Rey) no se cuenta y la 02 (Cortes) se sustituye por los datos propios de cada cámara.
- Congreso: informe de cumplimiento del presupuesto 2024 (créditos comprometidos).
- Senado: ejecución del presupuesto 2024 (obligaciones reconocidas).

Lee datos/fuentes/<año>/estado; escribe datos/<año>/estatal.json.
Uso: py scripts/estatal.py [año]
"""
import collections
import csv
import json
import re

import pdfplumber

from comun import SALIDAS, metadatos, num, ruta

SALIDA = SALIDAS / "estatal.json"

SECCIONES = {
    "01": "Casa de S.M. el Rey", "02": "Cortes Generales", "03": "Tribunal de Cuentas",
    "04": "Tribunal Constitucional", "05": "Consejo de Estado", "08": "Consejo General del Poder Judicial",
    "12": "Asuntos Exteriores, Unión Europea y Cooperación", "13": "Justicia", "14": "Defensa",
    "15": "Hacienda y Función Pública", "16": "Interior", "17": "Transportes, Movilidad y Agenda Urbana",
    "18": "Educación y Formación Profesional", "19": "Trabajo y Economía Social",
    "20": "Industria, Comercio y Turismo", "21": "Agricultura, Pesca y Alimentación",
    "22": "Política Territorial", "23": "Transición Ecológica y Reto Demográfico", "24": "Cultura y Deporte",
    "25": "Presidencia, Relaciones con las Cortes y Memoria Democrática", "26": "Sanidad",
    "27": "Asuntos Económicos y Transformación Digital", "28": "Ciencia e Innovación",
    "29": "Derechos Sociales y Agenda 2030", "30": "Igualdad", "31": "Gastos de diversos ministerios",
    "32": "Inclusión, Seguridad Social y Migraciones", "33": "Universidades", "34": "Consumo",
}
ESTATUTARIOS = {"03", "04", "05", "08"}
NO_CUENTAN = {"01", "02"}


def pge_por_secciones():
    """Devuelve {(bloque, seccion, articulo): miles €} y los totales de control de cada bloque."""
    c = collections.Counter()
    control = collections.Counter()
    with pdfplumber.open(ruta("estado", "pge_resumenes.pdf")) as pdf:
        for page in pdf.pages:
            texto = page.extract_text() or ""
            if "Resumen general por artículos y secciones del presupuesto de gastos" not in texto:
                continue
            bloque = texto.splitlines()[2].strip()   # ESTADO / ORGANISMOS AUTÓNOMOS / ...
            palabras = page.extract_words()
            cab = next((w["top"] for w in palabras if w["text"] == "Económica"), None)
            cols = []
            for i, w in enumerate(palabras):
                if cab is None or abs(w["top"] - cab) > 3:
                    continue
                if w["text"] == "Secc." and i + 1 < len(palabras):
                    cols.append((palabras[i + 1]["x1"], palabras[i + 1]["text"]))
                elif w["text"] in ("TOTAL", "Total"):
                    cols.append((w["x1"], "TOTAL"))
            if not cols:
                continue
            filas = []
            for w in sorted(palabras, key=lambda w: w["top"]):
                if filas and abs(filas[-1][0]["top"] - w["top"]) < 3:
                    filas[-1].append(w)
                else:
                    filas.append([w])
            for ws in filas:
                ws.sort(key=lambda w: w["x0"])
                if len(ws) < 3 or ws[0]["text"] not in ("10", "11") or ws[1]["text"] not in ("Altos", "Personal"):
                    continue
                for w in ws[2:]:
                    if re.fullmatch(r"[\d.]+,\d\d", w["text"]):
                        col = min(cols, key=lambda cx: abs(cx[0] - w["x1"]))[1]
                        if col == "TOTAL":
                            control[(bloque, ws[0]["text"])] += num(w["text"])
                        else:
                            c[(bloque, col, ws[0]["text"])] += num(w["text"])
    for (bloque, art), tot in control.items():
        suma = sum(v for (b, s, a), v in c.items() if b == bloque and a == art)
        assert abs(suma - tot) < 0.1, f"PGE {bloque} art{art}: {suma} != {tot}"
    return c, control


def congreso():
    """Informe de cumplimiento 2024, cuadro 6: concepto 100 (diputados) y 110 (personal eventual)."""
    imp = {}
    with pdfplumber.open(ruta("estado", "congreso_cumplimiento.pdf")) as pdf:
        for page in pdf.pages:
            for l in (page.extract_text() or "").splitlines():
                m = re.match(r"^Concepto (100|110) .*?\*? ([\d.]+,\d\d) [\d,]+ ([\d.]+,\d\d)", l)
                if m and m.group(1) not in imp:
                    imp[m.group(1)] = num(m.group(3))   # créditos comprometidos
    return {"altos": imp["100"], "eventual": imp["110"]}


def senado():
    """Ejecución 2024: concepto 100 (senadores) y 110 (personal eventual), obligaciones reconocidas."""
    imp = {}
    with open(ruta("estado", "senado_ejecucion.csv"), encoding="cp1252") as f:
        for r in csv.reader(f, delimiter=";"):
            cod = r[0].strip()[:3]
            if cod in ("100", "110") and len(r) > 5 and cod not in imp:
                imp[cod] = num(r[5])
    return {"altos": imp["100"], "eventual": imp["110"]}


# Diputados por circunscripción (Real Decreto 400/2023, anexo), agregados por comunidad
DIPUTADOS = {
    "Andalucía": 61, "Aragón": 13, "Asturias": 7, "Illes Balears": 8, "Canarias": 15, "Cantabria": 5,
    "Castilla y León": 31, "Castilla-La Mancha": 21, "Cataluña": 48, "Comunitat Valenciana": 33,
    "Extremadura": 9, "Galicia": 23, "Comunidad de Madrid": 37, "Región de Murcia": 10, "Navarra": 5,
    "País Vasco": 18, "La Rioja": 4, "Ceuta": 1, "Melilla": 1,
}
# Senadores electos (art. 69 de la Constitución: 4 por provincia peninsular, 3 por isla mayor, 1 por isla menor,
# 2 por Ceuta y Melilla) y designados por los parlamentos autonómicos (1 + 1 por millón de habitantes; 58 en la XV legislatura)
SENADORES_ELECTOS = {
    "Andalucía": 32, "Aragón": 12, "Asturias": 4, "Illes Balears": 5, "Canarias": 11, "Cantabria": 4,
    "Castilla y León": 36, "Castilla-La Mancha": 20, "Cataluña": 16, "Comunitat Valenciana": 12,
    "Extremadura": 8, "Galicia": 16, "Comunidad de Madrid": 4, "Región de Murcia": 4, "Navarra": 4,
    "País Vasco": 12, "La Rioja": 4, "Ceuta": 2, "Melilla": 2,
}
SENADORES_DESIGNADOS = {
    "Andalucía": 9, "Aragón": 2, "Asturias": 2, "Illes Balears": 2, "Canarias": 3, "Cantabria": 1,
    "Castilla y León": 3, "Castilla-La Mancha": 3, "Cataluña": 8, "Comunitat Valenciana": 6,
    "Extremadura": 2, "Galicia": 3, "Comunidad de Madrid": 7, "Región de Murcia": 2, "Navarra": 1,
    "País Vasco": 3, "La Rioja": 1,
}


def escanos():
    assert sum(DIPUTADOS.values()) == 350
    assert sum(SENADORES_ELECTOS.values()) == 208 and sum(SENADORES_DESIGNADOS.values()) == 58
    return {cc: {"congreso": DIPUTADOS[cc], "senado": SENADORES_ELECTOS[cc] + SENADORES_DESIGNADOS.get(cc, 0)}
            for cc in DIPUTADOS}


def main():
    pge, control = pge_por_secciones()
    partes = collections.defaultdict(lambda: {"altos": 0.0, "eventual": 0.0})
    unidades = collections.defaultdict(lambda: {"altos": 0.0, "eventual": 0.0})
    for (bloque, sec, art), miles in pge.items():
        if sec in NO_CUENTAN and bloque == "ESTADO":
            continue
        campo = "altos" if art == "10" else "eventual"
        if bloque != "ESTADO":
            tipo, nombre = "organismo", "Organismos y entes del Estado"
        elif sec in ESTATUTARIOS:
            tipo, nombre = "estatutario", SECCIONES.get(sec, "Sección " + sec)
        else:
            tipo, nombre = "gobierno", SECCIONES.get(sec, "Sección " + sec)
        partes[tipo][campo] += miles * 1000
        unidades[(nombre, tipo)][campo] += miles * 1000
    cg, sn = congreso(), senado()
    partes["congreso"] = cg
    partes["senado"] = sn
    salida = {
        "partes": {t: {k: round(v) for k, v in p.items()} for t, p in partes.items()},
        "unidades": sorted([{"nombre": n, "tipo": t, "altos": round(v["altos"]), "eventual": round(v["eventual"])}
                            for (n, t), v in unidades.items()], key=lambda x: -(x["altos"] + x["eventual"])),
        "escanos": escanos(),
        "fuentes": metadatos()["estado"],
        "base": metadatos()["estado_base"],
    }
    for t, p in salida["partes"].items():
        print(f"{t:12s} altos={p['altos'] / 1e6:6.2f} M€  eventual={p['eventual'] / 1e6:6.2f} M€")
    print("control PGE (miles):", dict(control))
    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    print("->", SALIDA)


if __name__ == "__main__":
    main()
