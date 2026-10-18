"""Utilidades comunes: año de trabajo, rutas y lectura de cifras.

El año se pasa como argumento (py scripts/autonomico.py 2025) o con la variable SUELDOS_ANYO.
Si no se indica, se usa el año que muestra ahora la web (docs/datos.json).
"""
import json
import os
import pathlib
import ssl
import sys
import urllib.request

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DATOS = RAIZ / "datos"


def _anyo():
    for a in sys.argv[1:]:
        if a.isdigit() and len(a) == 4:
            return int(a)
    if os.environ.get("SUELDOS_ANYO"):
        return int(os.environ["SUELDOS_ANYO"])
    web = RAIZ / "docs" / "datos.json"
    if web.exists():
        return json.loads(web.read_text(encoding="utf-8"))["anyo"]
    return max(int(p.name) for p in (DATOS / "fuentes").iterdir() if p.name.isdigit())


ANYO = _anyo()
FUENTES = DATOS / "fuentes" / str(ANYO)      # descargas de ese año
SALIDAS = DATOS / str(ANYO)                  # resultados intermedios de ese año
SALIDAS.mkdir(parents=True, exist_ok=True)


class FaltaFuente(Exception):
    """Falta un fichero de fuentes: hay que descargarlo (ver ACTUALIZAR.md)."""


def ruta(*partes):
    p = FUENTES.joinpath(*partes)
    if not p.exists():
        raise FaltaFuente(str(p.relative_to(RAIZ)))
    return p


def num(texto):
    """'1.234.567,89' -> 1234567.89"""
    return float(str(texto).strip().replace(".", "").replace(",", ".") or 0)


def metadatos():
    """Textos y enlaces de las fuentes del año (datos/fuentes/<año>/fuentes.json)."""
    return json.loads(ruta("fuentes.json").read_text(encoding="utf-8"))


_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE


def descargar(url, destino, timeout=600):
    """Descarga url en destino (ruta absoluta). Devuelve los bytes descargados."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    with urllib.request.urlopen(req, timeout=timeout, context=_ctx) as r:
        datos = r.read()
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(datos)
    return datos


def leer_json_url(url, cache):
    """JSON de una API, guardado una vez en fuentes/<año>/<cache> para que el cálculo sea reproducible."""
    destino = FUENTES / cache
    if not destino.exists():
        descargar(url, destino)
    return json.loads(destino.read_text(encoding="utf-8"))
