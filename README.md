# Coste de los políticos

Web para entender de un vistazo cuánto cuestan los cargos políticos en España. Las páginas muestran cifras y gráficos; las explicaciones, el método y lo necesario para periodistas están en «Fuentes de datos».

Páginas (`docs/`), con barra de navegación inferior en el móvil:
- **Inicio** (`index.html`): la cifra por persona, el reparto entre comunidades, municipios y Gobierno central, y lo que ha cambiado con el Gobierno actual.
- **Comunidades** (`comunidades.html`): mapa por comunidad autónoma y por qué cada una cuesta más o menos.
- **Municipios** (`ayuntamientos.html`): buscador de municipios comparados con los de su tamaño.
- **Gobierno central** (`gobierno.html`), con pestañas: resumen, «Este Gobierno» (presupuestos del Gobierno actual frente al anterior, sin inflación), ministerios, sueldos fijados por ley y Congreso y Senado. La calculadora (`calculadora.html`) cuelga de aquí.
- **Fuentes de datos** (`fuentes.html`): cómo se calcula cada cifra, límites, cifras para citar, descargas CSV, cita y fuentes oficiales.

`estado.html`, `sueldos.html` y `periodistas.html` son redirecciones a las páginas nuevas.

Por comunidad autónoma se cuentan:
- altos cargos y asesores de los gobiernos autonómicos;
- parlamentarios autonómicos;
- alcaldes, concejales y diputados provinciales;
- asesores municipales;
- el bloque estatal (Gobierno central, Congreso y Senado).

Solo cuenta sueldos brutos de cargos políticos: no incluye funcionarios, dietas ni cotizaciones sociales.

- **Web:** carpeta `docs/` (GitHub Pages). Para verla en local:

  ```bash
  py -m http.server 8765 --directory docs
  ```

- **Fuentes y método:** [FUENTES.md](FUENTES.md)
- **Actualización anual:** [ACTUALIZAR.md](ACTUALIZAR.md) (`py scripts/actualizar.py <año>`; la serie histórica y los sueldos, en su apartado 5)

Requisitos: Python 3, `openpyxl`, `pdfplumber` y `pyodbc`. Para leer CONPREL hace falta además el controlador de Microsoft Access de 64 bits, así que el actualizador solo funciona en Windows. La serie histórica y los sueldos funcionan en cualquier sistema.
