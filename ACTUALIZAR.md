# Actualización anual

Los datos de un año (por ejemplo, 2025) van saliendo a lo largo del año siguiente. Lo último suele ser:
- la liquidación de las entidades locales en CONPREL, hacia diciembre;
- ISPA, en octubre.

Lo práctico es actualizar a finales de año.

## 1. Ejecutar el actualizador

```bash
py scripts/actualizar.py 2025
```

El script:
- Descarga en `datos/fuentes/2025/` todo lo que tiene dirección predecible.
- Crea `fuentes.json` a partir del del año anterior.
- Dice qué falta. Es normal que la primera vez falten varias fuentes. Se puede repetir las veces que haga falta: lo ya descargado no se vuelve a bajar (salvo con `--forzar`).

Cuando esté todo, recalcula y regenera `docs/datos.json`. Con `--parcial` regenera aunque falten comunidades, que quedan fuera de la web.

## 2. Pasos manuales

Algunas webs bloquean las descargas automáticas o publican sus cifras solo en PDF. En esos casos hay que crear el fichero a mano. Los JSON siguen siempre el mismo formato que los de `datos/fuentes/2024/` (`filas` con `seccion`, `articulo` y `importe`, y opcionalmente `tipo`).

| Fichero | Cómo conseguirlo |
|---|---|
| `galicia/art10_11.json` | En el navegador, abrir `parlamentodegalicia.gal` y, desde esa página, leer `PROGR_I_<año>.PDF` y `PROGR_II_<año>.PDF` (carpeta `/sitios/web/DocsOrzamentos/`). Por cada sección, sumar los subconceptos del artículo «Altos cargos e delegados» (10) y «Persoal eventual de gabinete» (11). Si la web los descarga, también vale pasar los PDF por `pdfplumber`. |
| `larioja/art10_11.json` | larioja.org → Hacienda → Presupuestos → tomo 19 «Detalle de partidas» → CSV de gastos (Cloudflare bloquea la descarga directa: abrirlo desde el navegador). Sumar por `Org_1_Denominación` las partidas con `Ec_2` 10 y 11. |
| `extremadura/art10_11.json` | juntaex.es → «Ley X/<año> de Presupuestos» → `estado_ing_gasto.pdf`. Tablas «Resumen general por capítulos, artículos y secciones», columna TOTAL: instituciones estatutarias (Asamblea), Administración General, organismos autónomos y consorcios. Artículo 10 = «Cargos públicos y asimilados»; artículo 11 = «Personal eventual». |
| `cantabria/estado_ingresos_gastos.pdf` | cantabria.es → Dirección General de Tesorería, Presupuestos → «Presupuestos Generales de Cantabria <año>» → «Estado de Ingresos y Gastos». |
| `navarra/parlamento.json` | camaradecomptos.navarra.es → «Cuentas anuales del Parlamento de Navarra, <año>» (sale a mitad del año siguiente). Artículo 10 = Presidencia + parlamentarios. Artículo 11 = personal eventual (gabinete y otros cargos). Sin dietas ni retribuciones a exparlamentarios. |

## 3. Revisar `fuentes.json`

Se crea copiando el del año anterior y cambiando el año, así que hay que repasarlo:
- **`base` de cada comunidad:** si ese año publica la ejecución, «ejecutado»; si no, «presupuestado».
- **Enlaces que no siguen un patrón:** Madrid, Cantabria, Extremadura y los proyectos de Galicia, Asturias y La Rioja.
- **`faltan` y `notas`:** por ejemplo, si el Parlamento Vasco o las Cortes de Castilla-La Mancha empiezan a publicar sus retribuciones.
- **`estado` y `estado_base`:** si hay Presupuestos Generales del Estado nuevos o siguen prorrogados.

## 4. Lo que puede cambiar de un año a otro

- **Estructura de los PDF.** Si cambia, el script de la comunidad falla y lo dice; hay que ajustar su extractor en `scripts/autonomico.py`. Afecta a Murcia, Asturias, Cantabria, Castilla-La Mancha y Madrid. Madrid comprueba además que su suma cuadre con el total.
- **Nombres de consejerías y ministerios.** La clasificación en gobierno, organismo u órgano estatutario se hace por el nombre (`clasificar` en `autonomico.py`). Conviene revisar `datos/<año>/autonomico_unidades.csv`.
- **PGE nuevos.** Si se aprueban, los nombres de las secciones (`SECCIONES` en `scripts/estatal.py`) pueden cambiar con la estructura de ministerios.
- **Escaños.** Tras unas elecciones generales hay que actualizar los diputados por provincia (anexo del real decreto de convocatoria) y los senadores designados en `scripts/estatal.py`.

## 5. Comprobar y publicar

Ver la web en local:

```bash
py -m http.server 8765 --directory docs
```

Después, abrir <http://localhost:8765>.

Si todo está bien, se hace commit y push; GitHub Pages publica la carpeta `docs/`.
