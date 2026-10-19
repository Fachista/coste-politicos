# Coste de los políticos

Web para entender cuánto cuestan los cargos políticos en España, pensada para cualquier lector y con una sección para periodistas (cifras para citar, descargas, método y fuentes).

Páginas (`docs/`):
- **Inicio** (`index.html`): la cifra por persona y lo más importante.
- **Tu comunidad** (`comunidades.html`): mapa por comunidad autónoma y por qué cada una cuesta más o menos.
- **Tu ayuntamiento** (`ayuntamientos.html`): buscador de municipios comparados con los de su tamaño.
- **Gobierno de España** (`estado.html`): serie 2007-2025 de altos cargos y asesores, con y sin inflación, por presidente y por ministerio.
- **Cuánto cobran** (`sueldos.html`): sueldos fijados por ley y su evolución desde 1986.
- **¿Qué se podría pagar?** (`calculadora.html`): equivalencia en maestros, enfermeros o médicos.
- **Periodistas y datos** (`periodistas.html`).

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
