# Fuentes de datos — fase 1 (18/10/2026)

Criterio: solo puestos políticos (electos, gobierno, altos cargos y personal eventual). Nunca funcionarios ni laborales en puestos ordinarios.

## Nivel local: resuelto con dos fuentes únicas para toda España

**ISPA** (Ministerio para la Transformación Digital y de la Función Pública). Retribuciones de 2024, publicadas en 2025, en Excel con una fila por persona.
- Contenido: alcaldes (6.934), concejales (51.320), presidentes, diputados y consejeros de diputaciones, cabildos y consejos insulares. Incluye las asistencias a plenos.
- Faltan: los ayuntamientos que no remiten datos (lista en `ayuntamientos_sin_remitir.xlsx`) y las diputaciones o cabildos de Cuenca, Guadalajara, Formentera y Fuerteventura.
- No incluye personal eventual.
- https://digital.gob.es/funcion-publica/dgfp/espacio-ispa/estadisticas/informac_estad_2024
- Descargado en `datos/fuentes/2024/ispa/`.

**CONPREL** (Ministerio de Hacienda). Liquidación de 2024 en una base Access, con el máximo desglose por entidad.
- Conceptos útiles: 100 (órganos de gobierno), 101 (personal directivo), 110 (personal eventual), 230.00 y 231.00 (dietas y locomoción de los órganos de gobierno).
- Faltan: Navarra (solo 38 ayuntamientos), Álava (solo la Diputación Foral) y unos 1.270 ayuntamientos pequeños.
- https://serviciostelematicosext.hacienda.gob.es/SGFAL/CONPREL
- Descargado en `datos/fuentes/2024/conprel/`.

**Cruce entre fuentes:** los electos locales suman 544 M€ en ISPA y 556 M€ en CONPREL, así que las dos son coherentes.

**Totales de 2024 en CONPREL:** electos 556 M€, eventuales 238 M€, directivos 96 M€.

**Plan:** los electos salen de ISPA (cubre mejor Navarra y el País Vasco) y los eventuales y directivos, de CONPREL.

## Nivel autonómico: no hay fuente central

- **ISPA:** solo trae presidentes, vicepresidentes y consejeros de cada comunidad. Falta el País Vasco. No incluye viceconsejeros, directores generales ni eventuales.
- **Base de presupuestos de las CCAA de Hacienda:** no desglosa el capítulo 1, así que no sirve.
- **Método:** usar el presupuesto de cada comunidad, en concreto el artículo 10 (altos cargos) y el artículo 11 (personal eventual) de todas las secciones, incluida la del parlamento.

Estado por comunidad:
- **Aragón:** verificado. Publica CSV en datos abiertos, partida a partida (opendata.aragon.es). En 2024: altos cargos 10,5 M€ y eventuales 5,8 M€. La sección 01 incluye las Cortes, el Justicia y la Cámara de Cuentas.
- **Illes Balears:** IBESTAT publica la clasificación económica de 2025 en datos abiertos. Falta comprobar si llega a nivel de artículo.
- **País Vasco:** Open Data Euskadi tiene los presupuestos de 2025 y la plantilla presupuestaria. Por comprobar.
- **Castilla y León:** en 2025 sigue prorrogado el presupuesto de 2024.
- **Resto** (Andalucía, Asturias, Canarias, Cantabria, Castilla-La Mancha, Cataluña, Extremadura, Galicia, Madrid, Murcia, Navarra, La Rioja, C. Valenciana, Ceuta y Melilla): publican el presupuesto en su web. El formato y el desglose por artículo están por comprobar.
- **Parlamentos:** hay que comprobar en cada uno si los diputados van en el artículo 10 o en otras partidas (indemnizaciones, capítulos 2 o 4).

## Fase 2: nivel autonómico recogido (18/10/2026)

Script `scripts/autonomico.py` → `datos/2024/autonomico_unidades.csv`. Después, `scripts/generar_web.py` → `docs/datos.json`.

**Qué se cuenta:** los artículos 10 (altos cargos) y 11 (personal eventual) de 2024, más las retribuciones de los diputados. Cada unidad se clasifica como gobierno, parlamento, organismo u órgano estatutario. La web muestra por defecto gobierno + asesores + parlamento; los otros dos tipos se activan con un interruptor.

**Gasto ejecutado (obligaciones reconocidas):** Aragón, Castilla y León, Cataluña, Navarra, C. Valenciana, Baleares, Ceuta y Melilla (estas dos, vía CONPREL).

**Presupuesto inicial:** Andalucía, Canarias, Murcia, Madrid, País Vasco, Cantabria, Extremadura y Castilla-La Mancha.

**Proyecto de presupuesto** (la versión aprobada no está desglosada): Galicia, Asturias y La Rioja.

Particularidades:
- **Valencia:** el crédito inicial del artículo 10 no se corresponde con el gasto real (8,2 frente a 15,3 M€), así que se usa el ejecutado.
- **Navarra:** el artículo 11 del Servicio Navarro de Salud es personal sanitario temporal y se excluye. El Parlamento se toma de la auditoría de la Cámara de Comptos (informe 2025/13).
- **Madrid:** los diputados de la Asamblea van en el artículo 17 de la sección 01 (7,87 M€).
- **Castilla y León:** los procuradores cobran además 1,75 M€ en dietas, que no se cuentan.
- Las páginas de Galicia, Madrid y La Rioja bloquean las descargas automáticas. Sus datos se extrajeron desde el navegador y están guardados en `datos/fuentes/2024/<ccaa>/art10_11.json`.

Pendiente:
- **Parlamento Vasco:** no publica el desglose de las retribuciones de los parlamentarios.
- **Cortes de Castilla-La Mancha:** no tienen presupuesto propio desglosado en el de la Junta.

La web marca ambos casos con un asterisco.

## Fase 3: nivel local recogido (18/10/2026)

Script `scripts/local.py` → `datos/2024/local_ccaa.json`, que `scripts/generar_web.py` integra en la web.

**Fuentes:**
- **Alcaldes y concejales:** ISPA 2024 (lo percibido por persona, con asistencias). Los ayuntamientos que no enviaron datos a ISPA se completan con su concepto 100 de CONPREL (42 M€, municipios con 2,5 millones de habitantes).
- **Diputaciones, cabildos y consejos:** ISPA. Cuenca, Guadalajara y Fuerteventura salen de CONPREL; Formentera va dentro de su ayuntamiento.
- **Comarcas, mancomunidades, áreas metropolitanas y entidades menores:** CONPREL, concepto 100.
- **Asesores (concepto 110) y directivos (concepto 101):** CONPREL, todas las entidades locales.

**Totales 2024:** alcaldes y concejales 587 M€, diputaciones 62 M€, otras entidades 11 M€, asesores 236 M€, directivos 95 M€ (estos últimos van con «Organismos y directivos», que está desactivado por defecto).

**Huecos:**
- 0,9 millones de habitantes viven en municipios sin ningún dato de electos.
- Navarra: CONPREL solo tiene 38 ayuntamientos (Pamplona sí está).
- Álava: no hay asesores municipales (falta Vitoria-Gasteiz).
- No se cuentan las Juntas Generales vascas.
- Ceuta y Melilla no tienen nivel local aparte: su ayuntamiento es su gobierno autonómico.

## Fase 4: nivel estatal recogido (18/10/2026)

Script `scripts/estatal.py` → `datos/2024/estatal.json`, que `generar_web.py` integra en la web.

**Fuentes:**
- **Gobierno central:** artículos 10 y 11 de los PGE 2023, prorrogados en 2024 (resumen por artículos y secciones; suma comprobada contra la columna de total). Ministerios: 38,6 M€ en altos cargos y 46,8 M€ en asesores. La IGAE da para todo el Estado 85,4 M€ y 75,4 M€ de obligaciones en 2024, en línea con estos créditos.
- **Congreso:** informe de cumplimiento 2024 (créditos comprometidos): concepto 100 (diputados) 22,9 M€ y concepto 110 (eventuales) 13,3 M€. Las indemnizaciones del artículo 23 (10,7 M€) no se cuentan.
- **Senado:** ejecución 2024 (obligaciones reconocidas): senadores 17,8 M€ y eventuales 4,7 M€.
- **No se cuentan:** la Casa del Rey y la sección 02 de los PGE (Cortes), que se sustituye por las cifras de cada cámara.
- **Bajo «Organismos y otros órganos»:** el Tribunal de Cuentas, el Tribunal Constitucional, el Consejo de Estado y el CGPJ (14,8 M€), y los organismos y entes estatales (10,8 M€).

**Reparto opcional entre comunidades** (filtro «Estado»):
- **Congreso:** según los escaños de cada comunidad (anexo del Real Decreto 400/2023, 350 en total).
- **Senado:** 208 electos más 58 designados (1 por comunidad más 1 por millón de habitantes), 266 en total.
- **Gobierno central:** por habitante.

Por defecto el Estado se muestra aparte: 144,1 M€, es decir, 2,95 € por habitante.

## Población

INE, Estadística Continua de Población, tabla 56940, a 1 de enero de 2025, mediante su API JSON. Verificada.
https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/56940?nult=1

## Nivel estatal (fase 4)

- Presupuestos Generales del Estado (prorrogados): artículos 10 y 11 de cada ministerio.
- Congreso y Senado: sección 02.
- Portal de Transparencia.

## Criterios propuestos

- **Año de referencia:** 2024 en todos los niveles.
- **Directivos municipales (concepto 101) y órganos estatutarios autonómicos** (Justicia, Cámara de Cuentas, Consejo Consultivo): se cuentan aparte, con un interruptor en la web, porque muchos de esos puestos los ocupan funcionarios.

## Fase 5: actualización anual (18/10/2026)

Las fuentes de cada año van en `datos/fuentes/<año>/` y los resultados en `datos/<año>/`. Los textos y enlaces de las fuentes están en `datos/fuentes/<año>/fuentes.json`. El procedimiento está en [ACTUALIZAR.md](ACTUALIZAR.md).

No hay GitHub Action: CONPREL necesita el controlador de Access de Windows y cinco fuentes se sacan a mano.
