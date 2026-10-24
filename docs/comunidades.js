(async function () {
  "use strict";

  // Orden fijo de la paleta categórica: el color sigue al componente, nunca a su posición
  const COMPONENTES = [
    { id: "gob_altos", nombre: "Altos cargos del gobierno", color: "--c-1" },
    { id: "gob_eventual", nombre: "Asesores del gobierno", color: "--c-2" },
    { id: "parlamento", nombre: "Parlamento", color: "--c-3", filtro: "parlamento" },
    { id: "local_electos", nombre: "Alcaldes y concejales", color: "--c-4", filtro: "local" },
    { id: "local_diput", nombre: "Diputaciones, cabildos y comarcas", color: "--c-5", filtro: "local" },
    { id: "local_eventual", nombre: "Asesores municipales", color: "--c-6", filtro: "local" },
    { id: "estado", nombre: "Gobierno central, Congreso y Senado", color: "--c-7", filtro: "estado" },
    { id: "otros", nombre: "Organismos, directivos y otros órganos", color: "--c-8", filtro: "otros" },
  ];
  // Ficha del Estado: mismos colores para el mismo papel (gobierno, asesores, cámaras, otros)
  const COMPONENTES_ESTADO = [
    { id: "gob_altos", nombre: "Altos cargos del Gobierno central", color: "--c-1" },
    { id: "gob_eventual", nombre: "Asesores del Gobierno central", color: "--c-2" },
    { id: "cortes", nombre: "Congreso y Senado", color: "--c-3" },
    { id: "otros", nombre: "Organismos y órganos constitucionales", color: "--c-8", filtro: "otros" },
  ];
  const BASE = { ejecutado: "Autonómico: gasto real", presupuestado: "Autonómico: presupuesto" };

  const fmtEur = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtEnt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" });
  const fmtM = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: "always" });
  const fmtPct = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
  const millones = (v) => (v >= 1e6 ? fmtM.format(v / 1e6) + " M€" : fmtEnt.format(Math.round(v / 1000)) + " mil €");
  const porHab = (v) => fmtEur.format(v) + " €";
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  const [datos, topo] = await Promise.all([
    fetch("datos.json").then((r) => r.json()),
    fetch("vendor/autonomous_regions.json").then((r) => r.json()),
  ]);
  document.querySelectorAll(".anyo").forEach((e) => (e.textContent = datos.anyo));
  document.getElementById("pie-fuentes").innerHTML = C.masInfo("comunidades");

  const filtros = { parlamento: true, local: true, estado: false, otros: false };
  const est = datos.estado;
  const pobTotal = datos.poblacion.total;
  const sumaE = (t) => (est.partes[t] ? est.partes[t].altos + est.partes[t].eventual : 0);
  const ESC = { congreso: 350, senado: 266 };
  let seleccion = null;
  // En el móvil la ficha queda debajo: al elegir, se baja hasta ella
  function elegir(id) {
    seleccion = id;
    render();
    if (window.matchMedia("(max-width: 760px)").matches) document.getElementById("ficha").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function componentes(c) {
    const p = c.partes;
    const suma = (t) => (p[t] ? p[t].altos + p[t].eventual : 0);
    const l = p.local || { electos: 0, diputaciones: 0, eventual: 0, directivos: 0 };
    return {
      gob_altos: p.gobierno ? p.gobierno.altos : 0,
      gob_eventual: p.gobierno ? p.gobierno.eventual : 0,
      parlamento: suma("parlamento"),
      local_electos: l.electos,
      local_diput: l.diputaciones,
      local_eventual: l.eventual,
      otros: suma("organismo") + suma("estatutario") + l.directivos
        // Organismos y órganos constitucionales del Estado, por habitante (solo si se suma el Estado)
        + (filtros.estado ? (sumaE("organismo") + sumaE("estatutario")) * c.poblacion / pobTotal : 0),
      // Estado: Congreso y Senado según los escaños de la comunidad; Gobierno central, por habitante
      estado: sumaE("gobierno") * c.poblacion / pobTotal
        + (est.escanos[c.nombre] ? sumaE("congreso") * est.escanos[c.nombre].congreso / ESC.congreso
          + sumaE("senado") * est.escanos[c.nombre].senado / ESC.senado : 0),
    };
  }

  function calcularEstado() {
    const comp = {
      gob_altos: est.partes.gobierno.altos,
      gob_eventual: est.partes.gobierno.eventual,
      cortes: sumaE("congreso") + sumaE("senado"),
      otros: sumaE("organismo") + sumaE("estatutario"),
    };
    const activos = COMPONENTES_ESTADO.filter((k) => !k.filtro || filtros[k.filtro]);
    const total = activos.reduce((s, k) => s + comp[k.id], 0);
    return { comp, activos, total, porHab: total / pobTotal };
  }

  function calcular() {
    const filas = datos.comunidades.map((c) => {
      const comp = componentes(c);
      const activos = COMPONENTES.filter((k) => !k.filtro || filtros[k.filtro]);
      const total = activos.reduce((s, k) => s + comp[k.id], 0);
      return { c, comp, activos, total, porHab: total / c.poblacion };
    });
    const totalEsp = filas.reduce((s, f) => s + f.total, 0);
    const pobEsp = filas.reduce((s, f) => s + f.c.poblacion, 0);
    const media = totalEsp / pobEsp;
    filas.forEach((f) => (f.dif = f.porHab / media - 1));
    filas.sort((a, b) => b.porHab - a.porHab);
    return { filas, media, totalEsp };
  }

  function difTexto(d) {
    if (Math.abs(d) < 0.005) return "en la media";
    return (d > 0 ? "▲ " : "▼ ") + fmtPct.format(Math.abs(d) * 100) + " % " + (d > 0 ? "por encima" : "por debajo") + " de la media";
  }

  // ---- Tooltip ----
  const tip = document.getElementById("tip");
  function mostrarTip(ev, f) {
    tip.innerHTML = `<b>${f.c.nombre}${f.c.faltan.length ? " *" : ""}</b>${porHab(f.porHab)} por habitante<br>
      <span class="t2">${millones(f.total)} · ${difTexto(f.dif)}</span>`;
    tip.hidden = false;
    const x = Math.min(ev.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    const y = Math.min(ev.clientY + 14, window.innerHeight - tip.offsetHeight - 8);
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }
  const ocultarTip = () => (tip.hidden = true);

  // ---- Mapa ----
  const svg = d3.select("#mapa");
  const ancho = 640, alto = 500;
  svg.attr("viewBox", `0 0 ${ancho} ${alto}`);
  const regiones = topojson.feature(topo, topo.objects.autonomous_regions).features.filter((f) => f.id !== "20");
  const proyeccion = d3.geoConicConformalSpain().fitSize([ancho, alto], { type: "FeatureCollection", features: regiones });
  const ruta = d3.geoPath(proyeccion);
  const capa = svg.append("g");
  svg.append("path").attr("class", "marco").attr("d", proyeccion.getCompositionBorders());
  const formas = capa.selectAll("path").data(regiones).join("path").attr("class", "region").attr("d", ruta);
  // Ceuta y Melilla son diminutas: se marcan con un punto para poder verlas y tocarlas
  const puntos = capa.selectAll("circle").data(regiones.filter((f) => f.id === "18" || f.id === "19")).join("circle")
    .attr("class", "region").attr("r", 7)
    .attr("cx", (f) => ruta.centroid(f)[0]).attr("cy", (f) => ruta.centroid(f)[1]);

  function pintarMapa(res) {
    const porId = new Map(res.filas.map((f) => [f.c.id, f]));
    const colores = [1, 2, 3, 4, 5].map((i) => css("--seq-" + i));
    const escala = d3.scaleQuantile().domain(res.filas.map((f) => f.porHab)).range(colores);
    for (const sel of [formas, puntos]) {
      sel.attr("fill", (g) => (porId.get(g.id) ? escala(porId.get(g.id).porHab) : css("--rejilla")))
        .classed("sel", (g) => g.id === seleccion)
        .on("mousemove", (ev, g) => porId.get(g.id) && mostrarTip(ev, porId.get(g.id)))
        .on("mouseleave", ocultarTip)
        .on("click", (ev, g) => { if (porId.has(g.id)) elegir(g.id); });
    }
    // Leyenda: tramos de la escala de cuantiles
    const cortes = [d3.min(escala.domain()), ...escala.quantiles(), d3.max(escala.domain())];
    document.getElementById("leyenda").innerHTML = colores.map((col, i) =>
      `<div class="paso"><i style="background:${col}"></i><span>${fmtEur.format(cortes[i])}</span></div>`
    ).join("") + `<div class="paso fin"><i></i><span>${fmtEur.format(cortes[cortes.length - 1])} €/hab</span></div>`;
  }

  // ---- KPIs ----
  function pintarKpis(res) {
    const e = calcularEstado();
    document.getElementById("kpis").innerHTML = `
      <div class="kpi"><div class="et">Media de España</div><div class="val">${porHab(res.media)}</div><div class="det">por habitante</div></div>
      <div class="kpi"><div class="et">Total al año</div><div class="val">${fmtEnt.format(Math.round(res.totalEsp / 1e6))} M€</div><div class="det">19 territorios</div></div>
      <button class="kpi clic${seleccion === "ES" ? " sel" : ""}" id="kpi-estado"><div class="et">Estado ›</div><div class="val">${porHab(e.porHab)}</div><div class="det">${filtros.estado ? "incluido" : "aparte"}</div></button>`;
    document.getElementById("kpi-estado").addEventListener("click", () => elegir("ES"));
  }

  // ---- Ranking ----
  function pintarRanking(res) {
    const max = res.filas[0].porHab;
    const cont = document.getElementById("ranking");
    cont.innerHTML = `<div class="ranking-cuerpo"></div>`;
    const cuerpo = cont.firstChild;
    res.filas.forEach((f) => {
      const b = document.createElement("button");
      b.className = "fila" + (f.c.id === seleccion ? " sel" : "");
      b.innerHTML = `<span class="nom">${f.c.nombre}${f.c.faltan.length ? " *" : ""}</span>
        <span class="pista"><span class="bar" style="width:${(f.porHab / max) * 100}%"></span></span>
        <span class="v">${porHab(f.porHab)}</span>`;
      b.addEventListener("mousemove", (ev) => mostrarTip(ev, f));
      b.addEventListener("mouseleave", ocultarTip);
      b.addEventListener("click", () => elegir(f.c.id));
      cuerpo.appendChild(b);
    });
    // Línea de la media, alineada con la pista de las barras
    const pista = cuerpo.querySelector(".pista");
    const x = pista.offsetLeft + (res.media / max) * pista.offsetWidth;
    cuerpo.insertAdjacentHTML("beforeend",
      `<span class="media-linea" style="left:${x}px"></span><span class="media-et" style="left:${x}px">Media ${porHab(res.media)}</span>`);
    if (res.filas.some((f) => f.c.faltan.length)) {
      cont.insertAdjacentHTML("beforeend", `<p class="nota-rk">* Falta el coste de su parlamento: la cifra real es algo mayor.</p>`);
    }
  }

  // ---- Ficha ----
  function pintarFichaEstado() {
    const e = calcularEstado();
    const partes = e.activos.filter((k) => e.comp[k.id] > 0);
    const tipos = new Set(["gobierno", ...(filtros.otros ? ["organismo", "estatutario"] : [])]);
    const unidades = est.unidades.filter((u) => tipos.has(u.tipo));
    const cam = (n, t) => `<li><span>${n}</span><span>${millones(est.partes[t].altos)} · asesores ${millones(est.partes[t].eventual)}</span></li>`;
    document.getElementById("ficha").innerHTML = `
      <div class="ficha-cab"><h2>Estado</h2><span class="base">${est.base}</span></div>
      <div class="heroe">${porHab(e.porHab)} <small>por habitante</small></div>
      <div class="datos-linea">${millones(e.total)} al año · ${fmtEnt.format(pobTotal)} habitantes</div>
      <div class="pila" role="img" aria-label="Reparto del coste">
        ${partes.map((k) => `<span style="flex:${e.comp[k.id]};background:var(${k.color})" title="${k.nombre}"></span>`).join("")}
      </div>
      <table class="desglose"><tbody>
        ${partes.map((k) => `<tr><td><i class="mu" style="background:var(${k.color})"></i>${k.nombre}</td>
          <td class="num">${millones(e.comp[k.id])}</td><td class="num pct">${fmtPct.format((e.comp[k.id] / e.total) * 100)} %</td></tr>`).join("")}
      </tbody></table>
      <ul class="avisos"><li class="nota">${filtros.estado
        ? "Sumado a cada comunidad: Congreso y Senado según sus escaños; Gobierno central, por habitante."
        : "No se suma a las comunidades. Actívalo con el filtro «Estado»."}</li></ul>
      <details><summary>Congreso y Senado</summary><ul>${cam("Congreso (350 diputados)", "congreso")}${cam("Senado (266 senadores)", "senado")}</ul></details>
      <details><summary>Gobierno central por ministerio (${unidades.length})</summary><ul>
        ${unidades.map((u) => `<li><span>${u.nombre}</span><span>${millones(u.altos + u.eventual)}</span></li>`).join("")}
      </ul></details>
      <div class="fuentes">Fuente: ${est.fuentes.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.texto}</a>`).join(" · ")}</div>`;
  }

  // ---- Por qué cuesta más o menos: cada componente por habitante frente a la mediana de las comunidades ----
  const mediana = (v) => { const o = [...v].sort((a, b) => a - b), m = o.length >> 1; return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; };
  const TEXTO_ALTO = {
    gob_altos: "Más altos cargos, o mejor pagados",
    gob_eventual: "Más asesores de confianza",
    parlamento: "Parlamento caro para su población",
    local_electos: "Alcaldes y concejales cobran más",
    local_diput: "Varias diputaciones, cabildos o consejos",
    local_eventual: "Ayuntamientos con más asesores",
  };
  const TEXTO_BAJO = {
    gob_altos: "Gasta poco en altos cargos",
    gob_eventual: "Pocos asesores de confianza",
    parlamento: "Parlamento barato para su población",
    local_electos: "Alcaldes y concejales cobran menos",
    local_diput: "Poco o nada en diputaciones",
    local_eventual: "Ayuntamientos con pocos asesores",
  };
  function explicar(f, res) {
    const ids = Object.keys(TEXTO_ALTO).filter((id) => f.activos.some((k) => k.id === id));
    const filas = ids.map((id) => {
      const med = mediana(res.filas.map((x) => x.comp[id] / x.c.poblacion));
      const v = f.comp[id] / f.c.poblacion;
      return { id, v, med, dif: v - med, ratio: med > 0 ? v / med : 1 };
    });
    const altos = filas.filter((x) => x.ratio > 1.25 && x.dif > 0.3).sort((a, b) => b.dif - a.dif).slice(0, 3);
    const bajos = filas.filter((x) => x.ratio < 0.8 && x.dif < -0.3).sort((a, b) => a.dif - b.dif).slice(0, 2);
    const nombre = (id) => COMPONENTES.find((k) => k.id === id).nombre.toLowerCase();
    const linea = (x, t, sube) => `<li class="${sube ? "sube" : "baja"}"><span>${sube ? "▲" : "▼"} ${t}</span><span class="t2">${porHab(x.v)} · típica ${porHab(x.med)}</span></li>`;
    // Tamaño: comunidades pequeñas frente a grandes, solo si los propios datos lo confirman
    const pequenas = res.filas.filter((x) => x.c.poblacion < 1.5e6), grandes = res.filas.filter((x) => x.c.poblacion >= 1.5e6);
    const mP = mediana(pequenas.map((x) => x.porHab)), mG = mediana(grandes.map((x) => x.porHab));
    const tam = f.c.poblacion < 1.5e6 && mP > mG * 1.15 && f.dif > 0
      ? `<li class="sube"><span>▲ Comunidad pequeña: el coste fijo se reparte entre pocos</span><span class="t2">pequeñas ${porHab(mP)} · grandes ${porHab(mG)}</span></li>` : "";
    if (!altos.length && !bajos.length && !tam) return `<div class="porque"><h3>¿Por qué?</h3><p class="t2">Ninguna parte destaca: todo está cerca de lo habitual.</p></div>`;
    return `<div class="porque"><h3>¿Por qué ${f.dif >= 0 ? "cuesta más" : "cuesta menos"}?</h3><ul>
      ${tam}${altos.map((x) => linea(x, TEXTO_ALTO[x.id], true)).join("")}${bajos.map((x) => linea(x, TEXTO_BAJO[x.id], false)).join("")}
      </ul></div>`;
  }

  function pintarFicha(res) {
    if (seleccion === "ES") return pintarFichaEstado();
    const f = res.filas.find((x) => x.c.id === seleccion) || res.filas[0];
    const c = f.c;
    const partes = f.activos.filter((k) => f.comp[k.id] > 0);
    const tiposActivos = new Set(["gobierno", ...(filtros.parlamento ? ["parlamento"] : []),
      ...(filtros.otros ? ["organismo", "estatutario"] : [])]);
    const unidades = c.unidades.filter((u) => tiposActivos.has(u.tipo));
    document.getElementById("ficha").innerHTML = `
      <div class="ficha-cab"><h2>${c.nombre}</h2><span class="base">${BASE[c.base] || c.base}</span></div>
      <div class="heroe">${porHab(f.porHab)} <small>por habitante</small></div>
      <div class="comp"><b>${difTexto(f.dif)}</b></div>
      <div class="datos-linea">${millones(f.total)} al año · ${fmtEnt.format(c.poblacion)} habitantes</div>
      <div class="pila" role="img" aria-label="Reparto del coste">
        ${partes.map((k) => `<span style="flex:${f.comp[k.id]};background:var(${k.color})" title="${k.nombre}"></span>`).join("")}
      </div>
      <table class="desglose"><tbody>
        ${partes.map((k) => `<tr><td><i class="mu" style="background:var(${k.color})"></i>${k.nombre}</td>
          <td class="num">${millones(f.comp[k.id])}</td><td class="num pct">${fmtPct.format((f.comp[k.id] / f.total) * 100)} %</td></tr>`).join("")}
      </tbody></table>
      ${explicar(f, res)}
      ${c.faltan.length ? `<ul class="avisos">${c.faltan.map((t) => `<li class="falta">Sin datos. ${t}</li>`).join("")}</ul>` : ""}
      ${c.notas.length || (filtros.local && c.avisos.length) ? `<details><summary>Notas sobre los datos</summary><ul class="avisos">
        ${filtros.local ? c.avisos.map((t) => `<li class="aviso">${t}</li>`).join("") : ""}
        ${c.notas.map((t) => `<li class="nota">${t}</li>`).join("")}</ul></details>` : ""}
      ${filtros.estado && est.escanos[c.nombre] ? `<p class="datos-linea">Incluye ${est.escanos[c.nombre].congreso} diputados y ${est.escanos[c.nombre].senado} senadores de la comunidad y su parte del Gobierno central por habitante.</p>` : ""}
      <details><summary>Gobierno y parlamento por unidad (${unidades.length})</summary><ul>
        ${unidades.map((u) => `<li><span>${u.nombre}</span><span>${millones(u.altos + u.eventual)}</span></li>`).join("")}
      </ul></details>
      ${filtros.local && c.municipios.length ? `<details><summary>Ayuntamientos con más gasto</summary><ul>
        ${c.municipios.map((m) => `<li><span>${m.nombre}</span><span>${millones(m.electos + m.eventual)}</span></li>`).join("")}
      </ul></details>` : ""}
      <div class="fuentes">Fuente: ${c.fuentes.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.texto}</a>`).join(" · ")}${c.municipios.length ? datos.fuentes_local.map((s) => ` · <a href="${s.url}" target="_blank" rel="noopener">${s.texto}</a>`).join("") : ""}</div>`;
  }

  function render() {
    const res = calcular();
    if (!seleccion) seleccion = res.filas[0].c.id;
    pintarKpis(res);
    pintarMapa(res);
    pintarRanking(res);
    pintarFicha(res);
  }

  for (const k of Object.keys(filtros)) {
    document.getElementById("f-" + k).addEventListener("change", (e) => { filtros[k] = e.target.checked; render(); });
  }
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
  window.addEventListener("resize", () => pintarRanking(calcular()));
  render();
})();
