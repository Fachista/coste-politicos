// Fuentes de datos: cifras para citar, descargas, cita y tabla de fuentes
(async function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const [datos, hist] = await Promise.all([C.json("datos.json"), C.json("historico.json")]);
  let munis = null;
  try { munis = await C.json("municipios.json"); } catch (e) { munis = null; }
  const est = datos.estado, D = hist.sueldos.detalle;
  const url = location.href.replace(/(fuentes|periodistas)\.html.*$/, "").replace(/#.*$/, "");
  const hoy = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

  // ---- Cifras citables ----
  const total = datos.comunidades.reduce((s, c) => s + C.nucleoComunidad(c), 0) + C.nucleoEstado(est);
  const ranking = datos.comunidades.map((c) => ({ c, v: C.nucleoComunidad(c) / c.poblacion })).sort((a, b) => b.v - a.v);
  const ultimo = [...hist.estado].reverse().find((r) => !r.prorrogado);
  const nucleo = (r) => r.gobierno_altos + r.gobierno_asesores + r.congreso + r.senado;
  const a18 = hist.estado.find((r) => r.anyo === 2018);
  const ini = hist.estado[0];
  const presi = D.cargos.find((c) => c.cargo === "Presidente del Gobierno");
  const cifras = [
    { f: `Los sueldos de cargos políticos y asesores costaron ${C.millones(total)} en ${datos.anyo}, ${C.eur2(total / datos.poblacion.total)} por habitante.`,
      s: `Coste de los políticos, a partir de presupuestos y cuentas autonómicas, ISPA, CONPREL y PGE (${datos.anyo})` },
    { f: `${ranking[0].c.nombre} (${C.eur2(ranking[0].v)}), ${ranking[1].c.nombre} (${C.eur2(ranking[1].v)}) y ${ranking[2].c.nombre} (${C.eur2(ranking[2].v)}) son las comunidades donde los políticos cuestan más por habitante.`,
      s: `Coste de los políticos (${datos.anyo})` },
    { f: `El Gobierno central presupuestó ${C.millones(nucleo(ultimo))} para altos cargos, asesores y Cortes en ${ultimo.anyo}, frente a ${C.millones(nucleo(ini))} en ${ini.anyo} (${C.millones(nucleo(ini) * ini.factor_ipc)} en euros de ${hist.base_ipc}).`,
      s: "Presupuestos Generales del Estado (Fundación Civio, a partir de la SEPG) e IPC del INE" },
    { f: `Los ministerios pasaron de ${ini.ministerios} en el presupuesto de ${ini.anyo} a ${ultimo.ministerios} en el de ${ultimo.anyo}, y las secretarías de Estado, de ${ini.secretarias_estado} a ${ultimo.secretarias_estado}.`,
      s: `Presupuestos Generales del Estado ${ini.anyo} y ${ultimo.anyo}` },
    { f: `El presupuesto para asesores de los ministerios pasó de ${C.millones(a18.gobierno_asesores)} en 2018 a ${C.millones(ultimo.gobierno_asesores)} en ${ultimo.anyo} (+${C.pct(ultimo.gobierno_asesores / a18.gobierno_asesores - 1)}; +${C.pct((ultimo.gobierno_asesores * ultimo.factor_ipc) / (a18.gobierno_asesores * a18.factor_ipc) - 1)} descontada la inflación).`,
      s: `Presupuestos Generales del Estado 2018 y ${ultimo.anyo} (créditos iniciales) e IPC del INE` },
    { f: `El presidente del Gobierno tiene fijado un sueldo de ${C.eur(presi.anual)} brutos anuales (${D.anyo}), menos que un magistrado del Tribunal Constitucional (${C.eur(D.cargos.find((c) => c.cargo === "Magistrado del Tribunal Constitucional").anual)}).`,
      s: `${D.ley}, de Presupuestos Generales del Estado para ${D.anyo} (BOE)` },
  ];
  $("lista-cifras").innerHTML = cifras.map((k, i) => `<li><div class="frase">${k.f}</div><div class="fuente-frase">Fuente: ${k.s}
    <button class="boton" data-i="${i}">Copiar con fuente</button></div></li>`).join("");
  $("lista-cifras").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    const k = cifras[+b.dataset.i];
    C.copiar(b, `${k.f} (Fuente: ${k.s}. ${url})`);
  }));

  // ---- Descargas ----
  const COMP = (c) => {
    const p = c.partes, g = (t, k) => (p[t] ? p[t][k] : 0), l = p.local || {};
    return [g("gobierno", "altos"), g("gobierno", "eventual"), g("parlamento", "altos"), g("parlamento", "eventual"),
      l.electos || 0, l.diputaciones || 0, l.eventual || 0, l.directivos || 0,
      g("organismo", "altos") + g("organismo", "eventual"), g("estatutario", "altos") + g("estatutario", "eventual")];
  };
  const descargas = [
    ["Coste por comunidad autónoma", `comunidades_${datos.anyo}.csv`, () => [
      ["comunidad", "poblacion", "base", "gobierno_altos_cargos", "gobierno_asesores", "parlamento_cargos", "parlamento_asesores",
        "alcaldes_concejales", "diputaciones_cabildos_comarcas", "asesores_municipales", "directivos_municipales", "organismos", "otros_organos", "nucleo_total", "nucleo_por_habitante"],
      datos.comunidades.map((c) => [c.nombre, c.poblacion, c.base, ...COMP(c), C.nucleoComunidad(c), +(C.nucleoComunidad(c) / c.poblacion).toFixed(2)])]],
    ["Gobiernos y parlamentos autonómicos, por consejería u órgano", `unidades_autonomicas_${datos.anyo}.csv`, () => [
      ["comunidad", "unidad", "tipo", "altos_cargos", "asesores"],
      datos.comunidades.flatMap((c) => c.unidades.map((u) => [c.nombre, u.nombre, u.tipo, u.altos, u.eventual]))]],
    ["Gobierno central por ministerio, cada año", "gobierno_central_por_ministerio.csv", () => [
      ["anyo", "prorrogado_de", "ministerio", "altos_cargos", "asesores"],
      hist.estado.flatMap((r) => r.por_ministerio.map((m) => [r.anyo, r.prorrogado || "", m.nombre, m.altos, m.asesores]))]],
    ["Gobierno central: serie 2007-" + hist.estado[hist.estado.length - 1].anyo, "gobierno_central_serie.csv", () => [
      ["anyo", "prorrogado_de", "gobierna", "elaborado_por", ...hist.categorias.map((k) => k.id), "total", "poblacion", "factor_ipc_" + hist.base_ipc, "ministerios", "secretarias_estado"],
      hist.estado.map((r) => [r.anyo, r.prorrogado || "", r.gobierna, r.autor, ...hist.categorias.map((k) => r[k.id]), r.total, r.poblacion, r.factor_ipc ?? "", r.ministerios, r.secretarias_estado])]],
    ["Sueldos fijados por ley", "sueldos_altos_cargos.csv", () => [
      ["cargo", "grupo", "anyo", "sueldo_bruto_anual", "calculo", "ley"],
      [...D.cargos.map((c) => [c.cargo, c.grupo, D.anyo, c.anual, c.calculo, D.ley]),
       ...hist.sueldos.serie.flatMap((r) => ["presidente", "vicepresidente", "ministro"].filter((k) => r[k] != null).map((k) => [k, "Gobierno", r.anyo, r[k], "12 mensualidades, sin pagas extra", r.ley]))]]],
  ];
  if (munis) descargas.push(["Municipios: alcalde, concejales y asesores", `municipios_${munis.anyo}.csv`, () => [munis.campos, munis.filas]]);
  $("lista-descargas").innerHTML = descargas.map(([t, n], i) => `<tr><td>${t}</td><td class="num"><button class="boton" data-i="${i}">${n}</button></td></tr>`).join("");
  $("lista-descargas").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    const [, n, f] = descargas[+b.dataset.i];
    const [cab, filas] = f();
    C.descargarCSV(n, cab, filas);
  }));
  $("json").innerHTML = [["datos.json", `comunidades y Estado, ${datos.anyo}`], ["historico.json", "serie del Gobierno central y sueldos"],
    ...(munis ? [["municipios.json", `municipios, ${munis.anyo}`]] : [])]
    .map(([f, t]) => `<li><a href="${f}">${url}${f}</a> — ${t}</li>`).join("");

  // ---- Cita e inserción ----
  const cita = `Fuente: Coste de los políticos (${url}), con datos oficiales de presupuestos y cuentas públicas. Consultado el ${hoy}.`;
  const iframe = `<iframe src="${url}gobierno.html#este" width="100%" height="900" style="border:0" title="Gasto del Gobierno central en altos cargos y asesores" loading="lazy"></iframe>`;
  $("texto-cita").textContent = cita;
  $("iframe").textContent = iframe;
  $("copiar-cita").addEventListener("click", (e) => C.copiar(e.target, cita));
  $("copiar-iframe").addEventListener("click", (e) => C.copiar(e.target, iframe));

  // ---- Tabla de fuentes ----
  const fila = (dato, original, como) => `<tr><td>${dato}</td><td>${original}</td><td>${como}</td></tr>`;
  const a = (u, t) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
  const autonomicas = [...new Map(datos.comunidades.flatMap((c) => c.fuentes).map((f) => [f.url, f])).values()];
  $("tabla-fuentes").innerHTML = [
    fila("Gobiernos y parlamentos autonómicos", "Presupuestos, cuentas y portales de transparencia de cada comunidad y parlamento",
      `Descarga directa. <details><summary>${autonomicas.length} documentos</summary><ul>${autonomicas.map((f) => `<li>${a(f.url, C.esc(f.texto))}</li>`).join("")}</ul></details>`),
    fila("Alcaldes, concejales y diputados provinciales", a(datos.fuentes_local[0].url, "ISPA, Ministerio para la Transformación Digital y de la Función Pública"), "Descarga directa"),
    fila("Asesores y directivos municipales", a(datos.fuentes_local[1].url, "CONPREL, Ministerio de Hacienda (liquidaciones)"), "Descarga directa"),
    fila(`Gobierno central ${datos.anyo}`, est.fuentes.map((f) => a(f.url, C.esc(f.texto))).join("<br>"), "Descarga directa"),
    fila("Gobierno central 2007-2023", "Presupuestos Generales del Estado, Secretaría de Estado de Presupuestos y Gastos",
      `Copia partida a partida de la ${a("https://github.com/civio/presupuesto-pge", "Fundación Civio")} («¿Dónde van mis impuestos?»), que cuadra cada año con los totales oficiales`),
    fila("Sueldos de altos cargos", "Leyes de Presupuestos Generales del Estado, BOE",
      `Texto consolidado del BOE en la copia ${a("https://github.com/legalize-dev/legalize-es", "legalize-es")}; cada ley enlaza a su página del BOE`),
    fila("Salario mínimo", a("https://www.boe.es/buscar/doc.php?id=BOE-A-2023-3982", "Real Decreto 99/2023, BOE"), "Texto del BOE"),
    fila("Población", `${a(datos.poblacion.url, "INE, tabla 56940")} (comunidades); INE vía Banco Mundial (serie)`, "Descarga directa; copia de datahub.io del Banco Mundial"),
    fila("Inflación", "IPC, media anual (INE)", `Banco Mundial, indicador FP.CPI.TOTL.ZG, copia de ${a("https://github.com/datasets/cpi", "datahub.io")}`),
  ].join("");
  $("ref-sueldos").innerHTML = `Sueldos de referencia: <a href="${D.url}" target="_blank" rel="noopener">${D.ley}, de Presupuestos Generales del Estado para ${D.anyo}</a> (BOE). ${D.referencias.nota}`;
  $("pie").textContent = `Datos generados el ${datos.generado} (comunidades) y el ${hist.generado} (serie histórica).`;
})();
