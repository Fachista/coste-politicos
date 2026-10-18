"""Actualización anual de los datos.

    py scripts/actualizar.py 2025              descarga lo automatizable, informa de lo que falta
                                               y, si está todo, recalcula y regenera la web
    py scripts/actualizar.py 2025 --parcial    regenera aunque falten comunidades (se quedan fuera)
    py scripts/actualizar.py 2025 --forzar     vuelve a descargar aunque el fichero ya exista

Los pasos manuales de cada fuente están en ACTUALIZAR.md. Nada se publica: la web solo cambia en docs/.
"""
import html
import io
import json
import pathlib
import re
import shutil
import subprocess
import sys
import urllib.parse
import zipfile

RAIZ = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "scripts"))

args = [a for a in sys.argv[1:] if not a.startswith("--")]
if not args or not args[0].isdigit():
    sys.exit(__doc__)
ANYO = int(args[0])
FORZAR = "--forzar" in sys.argv
PARCIAL = "--parcial" in sys.argv
F = RAIZ / "datos" / "fuentes" / str(ANYO)
PREVIO = RAIZ / "datos" / "fuentes" / str(ANYO - 1)

from comun import descargar  # noqa: E402  (después de fijar sys.path)


def texto(url):
    from comun import _ctx
    import urllib.request
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=120, context=_ctx) as r:
        return r.read().decode("utf-8", errors="replace")


def enlaces(url, patron):
    """Enlaces de una página que cumplen un patrón (absolutos)."""
    pagina = texto(url)
    hrefs = [html.unescape(h) for h in re.findall(r'href="([^"]+)"', pagina)]
    return [urllib.parse.urljoin(url, h) for h in hrefs if re.search(patron, h, re.I)]


def primero(urls, que):
    if not urls:
        raise LookupError(f"no se encuentra el enlace de {que} (puede que aún no esté publicado)")
    return urls[0]


def ckan(base, paquete, recurso, destino, formato=None):
    """Descarga el recurso de un conjunto CKAN cuyo nombre contiene `recurso`."""
    d = json.loads(texto(base + "package_show?" + urllib.parse.urlencode({"id": paquete})))["result"]
    for r in d["resources"]:
        if re.search(recurso, r.get("name") or "", re.I) and (not formato or (r.get("format") or "").upper() == formato):
            return descargar(r["url"], destino)
    raise LookupError(f"el conjunto {paquete} no tiene el recurso «{recurso}»")


def es_pdf(datos):
    if not datos.startswith(b"%PDF"):
        raise LookupError("la dirección no devuelve un PDF (probablemente aún no está publicado)")


# --- Descargas automáticas: (fichero, función) ---

def ine(dest):
    descargar("https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/56940?nult=12&tip=A", dest)
    t = dest.read_text(encoding="utf-8")
    if not any(f in t for f in (f"{ANYO}-07-01", f"{ANYO + 1}-01-01", f"{ANYO}-01-01")):
        dest.unlink()
        raise LookupError(f"el INE aún no publica población de {ANYO}")


ISPA_FICHEROS = ["retribuciones_alcaldes.xlsx", "retribuciones_concejales.xlsx", "presidentes_diputaciones.xlsx",
                 "consejeros_diputaciones.xlsx", "ayuntamientos_sin_remitir.xlsx", "presidentes_consejeros_ccaa.xlsx"]


def ispa(nombre):
    def f(dest):
        urls = enlaces(f"https://digital.gob.es/funcion-publica/dgfp/espacio-ispa/estadisticas/informac_estad_{ANYO}",
                       rf"retrib_{ANYO}/{nombre}$")
        if not urls:
            raise LookupError(f"ISPA aún no publica las retribuciones de {ANYO}")
        descargar(urls[0], dest)
    return f


def conprel(dest):
    url = ("https://serviciostelematicosext.hacienda.gob.es/SGFAL/CONPREL/Consulta/DescargaFichero?"
           f"CCAA=&TipoDato=Liquidaciones&Ejercicio={ANYO}&TipoPublicacion=Access")
    tmp = dest.with_suffix(".zip")
    datos = descargar(url, tmp)
    if not datos.startswith(b"PK"):
        tmp.unlink()
        raise LookupError(f"Hacienda aún no publica la liquidación definitiva de {ANYO} de las entidades locales")
    with zipfile.ZipFile(io.BytesIO(datos)) as z:
        nombre = next(n for n in z.namelist() if n.lower().endswith((".accdb", ".mdb")))
        with z.open(nombre) as o, open(dest, "wb") as d:
            shutil.copyfileobj(o, d)
    tmp.unlink()


def andalucia(dest):
    base = "https://www.juntadeandalucia.es/datosabiertos/portal/api/3/action/"
    res = json.loads(texto(base + "package_search?" + urllib.parse.urlencode({"q": f"presupuesto {ANYO}", "rows": 50})))["result"]
    paq = next((p for p in res["results"]
                if re.fullmatch(rf"Presupuesto de la Comunidad Autónoma de Andalucía (año )?{ANYO}", p["title"].strip())), None)
    if not paq:
        raise LookupError(f"la Junta aún no publica el presupuesto de {ANYO} en datos abiertos")
    r = next(r for r in paq["resources"] if re.search("partidas de gastos", r.get("name") or "", re.I))
    url = re.sub(r"^https://[^/]*paas\.junta-andalucia\.es", "https://www.juntadeandalucia.es", r["url"])
    descargar(url, dest)


ARAGON = "https://opendata.aragon.es/ckan/api/3/action/"
NAVARRA = "https://datosabiertos.navarra.es/api/3/action/"

AUTOMATICAS = {
    "ine/poblacion.json": ine,
    **{f"ispa/{n}": ispa(n) for n in ISPA_FICHEROS},
    "conprel/Liquidaciones.accdb": conprel,
    "andalucia/gastos.xlsx": andalucia,
    "aragon/ejecucion_gastos.csv": lambda d: ckan(ARAGON, f"ejecucion-presupuestaria-{ANYO}", "ejecución gastos", d),
    "aragon/estructura_organica.csv": lambda d: ckan(ARAGON, f"presupuesto-del-gobierno-de-aragon-{ANYO}", "orgánica", d),
    "canarias/presupuesto_consolidado.csv": lambda d: ckan(
        "https://datos.canarias.es/catalogos/general/api/3/action/",
        f"presupuestos-de-la-comunidad-autonoma-de-canarias-{ANYO}", "consolidado de gastos", d, "CSV"),
    "navarra/ejecucion_gastos.csv": lambda d: ckan(NAVARRA, f"ejecucion-anual-del-presupuesto-de-gastos-para-{ANYO}", "definitivo", d),
    "navarra/presupuesto_gastos.csv": lambda d: ckan(NAVARRA, f"presupuestos-generales-{ANYO}", "Gastos: Partidas", d),
    "valencia/ejecucion_gastos.csv": lambda d: ckan("https://dadesobertes.gva.es/api/3/action/", f"sec-nefis-visor-{ANYO}",
                                                     "GASTOS", d, "CSV"),
    "baleares/ppp_dsp_liq.xlsx": lambda d: ckan(
        "https://intranet.caib.es/opendatacataleg/api/3/action/",
        "partides-pressuposts-liquidats-despeses-comunitat-autonoma-de-les-illes-balears", "Liquidats", d),
    "paisvasco/Datuak_datos.csv": lambda d: descargar(
        f"https://www.euskadi.eus/contenidos/informacion/presupuestos_cae_fich/es_def/adjuntos/{ANYO}P/Datuak_datos.csv", d),
    "paisvasco/Organikoa_Organica.csv": lambda d: descargar(
        f"https://www.euskadi.eus/contenidos/informacion/presupuestos_cae_fich/es_def/adjuntos/{ANYO}P/Organikoa_Organica.csv", d),
    "murcia/presupuestos_I.pdf": lambda d: es_pdf(descargar(f"https://www.carm.es/chac/leypresup{ANYO}/web/pdfs/presupuestos_I.pdf", d)),
    "madrid/libro03.pdf": lambda d: es_pdf(descargar(primero(
        enlaces("https://www.comunidad.madrid/presupuestos/presupuestos-anteriores", rf"/{ANYO}-presupuesto-libro-03-")
        + enlaces("https://www.comunidad.madrid/presupuestos", rf"/{ANYO}-presupuesto-libro-03-"), "Madrid, libro 03"), d)),
    "madrid/libro02.pdf": lambda d: es_pdf(descargar(primero(
        enlaces("https://www.comunidad.madrid/presupuestos/presupuestos-anteriores", rf"/{ANYO}-presupuesto-libro-02-")
        + enlaces("https://www.comunidad.madrid/presupuestos", rf"/{ANYO}-presupuesto-libro-02-"), "Madrid, libro 02"), d)),
    "asturias/tomo2_estado_gastos.pdf": lambda d: es_pdf(descargar(primero(enlaces(
        f"https://transparencia.asturias.es/economica/presupuestos-cuentas/leyes-presupuestos/proyecto-{ANYO}",
        r"T2_estado_numerico_admon"), "Asturias, tomo 2"), d)),
    "castillalamancha/tomo1.pdf": lambda d: es_pdf(descargar(primero(enlaces(
        f"https://transparencia.castillalamancha.es/actuacion/ley-de-presupuestos-generales-de-castilla-la-mancha-{ANYO}",
        r"tomo_1.*estado.*gastos.*\.pdf"), "Castilla-La Mancha, tomo 1"), d)),
    "estado/congreso_cumplimiento.pdf": lambda d: es_pdf(descargar(
        f"https://www.congreso.es/docu/transp/ejecucion_presupuesto/Informe_cumplimiento_CD_{ANYO}.pdf", d)),
    "estado/senado_ejecucion.csv": lambda d: descargar(primero(enlaces(
        "https://www.senado.es/web/relacionesciudadanos/transparencia/informacioneconomicacontractual/presupuestosenado/"
        f"detalle/index.html?id=EJECUCION_ESTADO_{ANYO}", rf"ejecucion_csv_{ANYO}\.csv"), "Senado, ejecución"), d),
}


def pge(dest):
    """Si los PGE del año están aprobados, su tomo de resúmenes; si no, siguen prorrogados los anteriores."""
    url = f"https://www.sepg.pap.hacienda.gob.es/Presup/PGE{ANYO}Ley/MaestroTomos/PGE-ROM/doc/L_{ANYO % 100:02d}_E_R1.PDF"
    try:
        es_pdf(descargar(url, dest))
        return "PGE aprobados"
    except Exception:
        anterior = PREVIO / "estado" / "pge_resumenes.pdf"
        if not anterior.exists():
            raise LookupError("no hay PGE del año ni del anterior")
        shutil.copy(anterior, dest)
        return f"PGE {ANYO} no aprobados: se copia el de {ANYO - 1} (prorrogado). Compruébalo"


AUTOMATICAS["estado/pge_resumenes.pdf"] = pge

# --- Pasos manuales (instrucciones en ACTUALIZAR.md) ---
MANUALES = {
    "galicia/art10_11.json": "Galicia: PROGR_I y PROGR_II del Parlamento de Galicia, leídos desde el navegador",
    "larioja/art10_11.json": "La Rioja: CSV de partidas del tomo 19, leído desde el navegador",
    "extremadura/art10_11.json": "Extremadura: totales de los resúmenes por artículos y secciones del estado de gastos",
    "cantabria/estado_ingresos_gastos.pdf": "Cantabria: PDF «Estado de Ingresos y Gastos» de la web de Presupuestos",
    "navarra/parlamento.json": "Navarra: informe de la Cámara de Comptos sobre las cuentas del Parlamento",
}


def preparar_metadatos():
    """fuentes.json del año: se parte del del año anterior cambiando el año en textos y enlaces."""
    dest = F / "fuentes.json"
    if dest.exists():
        return "presente"
    previo = PREVIO / "fuentes.json"
    if not previo.exists():
        return "FALTA (no hay fuentes.json del año anterior)"
    dest.write_text(previo.read_text(encoding="utf-8").replace(str(ANYO - 1), str(ANYO)), encoding="utf-8")
    return "creado desde el del año anterior: REVÍSALO (bases, enlaces, huecos)"


def main():
    F.mkdir(parents=True, exist_ok=True)
    print(f"Actualización {ANYO} -> {F.relative_to(RAIZ)}\n")
    faltan = []
    for rel, fn in AUTOMATICAS.items():
        dest = F / rel
        if dest.exists() and not FORZAR:
            print(f"  ok        {rel}")
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            nota = fn(dest)
            print(f"  descarga  {rel}" + (f"  ({nota})" if isinstance(nota, str) else ""))
        except Exception as e:
            if dest.exists():
                dest.unlink()
            faltan.append(rel)
            print(f"  FALTA     {rel}  ({type(e).__name__}: {str(e)[:110]})")
    for rel, ayuda in MANUALES.items():
        if (F / rel).exists():
            print(f"  ok        {rel}")
        else:
            faltan.append(rel)
            print(f"  MANUAL    {rel}  ({ayuda})")
    print(f"\n  fuentes.json: {preparar_metadatos()}")

    if faltan and not PARCIAL:
        print(f"\nFaltan {len(faltan)} fuentes. Cuando estén (ver ACTUALIZAR.md), vuelve a ejecutar."
              "\nCon --parcial se regenera igualmente y las comunidades sin datos quedan fuera.")
        sys.exit(1)

    print("\nRecalculando...")
    for script in ("autonomico.py", "local.py", "estatal.py", "generar_web.py"):
        r = subprocess.run([sys.executable, "-X", "utf8", str(RAIZ / "scripts" / script), str(ANYO)])
        if r.returncode != 0 and not (PARCIAL and script == "autonomico.py"):
            sys.exit(f"Error en {script}: revisa el mensaje anterior.")
    print(f"\nListo: docs/datos.json contiene {ANYO}. Revisa la web en local antes de publicar.")


if __name__ == "__main__":
    main()
