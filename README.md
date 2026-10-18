# Coste de los políticos

Web que muestra cuánto cuestan los cargos políticos por habitante en cada comunidad autónoma de España:
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
- **Actualización anual:** [ACTUALIZAR.md](ACTUALIZAR.md) (`py scripts/actualizar.py <año>`)

Requisitos: Python 3, `openpyxl`, `pdfplumber` y `pyodbc`. Para leer CONPREL hace falta además el controlador de Microsoft Access de 64 bits, así que el actualizador solo funciona en Windows.
