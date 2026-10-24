# Coste de los políticos

Web para entender cuánto cuestan los cargos políticos en España, pensada para cualquier lector y con una sección para periodistas (cifras para citar, descargas, método y fuentes).

Páginas (`docs/`), con barra de navegación inferior en el móvil:
- **Inicio** (`index.html`): la cifra por persona y el reparto entre comunidades, ayuntamientos y Gobierno central.
- **Comunidades** (`comunidades.html`): mapa por comunidad autónoma y por qué cada una cuesta más o menos.
- **Ayuntamientos** (`ayuntamientos.html`): buscador de municipios comparados con los de su tamaño.
- **Gobierno central** (`gobierno.html`), con pestañas: resumen, ministerios, evolución 2007-2025, sueldos fijados por ley desde 1986, y Congreso y Senado. `estado.html` y `sueldos.html` redirigen aquí.
- **¿Qué se podría pagar?** (`calculadora.html`) y **Periodistas y datos** (`periodistas.html`), en «Más».

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
