"""Serie histórica del Gobierno central: artículos 10 (altos cargos) y 11 (personal eventual) de los PGE.

Fuente: los Presupuestos Generales del Estado partida a partida que publica la Fundación Civio
(https://github.com/civio/presupuesto-pge, carpeta data/es/pais/<año>/), tomados a su vez de la web de
la Secretaría de Estado de Presupuestos y Gastos. Son créditos iniciales (lo presupuestado), no gasto real.
En los años de presupuesto prorrogado Civio repite el del año anterior (2019 y 2020 = 2018).

Para cada año se guardan las partidas de los artículos 10 y 11 por centro gestor y programa.

Lee una copia local del repositorio de Civio; escribe datos/historico/estado_pge.csv.
Uso: py scripts/historico_estado.py <ruta a presupuesto-pge>
"""
import collections
import csv
import pathlib
import sys

from comun import RAIZ

SALIDA = RAIZ / "datos" / "historico"


def leer(ruta):
    with open(ruta, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter=";"))


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Uso: py scripts/historico_estado.py <ruta a presupuesto-pge>")
    base = pathlib.Path(sys.argv[1]) / "data" / "es" / "pais"
    SALIDA.mkdir(parents=True, exist_ok=True)
    filas = []
    for carpeta in sorted(p for p in base.iterdir() if p.name.isdigit()):
        anyo = int(carpeta.name)
        nombres = {r["CENTRO GESTOR"]: r["DESCRIPCION LARGA"].strip() for r in leer(carpeta / "estructura_organica.csv")}
        suma = collections.Counter()
        for r in leer(carpeta / "gastos.csv"):
            eco, imp = r["ECONOMICA"], float(r["IMPORTE"] or 0)
            if eco in ("10", "11"):
                suma[(r["CENTRO GESTOR"], r["FUNCIONAL"], eco)] += imp
        for (cg, prog, eco), imp in sorted(suma.items()):
            filas.append({"anyo": anyo, "seccion": cg[:2], "seccion_nombre": nombres.get(cg[:2], ""),
                          "centro": cg, "centro_nombre": nombres.get(cg, ""), "programa": prog,
                          "articulo": eco, "importe": round(imp)})
        print(anyo, f"art10={sum(v for k, v in suma.items() if k[2] == '10') / 1e6:6.2f} M€",
              f"art11={sum(v for k, v in suma.items() if k[2] == '11') / 1e6:6.2f} M€")
    with open(SALIDA / "estado_pge.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(filas[0]))
        w.writeheader()
        w.writerows(filas)
    print("->", SALIDA / "estado_pge.csv")


if __name__ == "__main__":
    main()
