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

## 5. Serie histórica del Gobierno central y sueldos

No dependen de Windows: funcionan en cualquier sistema con Python 3.

1. **Presupuestos 2007-2023 partida a partida.** Se leen de la copia de la Fundación Civio:
   ```bash
   git clone --depth 1 https://github.com/civio/presupuesto-pge ../presupuesto-pge
   py scripts/historico_estado.py ../presupuesto-pge
   ```
   Escribe `datos/historico/estado_pge.csv` (artículos 10 y 11 por centro gestor y programa). Cuando Civio publique un año nuevo, basta con repetirlo.
2. **Sueldos fijados por ley.** Se leen del texto consolidado del BOE que reproduce legalize-es. El repositorio es muy grande: conviene clonarlo sin contenido y bajar solo las leyes de presupuestos.
   ```bash
   git clone --depth 1 --filter=blob:none --no-checkout https://github.com/legalize-dev/legalize-es ../legalize-es
   # bajar los ficheros de las leyes de presupuestos, por ejemplo: git -C ../legalize-es checkout HEAD -- es/55/BOE-A-2022-22128.md
   py scripts/sueldos.py ../legalize-es
   ```
   Escribe `datos/historico/sueldos.json`. El script reconoce por su título cualquier ley de presupuestos que haya en la carpeta.
3. **Inflación y población.** Copias del Banco Mundial en datahub:
   ```bash
   git clone --depth 1 https://github.com/datasets/cpi ../cpi
   git clone --depth 1 https://github.com/datasets/population ../population
   py scripts/generar_historico.py --contexto ../cpi/data/cpi.csv ../population/data/population.csv
   ```
   Sin `--contexto` usa el `datos/historico/contexto.csv` ya guardado.
4. **Años prorrogados y presidentes.** Si se aprueba un presupuesto nuevo o cambia el Gobierno, hay que actualizar `PRORROGADOS`, `ULTIMO`, `AUTOR` y `GOBIERNOS` en `scripts/generar_historico.py`.

El resultado es `docs/historico.json`, que usan las páginas «Gobierno de España», «Cuánto cobran», «¿Qué se podría pagar?» y «Periodistas».

## 6. Buscador de municipios

`scripts/local.py` escribe también `datos/<año>/municipios.csv` (todos los municipios con su población del inventario de CONPREL), y `scripts/generar_web.py` lo convierte en `docs/municipios.json`. Si falta, la página «Tu ayuntamiento» muestra solo los municipios con más gasto de cada comunidad.

## 7. Comprobar y publicar

Ver la web en local:

```bash
py -m http.server 8765 --directory docs
```

Después, abrir <http://localhost:8765>.

Si todo está bien, se hace commit y push; GitHub Pages publica la carpeta `docs/`.
