"""Sueldos de los altos cargos del Estado fijados en cada Ley de Presupuestos Generales del Estado.

Fuente: el texto de cada ley en el BOE. Se lee de una copia local del repositorio legalize-es
(https://github.com/legalize-dev/legalize-es), que reproduce en Markdown la legislación consolidada
del BOE. Cada ley trae un artículo «Retribuciones de los altos cargos» con cuadros de cuantías.

- Serie: presidente, vicepresidente y ministro del Gobierno. La ley las da «referidas a doce
  mensualidades, sin derecho a pagas extraordinarias»: son el sueldo bruto anual, sin antigüedad.
  Hasta 2001 las leyes van en pesetas (1 € = 166,386 pta).
- Detalle de la última ley: también secretarios de Estado, subsecretarios, directores generales y los
  miembros del CGPJ, del Tribunal Constitucional y del Tribunal de Cuentas.
  Secretarios de Estado, subsecretarios y directores generales: sueldo + complemento de destino +
  complemento específico + dos pagas extra (complemento de destino mensual + la cuantía de sueldo que
  fija la ley). Sin productividad, que asigna cada ministerio y no se publica en la ley.
Ningún importe incluye dietas, indemnizaciones ni cotizaciones sociales.

Escribe datos/historico/sueldos.json.
Uso: py scripts/sueldos.py <ruta a legalize-es>
"""
import json
import pathlib
import re
import sys

from comun import RAIZ, num

SALIDA = RAIZ / "datos" / "historico" / "sueldos.json"
PESETAS = 166.386
TITULO = re.compile(r'^title: "(Ley \d+/\d{4}), de [^"]*?Presupuestos Generales del Estado para (?:el año )?(\d{4})"', re.M)
GOBIERNO = {"presidente": r"Presidente del Gobierno", "vicepresidente": r"Vicepresidente (?:primero |segundo )?del Gobierno",
            "ministro": r"Ministro del Gobierno"}


def celdas(linea):
    return [c.strip() for c in linea.strip().strip("|").split("|")]


def importes(linea):
    return [c for c in celdas(linea)[1:] if re.fullmatch(r"[\d.]+(,\d+)?", c)]


def a_euros(valor, texto_tabla, anyo):
    """Las leyes hasta 2001 dan pesetas (en 1999-2001, pesetas y euros: se toma la columna de euros)."""
    if anyo <= 2001 and "Euros" not in texto_tabla and "euros" not in texto_tabla:
        return round(num(valor) / PESETAS, 2)
    return num(valor)


def articulo_altos_cargos(texto):
    """Texto desde el artículo de retribuciones de los altos cargos hasta el de los funcionarios."""
    m = re.search(r"^#+ *Artículo [^.\n]+\.? *(?:Las )?[Rr]etribuciones de (?:los )?[Aa]ltos [Cc]argos.*$", texto, re.M)
    if not m:
        return None
    fin = re.search(r"^#+ *Artículo [^.\n]+\.? *Retribuciones de los funcionarios", texto[m.end():], re.M)
    return texto[m.start(): m.end() + (fin.start() if fin else 40000)]


def serie_gobierno(art, anyo):
    res = {}
    lineas = art.splitlines()
    for clave, patron in GOBIERNO.items():
        for i, l in enumerate(lineas):
            if l.startswith("|") and re.match(r"^\|\s*" + patron + r"\.?\s*\|", l):
                v = importes(l)
                if v:
                    cab = "\n".join(lineas[max(0, i - 8): i])
                    res[clave] = a_euros(v[-1], cab, anyo)
                    break
    return res


def tabla_tras(texto, rotulo):
    """Filas {etiqueta: [importes]} de la primera tabla que sigue a `rotulo`."""
    i = texto.find(rotulo)
    if i < 0:
        return None
    filas, dentro = {}, False
    for l in texto[i:].splitlines()[1:]:
        if l.startswith("|"):
            dentro = True
            c = celdas(l)
            if c and importes(l):
                filas[c[0].rstrip(".")] = [num(x) for x in importes(l)]
        elif dentro:
            break
    return filas


def detalle(art, texto, anyo):
    """Cuadro completo de la ley más reciente."""
    cargos = []
    for clave, nombre in (("presidente", "Presidente del Gobierno"), ("vicepresidente", "Vicepresidente del Gobierno"),
                          ("ministro", "Ministro del Gobierno")):
        v = serie_gobierno(art, anyo).get(clave)
        if v:
            cargos.append({"cargo": nombre, "grupo": "Gobierno", "anual": v, "calculo": "12 mensualidades, sin pagas extra"})
    for nombre in ("Presidente del Consejo de Estado", "Presidente del Consejo Económico y Social"):
        m = re.search(r"^\|\s*" + nombre + r"\.?\s*\|.*$", art, re.M)
        if m:
            cargos.append({"cargo": nombre, "grupo": "Órganos consultivos", "anual": num(importes(m.group(0))[-1]),
                           "calculo": "12 mensualidades, sin pagas extra"})
    # Secretarios de Estado, subsecretarios y directores generales
    base = tabla_tras(art, "Secretarios de Estado, Subsecretarios, Directores Generales")
    extra = tabla_tras(art, "pagas extraordinarias de los meses de junio y de diciembre")
    if base and extra and "Sueldo" in base and "Complemento de destino" in base:
        for k, nombre in enumerate(("Secretario de Estado", "Subsecretario", "Director general")):
            s, cd, ce = base["Sueldo"][k], base["Complemento de destino"][k], base["Complemento específico"][k]
            anual = s + cd + ce + 2 * (cd / 12 + extra["Sueldo"][k])
            cargos.append({"cargo": nombre, "grupo": "Administración General del Estado", "anual": round(anual, 2),
                           "calculo": "sueldo + complemento de destino + complemento específico + 2 pagas extra; sin productividad"})
    # CGPJ, Tribunal Constitucional, Tribunal de Cuentas
    m = re.search(r"^#+ *Artículo \d+\. Retribuciones de los miembros del Consejo General del Poder Judicial.*$", texto, re.M)
    if m:
        bloque = texto[m.end(): m.end() + 20000]
        bloque = bloque[: bloque.find("\n###### Artículo")]
        for cab, organo in ((r"\d\.\d ([^:\n]+):\n\n\|", None),):
            for mm in re.finditer(r"^(\d)\.(\d) ([^:\n]+):\s*$", bloque, re.M):
                tabla = tabla_tras(bloque[mm.start():], mm.group(0))
                if tabla and "Total" in tabla:
                    cargos.append({"cargo": mm.group(3).strip(), "grupo": "Órganos constitucionales",
                                   "anual": tabla["Total"][0], "calculo": "total anual fijado en la ley"})
        for mm in re.finditer(r"^\d\.\d ([^:\n]+): Remuneraciones anuales[^:]*: ([\d.]+,\d+) euros", bloque, re.M):
            cargos.append({"cargo": mm.group(1).strip(), "grupo": "Órganos constitucionales", "anual": num(mm.group(2)),
                           "calculo": "total anual fijado en la ley"})
    return sorted(cargos, key=lambda c: -c["anual"])


def referencias(texto):
    """Retribución básica estatal de un funcionario (sueldo, complemento de destino y pagas extra), sin
    trienios ni complemento específico: el suelo común a todas las administraciones, para comparar."""
    i = texto.find("| Grupo/Subgrupo EBEP | Sueldo")
    sueldo = tabla_tras(texto[i - 200:], "\n")
    extra = tabla_tras(texto[i + 10:], "| Grupo/Subgrupo EBEP | Sueldo")
    cd = tabla_tras(texto, "| Nivel | Importe")
    if not (sueldo and extra and cd):
        return None
    def basica(grupo, nivel):
        cdn = cd[str(nivel)][0]
        return round(sueldo[grupo][0] + cdn + 2 * (extra[grupo][0] + cdn / 12), 2)
    return {
        "funcionario_A1_24": {"texto": "Funcionario A1 con nivel 24 (p. ej., profesor de secundaria o médico)", "anual": basica("A1", 24)},
        "funcionario_A2_22": {"texto": "Funcionario A2 con nivel 22 (p. ej., maestro o enfermero)", "anual": basica("A2", 22)},
        "funcionario_C1_18": {"texto": "Funcionario C1 con nivel 18 (p. ej., administrativo o técnico)", "anual": basica("C1", 18)},
        "nota": "Retribución básica estatal: sueldo + complemento de destino + 2 pagas extra, sin trienios ni "
                "complemento específico (que fija cada administración). El sueldo real suele ser mayor.",
    }


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Uso: py scripts/sueldos.py <ruta a legalize-es>")
    base = pathlib.Path(sys.argv[1]) / "es"
    leyes = {}
    for f in base.glob("*/*.md"):
        cabecera = f.read_text(encoding="utf-8", errors="ignore")[:3000]
        m = TITULO.search(cabecera)
        if m:
            leyes[int(m.group(2))] = (m.group(1), f)
    serie, fuentes = [], {}
    ultimo = None
    for anyo in sorted(leyes):
        ley, f = leyes[anyo]
        texto = f.read_text(encoding="utf-8")
        art = articulo_altos_cargos(texto)
        if not art:
            print(f"{anyo}: {ley} sin artículo de altos cargos")
            continue
        g = serie_gobierno(art, anyo)
        if not g and serie and re.search(r"Continúan vigentes|mismos términos y cuantías", art[:1500]):
            # La ley mantiene las cuantías del año anterior
            g = {k: serie[-1][k] for k in GOBIERNO if k in serie[-1]}
        if not g:
            print(f"{anyo}: {ley} sin cuadro reconocible")
            continue
        url = re.search(r'^url_html: "([^"]+)"', texto, re.M).group(1)
        serie.append({"anyo": anyo, **g, "ley": ley, "url": url})
        print(anyo, ley, g)
        ultimo = (anyo, ley, url, art, texto)
    anyo, ley, url, art, texto = ultimo
    salida = {
        "serie": serie,
        "detalle": {"anyo": anyo, "ley": ley, "url": url, "cargos": detalle(art, texto, anyo),
                    "referencias": referencias(texto)},
        "fuente": "Leyes de Presupuestos Generales del Estado (BOE), texto consolidado vía legalize-es",
    }
    for c in salida["detalle"]["cargos"]:
        print(f"  {c['cargo']:60s} {c['anual']:>12,.2f}")
    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
    print("->", SALIDA)


if __name__ == "__main__":
    main()
