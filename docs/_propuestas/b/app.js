// Propuesta B · «Panel visual». Todas las cifras se calculan aquí a partir de datos.json e historico.json.
(async function () {
  "use strict";
  const R = "../../";
  const $ = (id) => document.getElementById(id);
  const esc = C.esc;

  // ---- Menú en móvil ----
  const cab = document.querySelector(".cabecera");
  $("menu-boton").addEventListener("click", () => {
    const abierto = cab.classList.toggle("abierto");
    $("menu-boton").setAttribute("aria-expanded", String(abierto));
  });

  const [datos, hist, topo] = await Promise.all([
    C.json(R + "datos.json"), C.json(R + "historico.json"), C.json(R + "vendor/autonomous_regions.json"),
  ]);

  // ---- Formatos ----
  const eur2 = (v) => C.fmtEur.format(v) + " €";
  const eur = (v) => C.fmtEnt.format(Math.round(v)) + " €";
  const mill = (v) => C.fmtM.format(v / 1e6) + " M€";
  const millLargo = (v) => C.fmtM.format(v / 1e6) + " millones de euros";
  const pct = (v) => C.fmtPct.format(v * 100) + " %";
  const enlace = (f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.texto)}</a>`;
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const fecha = (iso) => { const [a, m, d] = iso.split("-"); return `${+d} de ${MESES[+m - 1]} de ${a}`; };
  const masMenos = (v) => (Math.abs(v) < 0.005 ? "en la media" : `${pct(Math.abs(v))} ${v > 0 ? "más" : "menos"}`);

  // ---- Cálculos de portada ----
  const pob = datos.poblacion.total;
  const est = datos.estado;
  const parte = (c, t) => c.partes[t] || { altos: 0, eventual: 0 };
  const loc = (c) => c.partes.local || { electos: 0, diputaciones: 0, eventual: 0 };
  const local = (c) => loc(c).electos + loc(c).diputaciones + loc(c).eventual;
  const autonomico = (c) => C.nucleoComunidad(c) - local(c);
  const suma = (f) => datos.comunidades.reduce((s, c) => s + f(c), 0);
  const tLocal = suma(local), tAut = suma(autonomico), tEst = C.nucleoEstado(est);
  const total = tLocal + tAut + tEst;
  const porPersona = total / pob;
  const asesores = suma((c) => parte(c, "gobierno").eventual + parte(c, "parlamento").eventual + loc(c).eventual)
    + ["gobierno", "congreso", "senado"].reduce((s, t) => s + (est.partes[t] ? est.partes[t].eventual : 0), 0);

  const NIVELES = [
    { id: "local", nombre: "Ayuntamientos y diputaciones", det: "Alcaldes, concejales, diputados provinciales y sus asesores", color: "--niv-local", v: tLocal },
    { id: "aut", nombre: "Comunidades autónomas", det: "Gobiernos y parlamentos autonómicos y sus asesores", color: "--niv-aut", v: tAut },
    { id: "est", nombre: "Gobierno de España y Cortes", det: "Ministerios, Congreso, Senado y sus asesores", color: "--niv-est", v: tEst },
  ];

  // ---- Cifra principal ----
  $("cifra").innerHTML = `${C.fmtEur.format(porPersona)}<span class="ud">&nbsp;€</span>`;
  $("pastillas").innerHTML =
    `<span class="pastilla"><b>${eur2(porPersona / 12)}</b> al mes</span>` +
    `<span class="pastilla"><b>${C.fmtM.format(total / 1e6)} millones</b> en total (${datos.anyo})</span>`;

  // ---- Barra de reparto por niveles ----
  function contraste(a, b) {
    const lum = (rgb) => { const c = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  }
  const rgbDe = (s) => (s.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);

  function pintarReparto() {
    const barra = $("reparto-barra");
    barra.setAttribute("aria-label", "Reparto: " + NIVELES.map((n) => `${n.nombre}, ${pct(n.v / total)}`).join("; "));
    barra.innerHTML = NIVELES.map((n, i) =>
      `<div class="seg" data-i="${i}" style="flex:${n.v} 1 0px;background:var(${n.color})"><span>${pct(n.v / total)}</span></div>`).join("");
    $("reparto-leyenda").innerHTML = NIVELES.map((n, i) => `
      <li data-i="${i}" style="--c:var(${n.color})">
        <i class="mu" style="background:var(${n.color})"></i>
        <div class="nom">${n.nombre}<span class="det">${n.det}</span></div>
        <div class="val">${eur2(n.v / pob)}<span class="pct">${pct(n.v / total)} · ${mill(n.v)}</span></div>
      </li>`).join("");
    ajustarEtiquetasReparto();
    const marcar = (i, si) => document.querySelectorAll(`#reparto-barra .seg[data-i="${i}"], #reparto-leyenda li[data-i="${i}"]`)
      .forEach((e) => e.classList.toggle("activo", si));
    document.querySelectorAll("#reparto-barra .seg, #reparto-leyenda li").forEach((el) => {
      const n = NIVELES[+el.dataset.i];
      el.addEventListener("pointermove", (ev) => {
        marcar(el.dataset.i, true);
        if (ev.pointerType === "mouse" && el.classList.contains("seg")) {
          C.tip(ev, `<b>${eur2(n.v / pob)} por persona</b>${n.nombre}<br><span class="t2">${mill(n.v)} al año · ${pct(n.v / total)} del total</span>`);
        }
      });
      el.addEventListener("pointerleave", () => { marcar(el.dataset.i, false); C.ocultarTip(); });
    });
  }
  // Porcentaje dentro del segmento solo si cabe; tinta clara u oscura según el color de fondo
  function ajustarEtiquetasReparto() {
    document.querySelectorAll("#reparto-barra .seg").forEach((s) => {
      const span = s.firstElementChild;
      span.style.visibility = span.offsetWidth + 14 <= s.clientWidth ? "visible" : "hidden";
      const fondo = rgbDe(getComputedStyle(s).backgroundColor);
      s.style.color = contraste(fondo, [11, 11, 11]) >= contraste(fondo, [255, 255, 255]) ? "#0b0b0b" : "#ffffff";
    });
  }

  // ---- 3 de cada 10 euros, para asesores ----
  const deCada10 = Math.round((asesores / total) * 10);
  $("asesores").innerHTML = `
    <div class="asesores-graf">
      <h2 class="mini-titulo">¿Cargos o asesores?</h2>
      <div class="monedas" role="img" aria-label="${deCada10} de cada 10 euros son para asesores">${Array.from({ length: 10 }, (_, i) => `<i class="${i < deCada10 ? "si" : ""}"></i>`).join("")}</div>
    </div>
    <p class="asesores-txt"><b>${deCada10} de cada 10 euros</b> son sueldos de asesores de confianza: ${mill(asesores)} al año.
    <span class="t2">Los otros ${10 - deCada10}, de los propios cargos: presidentes, ministros, consejeros, parlamentarios, alcaldes y concejales.</span></p>`;
  $("aclaracion").innerHTML = `Sueldos brutos de ${datos.anyo}, sin dietas ni cotizaciones sociales. Unas cifras son gasto real y otras, presupuesto. <a href="#como-leer">Cómo se calcula</a>`;

  // ---- Mapa ----
  const filas = datos.comunidades.map((c) => {
    const n = C.nucleoComunidad(c);
    return { c, id: c.id, total: n, porHab: n / c.poblacion, local: local(c) / c.poblacion, aut: autonomico(c) / c.poblacion };
  }).sort((a, b) => b.porHab - a.porHab);
  filas.forEach((f, i) => (f.puesto = i + 1));
  const porId = new Map(filas.map((f) => [f.id, f]));
  const media = suma(C.nucleoComunidad) / suma((c) => c.poblacion);
  filas.forEach((f) => (f.dif = f.porHab / media - 1));
  const maxF = filas[0], minF = filas[filas.length - 1];

  // Tramos redondos (cada 5 €) calculados a partir de los datos
  const [vmin, vmax] = d3.extent(filas, (f) => f.porHab);
  let marcas = d3.ticks(vmin, vmax, 5);
  const paso = marcas[1] - marcas[0];
  let umbrales = marcas.filter((t) => t > vmin + paso / 2 && t < vmax);
  if (umbrales.length < 3 || umbrales.length > 5) umbrales = d3.scaleQuantile().domain(filas.map((f) => f.porHab)).range([0, 1, 2, 3, 4]).quantiles();
  const COLORES = umbrales.length === 4 ? [1, 2, 3, 4, 5] : umbrales.length === 3 ? [1, 2, 4, 5] : [1, 2, 3, 4, 5, 5];
  const escala = d3.scaleThreshold().domain(umbrales).range(COLORES.map((k) => `var(--seq-${k})`));

  const svg = d3.select("#mapa");
  const ANCHO = 640;
  const regiones = topojson.feature(topo, topo.objects.autonomous_regions).features.filter((f) => f.id !== "20");
  const coleccion = { type: "FeatureCollection", features: regiones };
  // La proyección compuesta no tiene fitWidth: se ajusta a un alto holgado y se recorta con el viewBox
  const proy = d3.geoConicConformalSpain().fitSize([ANCHO, ANCHO * 4], coleccion);
  const ruta = d3.geoPath(proy);
  // Canarias se coloca en el mar, al sureste de la península: el mapa queda más compacto y se ve más grande
  const canarias = regiones.find((g) => g.id === "05");
  const [[rx0, ry0], [rx1, ry1]] = ruta.bounds({ type: "FeatureCollection", features: regiones.filter((g) => g.id !== "05") });
  const [[cx0, cy0], [cx1, cy1]] = ruta.bounds(canarias);
  const sC = Math.min(1, ((rx1 - rx0) * 0.36) / (cx1 - cx0));
  const tx = rx1 - 6 - sC * cx1, ty = ry1 - 2 - sC * cy1;
  const mover = ([x, y]) => [tx + sC * x, ty + sC * y];
  const centroide = (g) => (g.id === "05" ? mover(ruta.centroid(g)) : ruta.centroid(g));
  const VB = { x: Math.floor(rx0) - 6, y: Math.floor(ry0) - 6, w: Math.ceil(rx1 - rx0) + 12, h: Math.ceil(ry1 - ry0) + 12 };
  svg.attr("viewBox", `${VB.x} ${VB.y} ${VB.w} ${VB.h}`);
  const [mx0, my0] = mover([cx0, cy0]), [mx1, my1] = mover([cx1, cy1]);
  svg.append("rect").attr("class", "marco").attr("x", mx0 - 8).attr("y", my0 - 8).attr("width", mx1 - mx0 + 14).attr("height", my1 - my0 + 12).attr("rx", 6);
  const capa = svg.append("g");
  const PEQUENAS = new Set(["18", "19"]); // Ceuta y Melilla: un punto para poder verlas y tocarlas
  const formas = capa.selectAll("path.region").data(regiones).join("path").attr("class", "region").attr("d", ruta)
    .attr("transform", (g) => (g.id === "05" ? `translate(${tx},${ty}) scale(${sC})` : null));
  const puntos = capa.selectAll("circle.region").data(regiones.filter((g) => PEQUENAS.has(g.id))).join("circle")
    .attr("class", "region").attr("cx", (g) => centroide(g)[0]).attr("cy", (g) => centroide(g)[1]);
  const etiquetas = svg.append("g");
  // Unidades del viewBox por píxel en pantalla: textos y puntos mantienen su tamaño en móvil
  const escalaMapa = () => VB.w / Math.max(200, svg.node().getBoundingClientRect().width || VB.w);
  const todas = capa.selectAll(".region");
  todas.filter((g) => porId.has(g.id))
    .attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", (g) => `${porId.get(g.id).c.nombre}: ${eur2(porId.get(g.id).porHab)} por habitante`)
    .style("fill", (g) => escala(porId.get(g.id).porHab))
    .on("pointermove", (ev, g) => { if (ev.pointerType === "mouse") C.tip(ev, tipComunidad(porId.get(g.id))); })
    .on("pointerleave", C.ocultarTip)
    .on("click", (ev, g) => { C.ocultarTip(); seleccionar(g.id, true); })
    .on("keydown", (ev, g) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); seleccionar(g.id, true); } });
  todas.filter((g) => !porId.has(g.id)).style("fill", "var(--rejilla)");
  // Ceuta y Melilla quedan por encima del resto
  puntos.raise();

  function tipComunidad(f) {
    return `<b>${esc(f.c.nombre)}</b>${eur2(f.porHab)} por habitante<br><span class="t2">${f.dif >= 0 ? "▲" : "▼"} ${masMenos(f.dif)} que la media · puesto ${f.puesto} de ${filas.length}</span>`;
  }

  // Etiquetas directas: la más cara y la más barata, o la elegida
  const CENTRO = { "05": [0, 0], "13": [0, 2] };
  function pintarEtiquetas() {
    const k = escalaMapa();
    puntos.attr("r", 6 * k);
    const lista = sel ? [porId.get(sel)] : [maxF, minF];
    etiquetas.selectAll("*").remove();
    // Ceuta y Melilla son solo un punto: se rotula su nombre para que se reconozcan
    regiones.filter((g) => PEQUENAS.has(g.id) && porId.has(g.id) && !lista.some((f) => f.id === g.id)).forEach((g) => {
      const [x, y] = centroide(g);
      // Melilla se rotula a la izquierda para no tocar el recuadro de Canarias
      const izq = g.id === "19";
      etiquetas.append("text").attr("class", "etq-peq").attr("x", x + (izq ? -10 : 10) * k).attr("y", y + 4 * k)
        .attr("text-anchor", izq ? "end" : "start")
        .style("font-size", 11 * k + "px").style("stroke-width", 3 * k + "px").text(porId.get(g.id).c.nombre);
    });
    lista.forEach((f) => {
      const g = regiones.find((r) => r.id === f.id);
      let [x, y] = centroide(g);
      const d = CENTRO[f.id] || [0, 0];
      x += d[0] * k; y += d[1] * k;
      if (PEQUENAS.has(f.id)) y -= 24 * k;
      const t = etiquetas.append("text").attr("class", "etq").attr("x", x).attr("y", y - 4 * k).style("stroke-width", 3.5 * k + "px");
      t.append("tspan").attr("class", "n").attr("x", x).style("font-size", 11 * k + "px").text(f.c.nombre.replace("Comunidad de ", "").replace("Comunitat ", ""));
      t.append("tspan").attr("class", "v").attr("x", x).attr("dy", 15 * k).style("font-size", 14 * k + "px").text(eur2(f.porHab));
    });
  }

  // Leyenda del mapa (tramos y posición de la media)
  function pintarLeyenda() {
    const lo = vmin, hi = vmax;
    const bordes = [lo, ...umbrales, hi];
    const n = bordes.length - 1;
    // Cada tramo ocupa el mismo ancho; la media se sitúa dentro de su tramo
    const pos = (v) => {
      const i = Math.max(0, Math.min(n - 1, d3.bisectRight(umbrales, v)));
      return ((i + (v - bordes[i]) / (bordes[i + 1] - bordes[i])) / n) * 100;
    };
    $("leyenda-mapa").innerHTML = `<span class="fin">Menos</span>
      <div class="escala">
        <div class="tramos">${escala.range().slice(0, n).map((c) => `<i style="background:${c}"></i>`).join("")}</div>
        ${umbrales.map((u, i) => `<span class="corte" style="left:${((i + 1) / n) * 100}%">${C.fmtEnt.format(u)} €</span>`).join("")}
        <span class="marca-media" style="left:${pos(media)}%" title="Media"></span>
      </div>
      <span class="fin">Más</span>
      <span class="fin leyenda-media"><i style="display:inline-block;width:2px;height:12px;background:var(--tinta);vertical-align:-2px;margin-right:5px"></i>Media: ${eur2(media)}</span>`;
  }

  // ---- Ficha de la comunidad ----
  let sel = null;
  const ICONO_AVISO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/></svg>`;
  const BASE = { ejecutado: "gasto real", presupuestado: "presupuesto" };

  function tira(f) {
    const W = Math.max(200, ($("ficha").clientWidth || 262) - 34), H = 44, m = 8;
    const x = d3.scaleLinear().domain([vmin, vmax]).range([m, W - m]);
    const pts = filas.map((g) => `<circle class="pt${g.id === f.id ? " sel" : ""}" data-id="${g.id}" cx="${x(g.porHab).toFixed(1)}" cy="22" r="${g.id === f.id ? 6.5 : 4.5}"><title>${esc(g.c.nombre)}: ${eur2(g.porHab)}</title></circle>`);
    const sel1 = pts.splice(filas.findIndex((g) => g.id === f.id), 1);
    return `<svg class="tira" viewBox="0 0 ${W} ${H}" role="img" aria-label="Posición entre las ${filas.length}: de ${eur2(vmin)} a ${eur2(vmax)}">
      <line class="base-l" x1="${m}" x2="${W - m}" y1="22" y2="22"/>
      <line class="media" x1="${x(media)}" x2="${x(media)}" y1="10" y2="34"/>
      <text x="${x(media)}" y="7" text-anchor="middle">media</text>
      ${pts.join("")}${sel1.join("")}
      <text x="${m}" y="${H}" text-anchor="start">${eur2(vmin)}</text>
      <text x="${W - m}" y="${H}" text-anchor="end">${eur2(vmax)}</text>
    </svg>`;
  }

  function pintarFicha() {
    const caja = $("ficha");
    const f = sel && porId.get(sel);
    if (!f) {
      caja.innerHTML = `
        <div class="pista"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5a6.5 6.5 0 0 1-6.5 6.5h-.6a6 6 0 0 1-4.6-2.2L4.6 15a1.5 1.5 0 0 1 2.3-1.9L9 15.5"/></svg>
          Elige una comunidad en el mapa para ver su cifra y su reparto</div>
        <div class="extremos">
          ${[[maxF, "La más cara"], [minF, "La más barata"]].map(([x, t]) => `<button class="extremo" data-id="${x.id}">
            <div><span>${t}</span><b>${esc(x.c.nombre)}</b></div><strong>${eur2(x.porHab)}</strong></button>`).join("")}
        </div>
        <div class="cuentas">
          <div><span>Media de las comunidades</span><b>${eur2(media)}</b></div>
          <div><span>+ Gobierno de España y Cortes, igual para todos</span><b>${eur2(tEst / pob)}</b></div>
          <div class="suma"><span>= Lo que paga cada persona</span><b>${eur2(porPersona)}</b></div>
        </div>`;
      caja.querySelectorAll(".extremo").forEach((b) => b.addEventListener("click", () => seleccionar(b.dataset.id, false)));
      return;
    }
    const c = f.c;
    const puesto = f.puesto === 1 ? `La más cara de ${filas.length}` : f.puesto === filas.length ? `La más barata de ${filas.length}` : `Puesto ${f.puesto} de ${filas.length}, de más cara a más barata`;
    const avisos = [];
    if (c.faltan.length) avisos.push(`Sin datos de su parlamento: la cifra real es algo mayor.`);
    if (c.avisos.length) avisos.push(`Faltan datos de algunos ayuntamientos: la cifra real es algo mayor.`);
    caja.innerHTML = `
      <h3>${esc(c.nombre)}</h3>
      <div class="puesto">${puesto}</div>
      <div class="grande">${eur2(f.porHab)}<small>por habitante</small></div>
      <div class="comp"><b>${f.dif >= 0 ? "▲" : "▼"} ${masMenos(f.dif)}</b> que la media (${eur2(media)})</div>
      ${tira(f)}
      <div class="mini-pila" aria-hidden="true">
        ${f.local > 0 ? `<i style="flex:${f.local} 1 0px;background:var(--niv-local)"></i>` : ""}<i style="flex:${f.aut} 1 0px;background:var(--niv-aut)"></i>
      </div>
      <div class="filas">
        ${f.local > 0 ? `<div><i style="background:var(--niv-local)"></i><span>Ayuntamientos y diputaciones</span><span>${eur2(f.local)}</span></div>` : ""}
        <div><i style="background:var(--niv-aut)"></i><span>${f.local > 0 ? "Gobierno y parlamento autonómico" : "Gobierno y Asamblea de la ciudad"}</span><span>${eur2(f.aut)}</span></div>
      </div>
      ${c.notas.map((t) => `<div class="nota">${esc(t)}</div>`).join("")}
      ${avisos.map((t) => `<div class="nota aviso">${ICONO_AVISO}<span>${t}</span></div>`).join("")}
      <span class="etiqueta">Datos autonómicos: ${BASE[c.base] || esc(c.base)}</span>
      <div class="acciones"><a href="${R}comunidades.html">Ver el detalle <span aria-hidden="true">→</span></a><button class="cerrar" type="button">Ver toda España</button></div>`;
    caja.querySelector(".cerrar").addEventListener("click", () => seleccionar(null, false));
    caja.querySelectorAll(".tira .pt").forEach((p) => p.addEventListener("click", () => seleccionar(p.dataset.id, false)));
  }

  // ---- Lista (la misma información del mapa, sin depender del color) ----
  function pintarLista() {
    $("lista").innerHTML = filas.map((f) => `<button class="fila-lista${f.id === sel ? " sel" : ""}" data-id="${f.id}">
      <span class="nom">${esc(f.c.nombre)}${f.c.faltan.length ? " *" : ""}</span>
      <span class="pista-b"><i style="width:${(f.porHab / maxF.porHab) * 100}%;background:${escala(f.porHab)}"></i></span>
      <span class="v">${eur2(f.porHab)}</span></button>`).join("") +
      (filas.some((f) => f.c.faltan.length) ? `<p class="fv-fuente" style="grid-column:1/-1;margin:6px 4px 0">* Sin datos de su parlamento: la cifra real es algo mayor.</p>` : "");
    $("lista").querySelectorAll(".fila-lista").forEach((b) => b.addEventListener("click", () => seleccionar(b.dataset.id, false)));
  }

  const elige = $("elige");
  elige.innerHTML = `<option value="">Elige tu comunidad</option>` +
    [...filas].sort((a, b) => a.c.nombre.localeCompare(b.c.nombre, "es")).map((f) => `<option value="${f.id}">${esc(f.c.nombre)}</option>`).join("");
  elige.addEventListener("change", () => seleccionar(elige.value || null, false));

  function seleccionar(id, desdeMapa) {
    sel = id && porId.has(id) ? id : null;
    elige.value = sel || "";
    svg.classed("con-sel", !!sel);
    todas.classed("sel", (g) => g.id === sel);
    pintarEtiquetas();
    pintarFicha();
    pintarLista();
    if (desdeMapa && window.matchMedia("(max-width: 720px)").matches) {
      const r = $("ficha").getBoundingClientRect();
      if (r.bottom > window.innerHeight) $("ficha").scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  // ---- Ficha visual 1: Gobierno de España ----
  const serie = hist.estado;
  const ultimo = [...serie].reverse().find((r) => !r.prorrogado);
  // Último presupuesto propio con menos ministerios que el más reciente
  const antes = [...serie].reverse().find((r) => !r.prorrogado && r.ministerios < ultimo.ministerios) || serie[0];
  const inicio = serie[0];
  const real = (r) => r.gobierno_asesores * r.factor_ipc;
  $("fv-estado-t").textContent = `Los asesores de los ministerios: de ${C.fmtM.format(antes.gobierno_asesores / 1e6)} a ${C.fmtM.format(ultimo.gobierno_asesores / 1e6)} millones de euros`;
  $("fv-estado-s").textContent = `Presupuesto para asesores de confianza de los ministerios, ${inicio.anyo}-${serie[serie.length - 1].anyo}, en euros de cada año`;
  $("fv-estado-d").innerHTML = `
    <span>Ministerios: <b>${antes.ministerios}</b> en ${antes.anyo} → <b>${ultimo.ministerios}</b> en ${ultimo.anyo}</span>
    <span>Subida: <b>${pct(ultimo.gobierno_asesores / antes.gobierno_asesores - 1)}</b> (${pct(real(ultimo) / real(antes) - 1)} descontada la inflación)</span>
    <span class="leyenda-picto"><i style="background:var(--gris-dato);opacity:.45"></i>Año sin presupuesto nuevo: se repite el anterior</span>`;
  $("fv-estado-f").innerHTML = `Fuente: ${enlace(hist.fuentes[0])}`;

  function graficoEstado() {
    const s = d3.select("#g-estado");
    const W = Math.max(280, s.node().getBoundingClientRect().width || 520), H = 170;
    const m = { t: 22, r: 4, b: 22, l: 4 };
    s.attr("viewBox", `0 0 ${W} ${H}`).selectAll("*").remove();
    s.attr("aria-label", `Barras por año. ${antes.anyo}: ${mill(antes.gobierno_asesores)}; ${ultimo.anyo}: ${mill(ultimo.gobierno_asesores)}.`);
    const x = d3.scaleBand().domain(serie.map((r) => r.anyo)).range([m.l, W - m.r]).paddingInner(0.28);
    const y = d3.scaleLinear().domain([0, d3.max(serie, (r) => r.gobierno_asesores) * 1.05]).range([H - m.b, m.t]);
    const bw = Math.min(24, x.bandwidth());
    const dx = (x.bandwidth() - bw) / 2;
    const destacados = new Set([inicio.anyo, antes.anyo, ultimo.anyo]);
    const barra = (xx, yy, w, h) => { const r = Math.min(4, h, w / 2); return `M${xx},${yy + h}V${yy + r}Q${xx},${yy} ${xx + r},${yy}H${xx + w - r}Q${xx + w},${yy} ${xx + w},${yy + r}V${yy + h}Z`; };
    serie.forEach((r) => {
      const g = s.append("g").attr("class", "col");
      const yy = y(r.gobierno_asesores), h = y(0) - yy;
      g.append("path").attr("class", "barra").attr("d", barra(x(r.anyo) + dx, yy, bw, h))
        .style("fill", destacados.has(r.anyo) && r.anyo !== inicio.anyo ? "var(--acento)" : "var(--gris-dato)")
        .style("opacity", r.prorrogado ? 0.45 : 1);
      g.append("rect").attr("class", "golpe").attr("x", x(r.anyo) - (x.step() - x.bandwidth()) / 2).attr("width", x.step())
        .attr("y", m.t).attr("height", H - m.b - m.t)
        .on("pointermove", (ev) => {
          if (ev.pointerType !== "mouse") return;
          C.tip(ev, `<b>${r.anyo} · ${mill(r.gobierno_asesores)}</b><span class="t2">${r.prorrogado ? `Se repitió el presupuesto de ${r.prorrogado}` : `Presupuesto del Gobierno de ${esc(r.autor)}`}<br>${r.ministerios} ministerios${r.factor_ipc ? ` · ${mill(real(r))} en euros de ${hist.base_ipc}` : ""}</span>`);
        })
        .on("pointerleave", C.ocultarTip);
    });
    s.append("line").attr("class", "base-l").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(0)).attr("y2", y(0));
    [inicio, antes, ultimo].forEach((r) => {
      const cx = x(r.anyo) + x.bandwidth() / 2;
      s.append("text").attr("class", r === inicio ? "" : "fuerte").attr("x", cx).attr("y", y(r.gobierno_asesores) - 7).attr("text-anchor", "middle").text(mill(r.gobierno_asesores));
    });
    const ultimoAnyo = serie[serie.length - 1];
    // El último año solo se rotula si no choca con el del último presupuesto propio
    const sitio = x(ultimoAnyo.anyo) - x(ultimo.anyo) >= 52;
    [inicio, antes, ultimo, ...(sitio ? [ultimoAnyo] : [])].forEach((r) => {
      const cx = x(r.anyo) + x.bandwidth() / 2;
      s.append("text").attr("x", cx).attr("y", H - 5).attr("text-anchor", r === ultimoAnyo ? "end" : r === inicio ? "start" : "middle")
        .attr("dx", r === ultimoAnyo ? x.bandwidth() / 2 : r === inicio ? -x.bandwidth() / 2 : 0)
        .attr("class", r === antes || r === ultimo ? "fuerte" : "").style("font-size", "11px").text(r.anyo);
    });
  }

  // ---- Ficha visual 2: Cuánto cobran ----
  const D = hist.sueldos.detalle;
  const presi = D.cargos.find((c) => c.cargo === "Presidente del Gobierno");
  const masQue = D.cargos.filter((c) => c.anual > presi.anual);
  const maestro = D.referencias.funcionario_A2_22;
  const minus = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  $("fv-sueldos-t").textContent = `${masQue.length} cargos del Estado tienen un sueldo mayor que el del presidente del Gobierno`;
  $("fv-sueldos-s").textContent = `Sueldos brutos anuales fijados por ley en ${D.anyo}. Cada barra, un cargo`;
  $("fv-sueldos-d").innerHTML = `
    <span>El más alto: <b>${eur(D.cargos[0].anual)}</b>, ${minus(D.cargos[0].cargo)}</span>
    <span>Presidente del Gobierno: <b>${eur(presi.anual)}</b></span>`;
  $("fv-sueldos-f").innerHTML = `Fuente: <a href="${esc(D.url)}" target="_blank" rel="noopener">${esc(D.ley)}, de Presupuestos Generales del Estado (BOE)</a>`;

  function graficoSueldos() {
    const s = d3.select("#g-sueldos");
    const W = Math.max(280, s.node().getBoundingClientRect().width || 520), H = 190;
    const m = { t: 30, r: 2, b: 6, l: 2 };
    s.attr("viewBox", `0 0 ${W} ${H}`).selectAll("*").remove();
    const items = [...D.cargos.map((c) => ({ ...c, tipo: c === presi ? "presi" : c.anual > presi.anual ? "mas" : "menos" })), { hueco: true }, { cargo: "Maestro o enfermero", anual: maestro.anual, tipo: "ref" }];
    s.attr("aria-label", `${masQue.length} cargos cobran más que el presidente del Gobierno (${eur(presi.anual)}). El más alto, ${eur(D.cargos[0].anual)}. Un maestro o enfermero, ${eur(maestro.anual)} de sueldo básico.`);
    const x = d3.scaleBand().domain(d3.range(items.length)).range([m.l, W - m.r]).paddingInner(0.25);
    const y = d3.scaleLinear().domain([0, D.cargos[0].anual]).range([H - m.b, m.t + 8]);
    const bw = Math.min(24, x.bandwidth()), dx = (x.bandwidth() - bw) / 2;
    const barra = (xx, yy, w, h) => { const r = Math.min(4, h, w / 2); return `M${xx},${yy + h}V${yy + r}Q${xx},${yy} ${xx + r},${yy}H${xx + w - r}Q${xx + w},${yy} ${xx + w},${yy + r}V${yy + h}Z`; };
    const COL = { mas: "var(--gris-dato)", presi: "var(--acento)", menos: "var(--gris-dato)", ref: "var(--tinta-2)" };
    items.forEach((it, i) => {
      if (it.hueco) return;
      const yy = y(it.anual), h = y(0) - yy;
      s.append("path").attr("d", barra(x(i) + dx, yy, bw, h)).style("fill", COL[it.tipo]).style("opacity", it.tipo === "menos" ? 0.5 : 1);
      s.append("rect").attr("class", "golpe").attr("x", x(i) - 2).attr("width", x.step()).attr("y", m.t).attr("height", H - m.t - m.b)
        .on("pointermove", (ev) => {
          if (ev.pointerType !== "mouse") return;
          C.tip(ev, `<b>${eur(it.anual)} al año</b>${esc(it.cargo)}<br><span class="t2">${it.tipo === "ref" ? esc(maestro.texto) + ". Retribución básica estatal." : esc(it.grupo)}</span>`);
        })
        .on("pointerleave", C.ocultarTip);
    });
    s.append("line").attr("class", "base-l").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(0)).attr("y2", y(0));
    // Llave sobre los cargos que cobran más que el presidente
    const xa = x(0) + dx, xb = x(masQue.length - 1) + dx + bw, yl = m.t - 4;
    s.append("path").attr("class", "llave").attr("d", `M${xa},${yl + 6}V${yl}H${xb}V${yl + 6}`);
    s.append("text").attr("class", "fuerte").attr("x", (xa + xb) / 2).attr("y", yl - 7).attr("text-anchor", "middle").text(`${masQue.length} cobran más que el presidente`);
    // Presidente del Gobierno: etiqueta justo encima de su barra
    const ip = D.cargos.indexOf(presi), xp = x(ip) + dx;
    const t = s.append("text").attr("x", xp).attr("y", y(presi.anual) - 34).attr("text-anchor", "start");
    t.append("tspan").attr("x", xp).text("Presidente del");
    t.append("tspan").attr("x", xp).attr("dy", 13).text("Gobierno");
    t.append("tspan").attr("class", "fuerte").attr("x", xp).attr("dy", 15).text(eur(presi.anual));
    // Maestro o enfermero: por encima de las barras vecinas y sin pisar la etiqueta del presidente
    const im = items.length - 1, xm = x(im) + dx + bw;
    const t2 = s.append("text").attr("text-anchor", "end");
    t2.append("tspan").attr("x", xm).text("Maestro o enfermero*");
    t2.append("tspan").attr("class", "fuerte").attr("x", xm).attr("dy", 15).text(eur(maestro.anual));
    const caja1 = t.node().getBBox();
    const ancho2 = t2.node().getBBox().width;
    const techoVecinas = y(d3.max(D.cargos.filter((c) => c.anual < presi.anual), (c) => c.anual));
    let base2 = techoVecinas - 8; // línea base del valor
    if (xm - ancho2 < caja1.x + caja1.width + 6) base2 = Math.min(base2, caja1.y - 6);
    t2.attr("y", base2 - 15);
    t2.selectAll("tspan").attr("y", null);
    s.append("line").attr("class", "ref-l").attr("x1", x(im) + dx + bw / 2).attr("x2", x(im) + dx + bw / 2)
      .attr("y1", base2 + 4).attr("y2", y(maestro.anual) - 3);
  }
  $("fv-sueldos-d").insertAdjacentHTML("beforeend", `<span>* Sueldo básico estatal; el real suele ser mayor</span>`);

  // ---- Ficha visual 3: Ayuntamientos ----
  const lt = { electos: suma((c) => loc(c).electos), eventual: suma((c) => loc(c).eventual), diputaciones: suma((c) => loc(c).diputaciones) };
  $("fv-local-t").textContent = `${Math.round((tLocal / total) * 3)} de cada 3 euros se pagan en ayuntamientos y diputaciones`;
  $("fv-local-s").textContent = `${millLargo(tLocal)} al año en ${datos.anyo}. Así se reparten:`;
  const LOCAL = [["Alcaldes y concejales", lt.electos], ["Asesores de los ayuntamientos", lt.eventual], ["Diputaciones, cabildos y consejos comarcales", lt.diputaciones]];
  const maxL = d3.max(LOCAL, (d) => d[1]);
  $("g-local").innerHTML = LOCAL.map(([n, v]) => `<div class="hb">
      <div class="hb-et"><span>${n}</span><b>${mill(v)}</b></div>
      <div class="hb-pista"><i style="width:${(v / maxL) * 100}%"></i></div></div>`).join("");
  const conAviso = datos.comunidades.filter((c) => c.avisos.length).length;
  $("fv-local-d").innerHTML = `<span>Por persona: <b>${eur2(tLocal / pob)}</b> al año</span>` +
    (conAviso ? `<span>En ${conAviso} comunidades faltan datos de algunos municipios: la cifra real es algo mayor</span>` : "");
  $("fv-local-f").innerHTML = `Fuente: ${datos.fuentes_local.map(enlace).join(" y ")} (Ministerio de Hacienda)`;

  // ---- Ficha visual 4: ¿Qué se podría pagar? ----
  const personas = Math.floor(total / maestro.anual);
  const POR_CUADRO = 1000;
  const cuadros = Math.round(personas / POR_CUADRO);
  $("fv-calc-t").textContent = `Con todo ese dinero se pagaría el sueldo de ${C.fmtEnt.format(personas)} maestros o enfermeros durante un año`;
  $("fv-calc-s").textContent = `${millLargo(total)} ÷ ${eur(maestro.anual)}, el sueldo básico estatal de un maestro o enfermero (${D.anyo})`;
  $("g-calc").innerHTML = `<svg viewBox="0 0 16 22"><use href="#persona"/></svg>`.repeat(cuadros);
  $("g-calc").setAttribute("aria-label", `${cuadros} figuras, cada una ${C.fmtEnt.format(POR_CUADRO)} personas`);
  $("fv-calc-d").innerHTML = `<span class="leyenda-picto"><svg viewBox="0 0 16 22" aria-hidden="true"><use href="#persona"/></svg>= ${C.fmtEnt.format(POR_CUADRO)} maestros o enfermeros</span><span>El sueldo real suele ser mayor, así que serían algo menos</span>`;
  $("fv-calc-f").innerHTML = `Fuente: <a href="${esc(D.url)}" target="_blank" rel="noopener">${esc(D.ley)} (BOE)</a>`;

  // ---- Pie: fecha y fuentes ----
  $("pie-fecha").innerHTML = `Datos de ${datos.anyo}, actualizados el ${fecha(datos.generado)}. Población: <a href="${esc(datos.poblacion.url)}" target="_blank" rel="noopener">${esc(datos.poblacion.fuente)}</a>.`;
  $("pie-fuentes").innerHTML = `Fuentes: ${[...est.fuentes, ...datos.fuentes_local, ...hist.fuentes].map(enlace).join(" · ")}. Las de cada comunidad, en <a href="${R}comunidades.html">su ficha</a>.`;

  // ---- Dibujo ----
  function dibujarGraficos() { graficoEstado(); graficoSueldos(); ajustarEtiquetasReparto(); pintarEtiquetas(); }
  pintarReparto();
  pintarLeyenda();
  seleccionar(null, false);
  dibujarGraficos();
  let espera;
  window.addEventListener("resize", () => { clearTimeout(espera); espera = setTimeout(dibujarGraficos, 120); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", ajustarEtiquetasReparto);
})();
