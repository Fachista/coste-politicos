// Portada. Todas las cifras se calculan aquí a partir de datos.json e historico.json: no hay ningún número escrito a mano.
(async function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = C.esc;

  const [datos, hist, topo] = await Promise.all([
    C.json("datos.json"), C.json("historico.json"), C.json("vendor/autonomous_regions.json"),
  ]);

  // ---------------- Formatos (espacio duro: «39,52 €» nunca se parte) ----------------
  const NB = "\u00a0";
  const eur2 = (v) => C.fmtEur.format(v) + NB + "€";
  const eur = (v) => C.fmtEnt.format(Math.round(v)) + NB + "€";
  const pct = (v) => C.fmtPct.format(v * 100) + NB + "%";
  const ent = (v) => C.fmtEnt.format(v);
  // «895,4 millones de euros»: con todas las letras, nunca «M€»
  const mill = (v) => C.fmtM.format(v / 1e6) + NB + "millones";
  const millE = (v) => mill(v) + " de euros";
  const mEje = (v) => C.fmtEnt.format(Math.round(v / 1e6));
  const apellido = (n) => n.split(" ").slice(-1)[0];
  const minus = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const enlace = (f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.texto)}</a>`;
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const fecha = (iso) => { const [a, m, d] = iso.split("-"); return `${+d} de ${MESES[+m - 1]} de ${a}`; };
  const masMenos = (v) => (Math.abs(v) < 0.005 ? "En la media" : `${pct(Math.abs(v))} ${v > 0 ? "más" : "menos"}`);
  const lista = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1] : xs[0] || "");
  // «Dos de cada tres»: solo si la fracción sencilla se ajusta de verdad al dato
  const NUM = ["", "Uno", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez"];
  const FRAC = [[1, 2], [2, 3], [3, 4], [1, 3], [1, 4], [3, 5], [2, 5], [4, 5]];
  const fraccion = (p) => { const f = FRAC.find(([a, b]) => Math.abs(p - a / b) < 0.015); return f ? `${NUM[f[0]]} de cada ${NUM[f[1]].toLowerCase()}` : null; };
  const organismo = (url) => (/digital\.gob\.es/.test(url) ? "Ministerio para la Transformación Digital y de la Función Pública"
    : /hacienda\.gob\.es/.test(url) ? "Ministerio de Hacienda" : "");
  const enlaceOrg = (f) => enlace(f) + (organismo(f.url) ? ` (${organismo(f.url)})` : "");
  const guardar = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } };
  const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const ancho = (el, porDefecto) => Math.round(el.getBoundingClientRect().width) || porDefecto;

  // Tooltip: con ratón al pasar; en pantallas táctiles, al tocar. Nunca es la única vía: cada gráfico tiene su lista.
  function tipEn(el, html) {
    el.addEventListener("pointermove", (ev) => { if (ev.pointerType === "mouse") C.tip(ev, html()); });
    el.addEventListener("pointerdown", (ev) => { if (ev.pointerType !== "mouse") C.tip(ev, html()); });
    el.addEventListener("pointerleave", (ev) => { if (ev.pointerType === "mouse") C.ocultarTip(); });
  }
  window.addEventListener("scroll", C.ocultarTip, { passive: true });

  // ---------------- Cálculos ----------------
  const CC = datos.comunidades;
  const pob = datos.poblacion.total;
  const est = datos.estado;
  const parte = (c, t) => c.partes[t] || { altos: 0, eventual: 0 };
  const loc = (c) => c.partes.local || { electos: 0, diputaciones: 0, eventual: 0 };
  const local = (c) => loc(c).electos + loc(c).diputaciones + loc(c).eventual;
  const autonomico = (c) => C.nucleoComunidad(c) - local(c);
  const suma = (f) => CC.reduce((s, c) => s + f(c), 0);
  const tLocal = suma(local), tAut = suma(autonomico), tEst = C.nucleoEstado(est);
  const total = tLocal + tAut + tEst;
  const porPersona = total / pob;
  const asesores = suma((c) => parte(c, "gobierno").eventual + parte(c, "parlamento").eventual + loc(c).eventual)
    + ["gobierno", "congreso", "senado"].reduce((s, t) => s + (est.partes[t] ? est.partes[t].eventual : 0), 0);
  // Comprobación: el reparto cuadra con las funciones comunes de la web
  const control = suma(C.nucleoComunidad) + C.nucleoEstado(est);
  if (Math.abs(control - total) > 1) console.warn("Descuadre en el total de la portada", control, total);

  const BASE_TXT = { ejecutado: "gasto real", presupuestado: "presupuesto" };
  const NIVELES = [
    { id: "local", nombre: "Ayuntamientos y diputaciones", det: "Alcaldes, concejales y sus asesores", base: "gasto real", color: "--niv-local", v: tLocal },
    { id: "aut", nombre: "Gobiernos y parlamentos autonómicos", det: "Consejeros, diputados autonómicos y sus asesores", base: "presupuesto o gasto real, según la comunidad", color: "--niv-aut", v: tAut },
    { id: "est", nombre: "Gobierno de España y Cortes", det: "Ministros, diputados, senadores y sus asesores", base: est.base.split(" · ").map((t) => t.replace(/^Gobierno:/, "Gobierno de España:")).join("; ").toLowerCase().replace("gobierno de españa", "Gobierno de España").replace("cortes", "Cortes"), color: "--niv-est", v: tEst },
  ];

  // ---------------- Monedas de 1 € ----------------
  let nClip = 0;
  const f1 = (v) => Math.round(v * 10) / 10;
  // Una moneda de radio r; si frac < 1 solo se pinta esa parte y el resto queda como hueco
  function moneda(cx, cy, r, frac, relleno, clase) {
    const glifo = r >= 7 ? `<text class="glifo" x="${f1(cx)}" y="${f1(cy + r * 0.37)}" font-size="${f1(r * 1.05)}" text-anchor="middle">€</text>` : "";
    const llena = `<circle class="disco" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}"${relleno ? ` style="fill:${relleno}"` : ""}/>` +
      `<circle class="aro" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r * 0.74)}"/>${glifo}`;
    if (frac >= 0.995) return `<g class="mon ${clase || ""}">${llena}</g>`;
    const id = "clip-m" + ++nClip;
    return `<g class="mon ${clase || ""}"><clipPath id="${id}"><rect x="${f1(cx - r)}" y="${f1(cy - r)}" width="${f1(2 * r * frac)}" height="${f1(2 * r)}"/></clipPath>` +
      `<circle class="hueco" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}"/><g clip-path="url(#${id})">${llena}</g></g>`;
  }
  function filaMonedas(valor, paso, r, relleno) {
    const n = Math.ceil(valor - 1e-9);
    let s = "";
    for (let i = 0; i < n; i++) s += moneda(paso / 2 + i * paso, paso / 2, r, Math.min(1, valor - i), relleno);
    return s;
  }
  const ICONO_MONEDA = `<svg viewBox="0 0 20 20" aria-hidden="true">${moneda(10, 10, 9, 1, "var(--tinta-2)")}</svg>`;

  // ---------------- Primera pantalla: la cifra ----------------
  $("cifra").innerHTML = `${C.fmtEur.format(porPersona)}<span class="ud">${NB}€</span>`;
  $("pastillas").innerHTML = `<li class="pastilla"><b>${eur2(porPersona / 12)}</b> al mes</li>` +
    `<li class="pastilla">unos <b>${Math.round((porPersona / 365) * 100)} céntimos</b> al día</li>`;
  $("aclaracion").innerHTML = `Son ${millE(total)} en ${datos.anyo}, repartidos entre los ${C.fmtM.format(pob / 1e6)} millones de habitantes, niños incluidos. ` +
    `Sueldos brutos, sin dietas ni cotizaciones sociales. <a href="#fuentes">Ver fuentes</a>`;

  // ---------------- A dónde va: los 27,68 € en monedas, por nivel ----------------
  const fr = fraccion(tLocal / total);
  $("t-reparto").textContent = fr ? `${fr} euros van a ayuntamientos y diputaciones` : `El ${pct(tLocal / total)} va a ayuntamientos y diputaciones`;
  $("nota-monedas").innerHTML = `${ICONO_MONEDA}<span>Los ${eur2(porPersona)} de cada persona, en monedas de 1${NB}€</span>`;
  // Qué es presupuesto y qué es gasto real en cada nivel (sale de los datos)
  const bases = new Set(CC.map((c) => c.base));
  {
    const piezas = [["ayuntamientos", "gasto real"], ...est.base.split(" · ").map((t) => t.split(": ")).map(([q, b]) => [q === "Gobierno" ? "Gobierno de España" : q, b])];
    const grupos = d3.groups(piezas, (p) => p[1]).map(([b, ps]) => `${b.charAt(0).toUpperCase() + b.slice(1)}: ${lista(ps.map((p) => p[0]))}.`);
    const aut = bases.size > 1 ? "Comunidades: según cada una (lo dice su ficha)." : `Comunidades: ${BASE_TXT[[...bases][0]]}.`;
    $("nota-base").textContent = [...grupos, aut].join(" ");
  }
  function pintarNiveles() {
    const cont = $("niveles");
    const W = Math.max(240, ancho(cont, 360));
    const maxMon = Math.max(...NIVELES.map((n) => Math.ceil(n.v / pob)));
    const paso = Math.min(26, W / maxMon);
    const r = paso * 0.43;
    cont.innerHTML = NIVELES.map((n, i) => {
      const pp = n.v / pob;
      return `<div class="nivel" data-i="${i}">
        <div class="nivel-cab"><i class="mu" style="background:var(${n.color})"></i><span class="nivel-nom">${n.nombre}</span><b class="nivel-val">${eur2(pp)}</b></div>
        <svg viewBox="0 0 ${f1(W)} ${f1(paso)}" role="img" aria-label="${n.nombre} (${minus(n.det)}): ${eur2(pp)} por persona, ${pct(n.v / total)} del total">${filaMonedas(pp, paso, r, `var(${n.color})`)}</svg>
        <div class="nivel-det"><b>${pct(n.v / total)}</b> del total · ${millE(n.v)}</div>
      </div>`;
    }).join("");
    cont.querySelectorAll(".nivel").forEach((el) => {
      const n = NIVELES[+el.dataset.i];
      tipEn(el, () => `<b>${eur2(n.v / pob)} por persona</b>${n.nombre}: ${minus(n.det)}<br><span class="t2">${millE(n.v)} al año · ${n.base}</span>`);
    });
  }

  // ---------------- 3 de cada 10 euros, para asesores ----------------
  (function pintarAsesores() {
    const p = asesores / total;
    const diez = Math.round(p * 10);
    const exacto = Math.abs(p * 10 - diez) < 0.2;
    let s = "";
    for (let i = 0; i < 10; i++) s += moneda(13 + i * 29, 13, 12, 1, null, i < diez ? "tinta" : "gris");
    $("asesores").innerHTML = `<svg viewBox="0 0 290 26" role="img" aria-label="${exacto ? `${diez} de cada 10 euros` : pct(p)} son sueldos de asesores">${s}</svg>
      <div><h2>${exacto ? `${diez} de cada 10 euros son` : `El ${pct(p)} es`} para asesores de confianza</h2>
      <p>Son personas que cada cargo elige libremente, sin oposición: ${millE(asesores)} al año.
      <span class="t2">${exacto ? `Los otros ${10 - diez}` : "El resto"}, para los propios cargos: presidentes, ministros, consejeros, parlamentarios, alcaldes y concejales.</span></p></div>`;
  })();

  // ---------------- Mapa por comunidades ----------------
  const filas = CC.map((c) => {
    const n = C.nucleoComunidad(c);
    return { c, id: c.id, total: n, porHab: n / c.poblacion, local: local(c) / c.poblacion, aut: autonomico(c) / c.poblacion };
  }).sort((a, b) => b.porHab - a.porHab);
  filas.forEach((f, i) => (f.puesto = i + 1));
  const porId = new Map(filas.map((f) => [f.id, f]));
  const media = suma(C.nucleoComunidad) / suma((c) => c.poblacion);
  const mediaLocal = tLocal / suma((c) => c.poblacion), mediaAut = tAut / suma((c) => c.poblacion);
  filas.forEach((f) => (f.dif = f.porHab / media - 1));
  const maxF = filas[0], minF = filas[filas.length - 1];
  const NOMBRE_CORTO = { "Comunidad de Madrid": "Madrid", "Comunitat Valenciana": "C. Valenciana", "Región de Murcia": "Murcia", "Castilla-La Mancha": "Castilla-La Mancha" };
  const corto = (n) => NOMBRE_CORTO[n] || n;

  $("t-mapa").textContent = `Según dónde vivas, de ${eur2(minF.porHab)} a ${eur2(maxF.porHab)} por habitante`;
  $("s-mapa").textContent = `Lo que cuestan el gobierno, el parlamento y los ayuntamientos de cada comunidad, por habitante y año. ` +
    `Aparte, ${eur2(tEst / pob)} del Gobierno de España y las Cortes, iguales para todos.`;

  // Tramos redondos (cada 5 €) calculados a partir de los datos
  const [vmin, vmax] = d3.extent(filas, (f) => f.porHab);
  const marcas = d3.ticks(vmin, vmax, 5);
  const pasoT = marcas[1] - marcas[0];
  let umbrales = marcas.filter((t) => t > vmin + pasoT / 2 && t < vmax);
  if (umbrales.length < 3 || umbrales.length > 5) umbrales = d3.scaleQuantile().domain(filas.map((f) => f.porHab)).range([0, 1, 2, 3, 4]).quantiles();
  const COLORES = umbrales.length === 4 ? [1, 2, 3, 4, 5] : umbrales.length === 3 ? [1, 2, 4, 5] : [1, 2, 3, 4, 5, 5];
  const escala = d3.scaleThreshold().domain(umbrales).range(COLORES.map((k) => `var(--seq-${k})`));

  const svg = d3.select("#mapa-es");
  const regiones = topojson.feature(topo, topo.objects.autonomous_regions).features.filter((f) => f.id !== "20");
  const coleccion = { type: "FeatureCollection", features: regiones };
  // La proyección compuesta no tiene fitWidth: se ajusta a un alto holgado y se recorta con el viewBox
  const proy = d3.geoConicConformalSpain().fitSize([640, 2560], coleccion);
  const ruta = d3.geoPath(proy);
  // Canarias se coloca en el mar, al sureste de la península, dentro de un recuadro cerrado
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
  capa.selectAll("path.region").data(regiones).join("path").attr("class", "region").attr("d", ruta)
    .attr("transform", (g) => (g.id === "05" ? `translate(${tx},${ty}) scale(${sC})` : null));
  const puntos = capa.selectAll("circle.region").data(regiones.filter((g) => PEQUENAS.has(g.id))).join("circle")
    .attr("class", "region").attr("cx", (g) => centroide(g)[0]).attr("cy", (g) => centroide(g)[1]);
  const etiquetas = svg.append("g");
  // Unidades del viewBox por píxel en pantalla: textos y puntos mantienen su tamaño en móvil
  const escalaMapa = () => VB.w / Math.max(200, svg.node().getBoundingClientRect().width || VB.w);
  const todas = capa.selectAll(".region");
  const tipComunidad = (f) => `<b>${esc(f.c.nombre)}${f.c.faltan.length ? " *" : ""}</b>${eur2(f.porHab)} por habitante<br>` +
    `<span class="t2">${f.dif >= 0 ? "▲" : "▼"} ${masMenos(f.dif)} que la media · puesto ${f.puesto} de ${filas.length}</span>`;
  todas.filter((g) => porId.has(g.id))
    .attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", (g) => `${porId.get(g.id).c.nombre}: ${eur2(porId.get(g.id).porHab)} por habitante`)
    .style("fill", (g) => escala(porId.get(g.id).porHab))
    .on("pointermove", (ev, g) => { if (ev.pointerType === "mouse") C.tip(ev, tipComunidad(porId.get(g.id))); })
    .on("pointerleave", C.ocultarTip)
    .on("click", (ev, g) => { C.ocultarTip(); seleccionar(g.id, "mapa"); })
    .on("keydown", (ev, g) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); seleccionar(g.id, "mapa"); } });
  todas.filter((g) => !porId.has(g.id)).style("fill", "var(--rejilla)");
  puntos.raise();

  // Etiquetas directas: la más cara y la más barata, o la elegida. Ceuta y Melilla, siempre con su nombre.
  const AJUSTE = { "13": [0, 2] };
  function pintarEtiquetas() {
    const k = escalaMapa();
    puntos.attr("r", 7 * k);
    const elegidas = sel ? [porId.get(sel)] : [maxF, minF];
    etiquetas.selectAll("*").remove();
    regiones.filter((g) => PEQUENAS.has(g.id) && porId.has(g.id) && !elegidas.some((f) => f.id === g.id)).forEach((g) => {
      const [x, y] = centroide(g);
      const izq = g.id === "19"; // Melilla a la izquierda: no toca el recuadro de Canarias
      etiquetas.append("text").attr("class", "etq-peq").attr("x", x + (izq ? -11 : 11) * k).attr("y", y + 4 * k)
        .attr("text-anchor", izq ? "end" : "start")
        .style("font-size", 12 * k + "px").style("stroke-width", 3 * k + "px").text(porId.get(g.id).c.nombre);
    });
    elegidas.forEach((f) => {
      const g = regiones.find((r) => r.id === f.id);
      let [x, y] = centroide(g);
      const d = AJUSTE[f.id] || [0, 0];
      x += d[0] * k; y += d[1] * k;
      if (PEQUENAS.has(f.id)) y -= 26 * k;
      const t = etiquetas.append("text").attr("class", "etq").attr("x", x).attr("y", y - 4 * k).style("stroke-width", 4 * k + "px");
      t.append("tspan").attr("class", "n").attr("x", x).style("font-size", 12.5 * k + "px").text(corto(f.c.nombre));
      t.append("tspan").attr("class", "v").attr("x", x).attr("dy", 16 * k).style("font-size", 15 * k + "px").text(eur2(f.porHab));
    });
  }

  // Leyenda del mapa: tramos y la marca de la media, con su rótulo pegado
  (function pintarLeyenda() {
    const bordes = [vmin, ...umbrales, vmax];
    const n = bordes.length - 1;
    const pos = (v) => {
      const i = Math.max(0, Math.min(n - 1, d3.bisectRight(umbrales, v)));
      return ((i + (v - bordes[i]) / (bordes[i + 1] - bordes[i])) / n) * 100;
    };
    const pm = pos(media);
    $("leyenda-mapa").innerHTML = `<span class="fin">Menos</span>
      <div class="escala">
        <span class="media-et" style="left:${Math.max(18, Math.min(82, pm))}%">Media ${eur2(media)}</span>
        <div class="tramos">${escala.range().slice(0, n).map((c) => `<i style="background:${c}"></i>`).join("")}</div>
        <span class="marca-media" style="left:${pm}%"></span>
        ${umbrales.map((u, i) => `<span class="corte" style="left:${((i + 1) / n) * 100}%">${ent(u)}${NB}€</span>`).join("")}
      </div>
      <span class="fin">Más</span>`;
  })();

  // ---------------- Ficha de la comunidad ----------------
  let sel = null;
  const ICONO = {
    aviso: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/></svg>`,
    info: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>`,
    mano: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5a6.5 6.5 0 0 1-6.5 6.5h-.6a6 6 0 0 1-4.6-2.2L4.6 15a1.5 1.5 0 0 1 2.3-1.9L9 15.5"/></svg>`,
    compartir: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1"/></svg>`,
  };
  const BASE = { ejecutado: "gasto real", presupuestado: "presupuesto" };
  const slug = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const porSlug = new Map(filas.map((f) => [slug(f.c.nombre), f.id]));
  const urlBase = location.href.split("#")[0];

  function tira(f) {
    const W = Math.max(220, ancho($("ficha"), 286) - 34), H = 46, m = 8;
    const x = d3.scaleLinear().domain([vmin, vmax]).range([m, W - m]);
    const otros = filas.filter((g) => g.id !== f.id).map((g) =>
      `<circle class="pt" data-id="${g.id}" cx="${f1(x(g.porHab))}" cy="22" r="4.5"><title>${esc(g.c.nombre)}: ${eur2(g.porHab)}</title></circle>`);
    return `<svg class="tira" viewBox="0 0 ${W} ${H}" role="img" aria-label="Posición entre las ${filas.length}: de ${eur2(vmin)} a ${eur2(vmax)}; media ${eur2(media)}">
      <line class="base-l" x1="${m}" x2="${W - m}" y1="22" y2="22"/>
      <line class="media" x1="${f1(x(media))}" x2="${f1(x(media))}" y1="11" y2="33"/>
      <text x="${f1(x(media))}" y="8" text-anchor="middle">media</text>
      ${otros.join("")}
      <circle class="pt sel" cx="${f1(x(f.porHab))}" cy="22" r="7"><title>${esc(f.c.nombre)}: ${eur2(f.porHab)}</title></circle>
      <text x="${m}" y="${H}" text-anchor="start">${eur2(vmin)}</text>
      <text x="${W - m}" y="${H}" text-anchor="end">${eur2(vmax)}</text>
    </svg>`;
  }

  // Tu comunidad frente a la media, en barras apiladas a la misma escala
  function comparacion(f) {
    const fila = (nom, l, a, tot, yo) => `<div class="cmp-fila${yo ? " yo" : ""}"><span class="cmp-nom">${esc(nom)}</span><b>${eur2(tot)}</b>
      <div class="cmp-pista"><div class="cmp-barra" style="width:${((tot / vmax) * 100).toFixed(1)}%">
        ${l > 0 ? `<i style="flex:${l} 1 0px;background:var(--niv-local)"></i>` : ""}<i style="flex:${a} 1 0px;background:var(--niv-aut)"></i>
      </div></div></div>`;
    return `<div class="cmp" role="img" aria-label="${esc(f.c.nombre)}: ${eur2(f.porHab)}; media de las comunidades: ${eur2(media)}">
      ${fila(f.c.nombre, f.local, f.aut, f.porHab, true)}${fila("Media de las comunidades", mediaLocal, mediaAut, media, false)}</div>`;
  }

  // Desglose línea a línea, con lo que es presupuesto y lo que es gasto real
  function recibo(f) {
    const c = f.c, l = c.partes.local;
    const ph = (v) => eur2(v / c.poblacion);
    const baseAut = BASE[c.base] || c.base;
    const grupos = [];
    if (l) grupos.push({ nom: "Ayuntamientos y diputaciones", color: "--niv-local", base: "Gasto real", v: local(c),
      det: [["Alcaldes y concejales", l.electos], ["Asesores de los ayuntamientos", l.eventual], ["Diputaciones, cabildos, consejos insulares y otras entidades locales", l.diputaciones]] });
    grupos.push({ nom: l ? "Gobierno autonómico" : "Gobierno y Asamblea de la ciudad", color: "--niv-aut", base: baseAut.charAt(0).toUpperCase() + baseAut.slice(1), v: parte(c, "gobierno").altos + parte(c, "gobierno").eventual,
      det: [["Presidencia, consejeros y altos cargos", parte(c, "gobierno").altos], ["Asesores de confianza", parte(c, "gobierno").eventual]] });
    if (c.partes.parlamento || c.faltan.length) grupos.push({ nom: "Parlamento autonómico", color: "--niv-aut", base: baseAut.charAt(0).toUpperCase() + baseAut.slice(1),
      v: parte(c, "parlamento").altos + parte(c, "parlamento").eventual, sinDatos: !c.partes.parlamento,
      det: [["Diputados y cargos del parlamento", parte(c, "parlamento").altos], ["Asesores del parlamento", parte(c, "parlamento").eventual]] });
    const filasR = grupos.map((g) => `<tr class="grupo"><td><i class="mu" style="background:var(${g.color})"></i>${g.nom}<small>${g.base}</small></td>` +
      `<td class="num">${g.sinDatos ? "sin datos" : ph(g.v)}</td></tr>` +
      (g.sinDatos ? "" : g.det.filter((d) => d[1] > 0).map((d) => `<tr class="det"><td>${d[0]}</td><td class="num">${ph(d[1])}</td></tr>`).join(""))).join("");
    const fuentes = [...c.fuentes.map(enlace), ...(l ? datos.fuentes_local.map(enlaceOrg) : [])];
    return `<details><summary>Ver el desglose y las fuentes</summary>
      <table class="recibo"><tbody>${filasR}<tr class="total"><td>Total por habitante</td><td class="num">${eur2(f.porHab)}</td></tr></tbody></table>
      <p class="recibo-fuentes">Fuentes: ${fuentes.join(" · ")}. Población: ${enlace({ url: datos.poblacion.url, texto: datos.poblacion.fuente })}.</p>
    </details>`;
  }

  function botonCompartir() {
    return `<button type="button" class="boton" id="compartir">${ICONO.compartir}<span>Compartir</span></button>`;
  }
  // Qué entra en la cifra de cada comunidad (Ceuta y Melilla no tienen parlamento ni ayuntamientos aparte)
  const incluye = (f) => (f.local > 0 ? "su gobierno, su parlamento y sus ayuntamientos" : "su gobierno y su Asamblea");
  function textoCompartir(f) {
    const pie = `(${datos.anyo}; sueldos brutos, sin dietas ni cotizaciones)`;
    return f
      ? `En ${f.c.nombre}, los sueldos de los políticos de ${incluye(f)}, y de sus asesores, cuestan ${eur2(f.porHab)} por habitante y año. La media de las comunidades es ${eur2(media)} ${pie}. Datos y fuentes:`
      : `Los sueldos de los políticos y de sus asesores cuestan ${eur2(porPersona)} al año a cada persona en España: ${millE(total)} en total ${pie}. Datos y fuentes:`;
  }

  function pintarFicha() {
    const caja = $("ficha");
    const f = sel && porId.get(sel);
    if (!f) {
      caja.innerHTML = `
        <div class="pista-toque">${ICONO.mano}<span>Toca tu comunidad en el mapa o elígela arriba para ver su cifra</span></div>
        <div class="extremos">
          ${[[maxF, "La más cara"], [minF, "La más barata"]].map(([x, t]) => `<button type="button" class="extremo" data-id="${x.id}">
            <span>${t}</span><b>${esc(x.c.nombre)}</b><strong>${eur2(x.porHab)}</strong></button>`).join("")}
        </div>
        <div class="cuentas" aria-label="Cómo se llega a ${eur2(porPersona)}">
          <div><span>Media de las comunidades</span><b>${eur2(media)}</b></div>
          <div><span>+ Gobierno de España y Cortes, igual para todos</span><b>${eur2(tEst / pob)}</b></div>
          <div class="suma"><span>= Coste por persona en España</span><b>${eur2(porPersona)}</b></div>
        </div>
        <div class="acciones">${botonCompartir()}</div>`;
      caja.querySelectorAll(".extremo").forEach((b) => b.addEventListener("click", () => seleccionar(b.dataset.id, "ficha")));
    } else {
      const c = f.c;
      const n = filas.length;
      const puesto = f.puesto === 1 ? `La más cara por habitante de las ${n}` : f.puesto === n ? `La más barata por habitante de las ${n}` : `Puesto ${f.puesto} de ${n}, de más cara a más barata`;
      const notas = [
        ...c.faltan.map((t) => ["aviso", `Sin datos: ${t}`]),
        ...c.avisos.map((t) => ["aviso", t]),
        ...c.notas.map((t) => ["info", t]),
      ];
      const faltaAlgo = c.faltan.length || c.avisos.length;
      caja.innerHTML = `
        <h3>${esc(c.nombre)}</h3>
        <div class="puesto">${puesto}</div>
        <div class="grande">${eur2(f.porHab)}<small>por habitante y año: ${f.local > 0 ? "gobierno, parlamento y ayuntamientos" : "gobierno y Asamblea de la ciudad"}</small></div>
        <div class="comp"><b>${f.dif >= 0 ? "▲" : "▼"} ${masMenos(f.dif)}</b> que la media de las comunidades (${eur2(media)})</div>
        ${tira(f)}
        <p class="sub-t">Frente a la media</p>
        ${comparacion(f)}
        <div class="filas">
          ${f.local > 0 ? `<div><i style="background:var(--niv-local)"></i><span>Ayuntamientos y diputaciones</span><span>${eur2(f.local)}</span></div>` : ""}
          <div><i style="background:var(--niv-aut)"></i><span>${f.local > 0 ? "Gobierno y parlamento autonómicos" : "Gobierno y Asamblea de la ciudad"}</span><span>${eur2(f.aut)}</span></div>
        </div>
        <p class="mas-estado">A esto se suman <b>${eur2(tEst / pob)}</b> por habitante del Gobierno de España y las Cortes, iguales en toda España.</p>
        ${notas.map(([k, t]) => `<div class="nota${k === "aviso" ? " aviso" : ""}">${ICONO[k]}<span>${esc(t)}</span></div>`).join("")}
        ${faltaAlgo ? `<div class="nota">${ICONO.info}<span>Por los datos que faltan, la cifra real es algo mayor.</span></div>` : ""}
        <div class="etiquetas"><span class="etiqueta">Datos autonómicos: ${BASE[c.base] || esc(c.base)}</span>${f.local > 0 ? `<span class="etiqueta">Ayuntamientos: gasto real</span>` : ""}</div>
        ${recibo(f)}
        <div class="acciones">${botonCompartir()}<a href="comunidades.html#c=${c.id}">Más sobre las comunidades <span aria-hidden="true">→</span></a>
          <button class="cerrar" type="button">Ver toda España</button></div>`;
      caja.querySelector(".cerrar").addEventListener("click", () => seleccionar(null, "cerrar"));
      caja.querySelectorAll(".tira .pt[data-id]").forEach((p) => p.addEventListener("click", () => seleccionar(p.dataset.id, "ficha")));
    }
    $("compartir").addEventListener("click", (ev) => {
      const url = f ? urlBase + "#" + slug(f.c.nombre) : urlBase;
      C.compartir(ev.currentTarget.querySelector("span"), textoCompartir(f), url);
    });
  }

  // ---------------- Lista (lo mismo que el mapa, sin depender del color) ----------------
  function pintarLista() {
    $("lista").innerHTML = filas.map((f) => `<button type="button" class="fila-lista${f.id === sel ? " sel" : ""}" data-id="${f.id}">
      <span class="nom">${esc(f.c.nombre)}${f.c.faltan.length ? " *" : ""}</span>
      <span class="pista-b"><i style="width:${((f.porHab / maxF.porHab) * 100).toFixed(1)}%;background:${escala(f.porHab)}"></i></span>
      <span class="v">${eur2(f.porHab)}</span></button>`).join("") +
      (filas.some((f) => f.c.faltan.length) ? `<p class="lista-nota">* Sin datos de su parlamento: la cifra real es algo mayor.</p>` : "");
    $("lista").querySelectorAll(".fila-lista").forEach((b) => b.addEventListener("click", () => seleccionar(b.dataset.id, "lista")));
  }

  const elige = $("elige");
  elige.innerHTML = `<option value="">Elige tu comunidad</option>` +
    [...filas].sort((a, b) => a.c.nombre.localeCompare(b.c.nombre, "es")).map((f) => `<option value="${f.id}">${esc(f.c.nombre)}</option>`).join("");
  elige.addEventListener("change", () => seleccionar(elige.value || null, "selector"));

  function seleccionar(id, origen) {
    sel = id && porId.has(id) ? id : null;
    elige.value = sel || "";
    svg.classed("con-sel", !!sel);
    todas.classed("sel", (g) => g.id === sel);
    if (sel) todas.filter((g) => g.id === sel).raise();
    puntos.raise();
    if (origen !== "inicio") {
      guardar("cp-comunidad", sel);
      try { history.replaceState(null, "", sel ? "#" + slug(porId.get(sel).c.nombre) : location.pathname + location.search); } catch (e) { /* nada */ }
    }
    ambito = sel ? "ccaa" : "es";
    pintarEtiquetas();
    pintarFicha();
    pintarLista();
    pintarCalc();
    pintarBarraTu();
    if (origen === "mapa" && window.matchMedia("(max-width: 720px)").matches) {
      const r = $("ficha").getBoundingClientRect();
      if (r.top > window.innerHeight * 0.7) $("ficha").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }
  }

  // ---------------- Barra fija: no perder la referencia al bajar ----------------
  const barraTu = $("barra-tu");
  function pintarBarraTu() {
    const f = sel && porId.get(sel);
    $("barra-tu-txt").innerHTML = f
      ? `<b>${esc(corto(f.c.nombre))}</b>: <b>${eur2(f.porHab)}</b> por habitante<span class="solo-ancho"> · media de las comunidades ${eur2(media)}</span>`
      : `<b>${eur2(porPersona)}</b> por persona al año en España`;
    $("barra-tu-boton").textContent = f ? "Cambiar" : "Elige tu comunidad";
  }
  $("barra-tu-boton").addEventListener("click", () => {
    $("tu-comunidad").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    setTimeout(() => elige.focus({ preventScroll: true }), 350);
  });
  function vigilarBarra() {
    const altoCab = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--alto-cab")) || 56;
    const visible = $("tu-comunidad").getBoundingClientRect().bottom < altoCab;
    barraTu.classList.toggle("visible", visible);
    barraTu.toggleAttribute("inert", !visible);
  }
  let pendiente = false;
  window.addEventListener("scroll", () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; vigilarBarra(); });
  }, { passive: true });

  // ---------------- Tarjeta 1: Gobierno de España ----------------
  const serie = hist.estado.filter((r) => r.factor_ipc);
  const sinIpc = hist.estado.filter((r) => !r.factor_ipc);
  const valG = (r) => (r.gobierno_altos + r.gobierno_asesores) * r.factor_ipc;
  // Tramos según quién hizo el presupuesto: un presupuesto prorrogado sigue siendo del Gobierno que lo elaboró
  const tramos = [];
  serie.forEach((r) => {
    const t = tramos[tramos.length - 1];
    if (t && t.p === r.autor) t.rs.push(r); else tramos.push({ p: r.autor, rs: [r] });
  });
  tramos.forEach((t) => {
    t.propios = t.rs.filter((r) => !r.prorrogado);
    t.media = d3.mean(t.propios, valG);
    t.minM = d3.min(t.propios, (r) => r.ministerios);
    t.maxM = d3.max(t.propios, (r) => r.ministerios);
  });
  const ministerios = (t) => (t.minM === t.maxM ? `${t.minM}` : `${t.minM}–${t.maxM}`);
  const minMin = d3.min(hist.estado, (r) => r.ministerios), maxMin = d3.max(hist.estado, (r) => r.ministerios);
  $("fv-estado-t").textContent = `El número de ministerios cambia con cada Gobierno: entre ${minMin} y ${maxMin} desde ${hist.estado[0].anyo}`;
  $("fv-estado-s").textContent = `Lo que reservó cada presupuesto para altos cargos y asesores de los ministerios, en millones de euros de ${hist.base_ipc} (ya descontada la inflación). Cada franja, los presupuestos de un Gobierno.`;
  $("fv-estado-l").innerHTML = `<li><i style="background:var(--niv-est)"></i>Presupuesto nuevo</li>` +
    `<li><i class="hueca"></i>Año sin presupuesto nuevo: se repite el anterior</li>` +
    `<li><i class="linea"></i>Media de cada Gobierno, sin los años repetidos</li>`;
  const cruzados = serie.filter((r) => r.gobierna !== r.autor);
  const cruce = cruzados.length ? ` De ${cruzados[0].anyo} a ${cruzados[cruzados.length - 1].anyo} gobernaba ${esc(apellido(cruzados[0].gobierna))} con el presupuesto de ${esc(apellido(cruzados[0].autor))}.` : "";
  const notaSinIpc = sinIpc.length ? ` ${lista(sinIpc.map((r) => r.anyo))} no sale porque aún no hay dato de inflación${sinIpc[0].prorrogado ? ` (sigue el presupuesto de ${sinIpc[0].prorrogado})` : ""}.` : "";
  $("fv-estado-n").innerHTML = `Es lo presupuestado cada año, no lo gastado.${cruce}${notaSinIpc}`;
  $("fv-estado-f").innerHTML = `Fuente: ${[hist.fuentes[0], hist.fuentes[hist.fuentes.length - 1]].map(enlace).join(" · ")}`;
  $("g-estado").setAttribute("aria-label", `Altos cargos y asesores de los ministerios, media al año en millones de euros de ${hist.base_ipc}: ` +
    lista(tramos.map((t) => `${mEje(t.media)} con los presupuestos de ${apellido(t.p)} (${ministerios(t)} ministerios)`)) + ".");
  $("fv-estado-tabla").innerHTML = `<table class="tabla"><thead><tr><th>Año</th><th class="num">Millones de € de ${hist.base_ipc}</th><th class="num">De ellos, asesores</th><th class="num">Ministerios</th><th>Presupuesto</th></tr></thead><tbody>` +
    hist.estado.map((r) => `<tr><td>${r.anyo}</td>
      <td class="num">${r.factor_ipc ? C.fmtM.format(valG(r) / 1e6) : "sin dato de inflación"}</td>
      <td class="num">${r.factor_ipc ? C.fmtM.format((r.gobierno_asesores * r.factor_ipc) / 1e6) : "—"}</td>
      <td class="num">${r.ministerios}</td>
      <td>${r.prorrogado ? `de ${r.prorrogado}, prorrogado` : `de ${esc(apellido(r.autor))}`}${r.gobierna !== r.autor ? ` (gobernaba ${esc(apellido(r.gobierna))})` : ""}</td></tr>`).join("") + `</tbody></table>`;

  function graficoEstado() {
    const s = d3.select("#g-estado");
    const W = Math.max(280, ancho(s.node(), 540));
    const movil = W < 460;
    const H = movil ? 236 : 266;
    const m = { t: movil ? 46 : 62, r: 4, b: 24, l: 26 };
    s.attr("viewBox", `0 0 ${W} ${H}`).selectAll("*").remove();
    const x = d3.scaleBand().domain(serie.map((r) => r.anyo)).range([m.l, W - m.r]).paddingInner(0.28).paddingOuter(0.12);
    const y = d3.scaleLinear().domain([0, d3.max(serie, valG) * 1.06]).nice().range([H - m.b, m.t]);
    const bw = Math.min(24, x.bandwidth()), off = (x.bandwidth() - bw) / 2, paso = x.step();
    const gap = (paso - x.bandwidth()) / 2;
    // Franjas por presupuesto de cada Gobierno, tratadas igual
    tramos.forEach((t, i) => {
      const x0 = x(t.rs[0].anyo) - gap, x1 = x(t.rs[t.rs.length - 1].anyo) + x.bandwidth() + gap;
      if (i % 2 === 0) s.append("rect").attr("class", "banda").attr("x", x0).attr("width", x1 - x0).attr("y", 0).attr("height", H - m.b).attr("rx", 6);
      const cx = (x0 + x1) / 2;
      s.append("text").attr("class", "banda-n").attr("x", cx).attr("y", 16).attr("text-anchor", "middle").text(apellido(t.p));
      s.append("text").attr("x", cx).attr("y", 31).attr("text-anchor", "middle").text(movil ? `media ${mEje(t.media)}` : `media: ${mEje(t.media)} millones`);
      if (!movil) s.append("text").attr("x", cx).attr("y", 46).attr("text-anchor", "middle").text(`${ministerios(t)} ministerios`);
    });
    const ticks = y.ticks(3);
    s.append("g").selectAll("line").data(ticks.filter((t) => t > 0)).join("line").attr("class", "rejilla-l")
      .attr("x1", m.l).attr("x2", W - m.r).attr("y1", (t) => y(t)).attr("y2", (t) => y(t));
    s.append("g").selectAll("text").data(ticks).join("text").attr("class", "eje-t")
      .attr("x", m.l - 5).attr("y", (t) => y(t) + 4).attr("text-anchor", "end").text((t) => mEje(t));
    s.append("line").attr("class", "base-l").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(0)).attr("y2", y(0));
    const col = s.append("g");
    serie.forEach((r) => {
      const xx = x(r.anyo) + off, yy = y(valG(r)), h = y(0) - yy, rr = Math.min(4, h, bw / 2);
      const p = col.append("path").attr("class", "barra")
        .attr("d", `M${xx},${yy + h}V${yy + rr}Q${xx},${yy} ${xx + rr},${yy}H${xx + bw - rr}Q${xx + bw},${yy} ${xx + bw},${yy + rr}V${yy + h}Z`);
      // Año prorrogado: barra hueca (borde del mismo color), sin texturas
      if (r.prorrogado) p.style("fill", "color-mix(in srgb, var(--niv-est) 22%, var(--superficie))").style("stroke", "var(--niv-est)").style("stroke-width", 1.5);
      else p.style("fill", "var(--niv-est)");
    });
    // Media de cada Gobierno sobre sus presupuestos propios
    tramos.forEach((t) => {
      const a = t.propios[0], b = t.propios[t.propios.length - 1];
      s.append("line").attr("class", "media-l").attr("x1", x(a.anyo) - 2).attr("x2", x(b.anyo) + x.bandwidth() + 2).attr("y1", y(t.media)).attr("y2", y(t.media));
    });
    const ult = serie[serie.length - 1].anyo;
    const rotulos = serie.map((r) => r.anyo).filter((a) => a === serie[0].anyo || a === ult || (a % 5 === 0 && ult - a >= (movil ? 3 : 2) && a - serie[0].anyo >= 2));
    s.append("g").selectAll("text").data(rotulos).join("text").attr("class", "eje-t")
      .attr("x", (a) => x(a) + x.bandwidth() / 2).attr("y", H - 6).attr("text-anchor", "middle").text((a) => a);
    serie.forEach((r) => {
      const g = s.append("rect").attr("class", "golpe").attr("x", x(r.anyo) - gap).attr("width", paso).attr("y", m.t - 10).attr("height", H - m.b - m.t + 10).node();
      tipEn(g, () => `<b>${r.anyo} · ${C.fmtM.format(valG(r) / 1e6)} millones</b>` +
        `Altos cargos: ${C.fmtM.format((r.gobierno_altos * r.factor_ipc) / 1e6)} · asesores: ${C.fmtM.format((r.gobierno_asesores * r.factor_ipc) / 1e6)}<br>` +
        `<span class="t2">${r.ministerios} ministerios · ${r.prorrogado ? `presupuesto de ${r.prorrogado} prorrogado` : `presupuesto del Gobierno de ${esc(apellido(r.autor))}`}` +
        `${r.gobierna !== r.autor ? ` · gobernaba ${esc(apellido(r.gobierna))}` : ""} · euros de ${hist.base_ipc}</span>`);
    });
  }

  // ---------------- Tarjeta 2: Cuánto cobran ----------------
  const D = hist.sueldos.detalle;
  const presi = D.cargos.find((c) => c.cargo === "Presidente del Gobierno");
  const masQue = D.cargos.filter((c) => c.anual > presi.anual);
  const maestro = D.referencias.funcionario_A2_22;
  $("fv-sueldos-t").textContent = `${masQue.length} cargos del Estado cobran más que el presidente del Gobierno`;
  $("fv-sueldos-s").textContent = `Sueldos brutos al año fijados por la ley para ${D.anyo}, la última con esta tabla. Cada punto, un cargo. El que más cobra es el ${minus(masQue[0].cargo)}.`;
  $("fv-sueldos-l").innerHTML = `<li><i class="circulo" style="background:var(--acento)"></i>Cobran más que el presidente</li>` +
    `<li><i class="circulo" style="background:var(--gris-dato)"></i>Vicepresidente, ministros y otros altos cargos</li>`;
  $("fv-sueldos-lt").textContent = `Ver los ${D.cargos.length} sueldos como lista`;
  $("fv-sueldos-tabla").innerHTML = `<table class="tabla"><tbody>` +
    D.cargos.map((c) => `<tr class="${c === presi ? "ref" : ""}${c === D.cargos[masQue.length] ? " corte" : ""}"><td>${esc(c.cargo)}</td><td class="num">${eur(c.anual)}</td></tr>`).join("") +
    `<tr class="corte"><td>${esc(maestro.texto)}: sueldo básico</td><td class="num">${eur(maestro.anual)}</td></tr></tbody></table>`;
  $("g-sueldos").setAttribute("aria-label", `${masQue.length} cargos del Estado cobran más que el presidente del Gobierno (${eur(presi.anual)}); el que más, ${eur(masQue[0].anual)}. ` +
    `El sueldo básico de un maestro o enfermero es ${eur(maestro.anual)}.`);

  function graficoSueldos(extra = 0) {
    const s = d3.select("#g-sueldos");
    const W = Math.max(280, ancho(s.node(), 540));
    const movil = W < 460;
    const r = movil ? 5.5 : 7;
    const m = { l: 6, r: 12 };
    const x = d3.scaleLinear().domain([0, masQue[0].anual * 1.02]).range([m.l + r, W - m.r]);
    const puntos = [
      ...D.cargos.map((c) => ({ c, v: c.anual, tipo: c === presi ? "presi" : c.anual > presi.anual ? "mas" : "menos" })),
      { c: { cargo: "Maestro o enfermero (sueldo básico)", grupo: maestro.texto }, v: maestro.anual, tipo: "ref" },
    ].sort((a, b) => a.v - b.v);
    // Apilar los puntos que se tocan
    const colocados = [];
    puntos.forEach((p) => {
      const rr = p.tipo === "presi" ? r + 2 : r;
      let nivel = 0;
      while (colocados.some((q) => q.nivel === nivel && Math.abs(x(q.v) - x(p.v)) < rr + q.rr + 1.5)) nivel++;
      colocados.push({ ...p, nivel, rr });
    });
    const paso = 2 * r + 2;
    const maxNivel = d3.max(colocados, (p) => p.nivel);
    const arriba = 40 + extra;
    const y0 = arriba + 26 + (maxNivel + 1) * paso;
    const H = y0 + 26;
    s.attr("viewBox", `0 0 ${W} ${H}`).selectAll("*").remove();
    const xp = x(presi.anual);
    s.append("rect").attr("class", "zona").attr("x", xp).attr("y", 2).attr("width", W - xp).attr("height", y0 - 2).attr("rx", 6);
    s.append("line").attr("class", "ref-l").attr("x1", xp).attr("x2", xp).attr("y1", 2).attr("y2", y0);
    const t1 = s.append("text").attr("x", xp - 8).attr("y", 18).attr("text-anchor", "end");
    t1.append("tspan").attr("class", "fuerte").text("Presidente del Gobierno");
    t1.append("tspan").attr("x", xp - 8).attr("dy", 16).text(eur(presi.anual));
    const t2 = s.append("text").attr("x", xp + 8).attr("y", 18).attr("text-anchor", "start");
    t2.append("tspan").attr("class", "fuerte").text(`${masQue.length} cobran más`);
    t2.append("tspan").attr("x", xp + 8).attr("dy", 16).text(`hasta ${eur(masQue[0].anual)}`);
    // Eje con pocas marcas: los valores clave van rotulados
    s.append("line").attr("class", "base-l").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y0 + 1).attr("y2", y0 + 1);
    const ticks = movil ? [0, 50000, 100000, 150000] : [0, 25000, 50000, 75000, 100000, 125000, 150000];
    s.append("g").selectAll("text").data(ticks).join("text").attr("class", "eje-t")
      .attr("x", (t) => x(t)).attr("y", y0 + 18).attr("text-anchor", (t) => (t === 0 ? "start" : "middle"))
      .text((t) => (t === 0 ? "0 €" : (movil ? ent(t / 1000) + " mil €" : ent(t) + " €")));
    const COLOR = { presi: "var(--tinta)", mas: "var(--acento)", menos: "var(--gris-dato)", ref: "var(--tinta-2)" };
    colocados.forEach((p) => {
      const cy = y0 - p.rr - 1 - p.nivel * paso;
      p.cy = cy;
      const g = s.append("g");
      const punto = p.tipo === "ref"
        ? g.append("rect").attr("class", "dot").attr("x", x(p.v) - r).attr("y", cy - r).attr("width", 2 * r).attr("height", 2 * r).attr("transform", `rotate(45 ${x(p.v)} ${cy})`)
        : g.append("circle").attr("class", "dot").attr("cx", x(p.v)).attr("cy", cy).attr("r", p.rr);
      punto.style("fill", COLOR[p.tipo]);
      const hit = g.append("circle").attr("class", "golpe").attr("cx", x(p.v)).attr("cy", cy).attr("r", Math.max(12, p.rr + 5)).node();
      tipEn(hit, () => `<b>${eur(p.v)} al año</b>${esc(p.c.cargo)}<br><span class="t2">${esc(p.c.grupo)}</span>`);
      hit.addEventListener("pointerenter", () => punto.classed("hov", true));
      hit.addEventListener("pointerleave", () => punto.classed("hov", false));
    });
    // Maestro o enfermero: rotulado directamente, por encima de los puntos que tenga debajo y sin pisar el rótulo del presidente
    const ref = colocados.find((p) => p.tipo === "ref");
    let xr = x(ref.v) - r;
    const t3 = s.append("text").attr("class", "halo").attr("x", xr).attr("y", 0).attr("text-anchor", "start");
    t3.append("tspan").attr("class", "fuerte").text("Maestro o enfermero");
    t3.append("tspan").attr("x", xr).attr("dy", 15).text(`${eur(ref.v)}, sueldo básico*`);
    const w3 = t3.node().getBBox().width;
    // Si el rótulo cruzaría la línea del presidente, se corre a la izquierda (sin salirse del gráfico)
    const xr2 = Math.max(m.l, Math.min(xr, xp - 8 - w3));
    if (xr2 !== xr) { xr = xr2; t3.attr("x", xr); t3.selectAll("tspan").filter((d, i) => i === 1).attr("x", xr); }
    const debajo = colocados.filter((p) => x(p.v) + p.rr >= xr - 3 && x(p.v) - p.rr <= xr + w3 + 3);
    const techo = d3.min(debajo, (p) => p.cy - p.rr);
    const base1 = techo - 26;
    const b1 = t1.node().getBBox();
    const limite = xr + w3 > b1.x && xr < b1.x + b1.width ? b1.y + b1.height + 4 : 4;
    if (base1 - 13 < limite && extra === 0) { graficoSueldos(limite - (base1 - 13) + 2); return; }
    t3.attr("y", base1);
    s.append("line").attr("class", "ref-l").attr("x1", x(ref.v)).attr("x2", x(ref.v)).attr("y1", base1 + 20).attr("y2", ref.cy - r - 2);
  }

  // Contexto: lo que ha ganado o perdido el sueldo del presidente descontada la inflación
  function poder() {
    const sr = hist.sueldos.serie.filter((r) => r.factor_ipc && r.presidente);
    const a = sr[0], b = sr[sr.length - 1];
    const real = (r) => r.presidente * r.factor_ipc;
    const cambio = real(b) / real(a) - 1;
    const caja = $("poder");
    caja.innerHTML = `<p><span class="big">${cambio < 0 ? "−" : "+"}${pct(Math.abs(cambio))}</span>
      Lo que ha ${cambio < 0 ? "perdido" : "ganado"} el sueldo del presidente del Gobierno desde ${a.anyo}, descontada la inflación: de ${eur(real(a))} a ${eur(real(b))} en euros de ${hist.base_ipc}.</p><svg></svg>`;
    const sv = caja.querySelector("svg");
    const W = Math.max(200, ancho(sv, 260)), H = 104, m = { t: 22, r: 6, b: 18, l: 6 };
    const x = d3.scaleLinear().domain([a.anyo, b.anyo]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, real(a) * 1.05]).range([H - m.b, m.t]);
    const linea = d3.line().x((r) => x(r.anyo)).y((r) => y(real(r)))(sr);
    const area = d3.area().x((r) => x(r.anyo)).y0(H - m.b).y1((r) => y(real(r)))(sr);
    sv.setAttribute("viewBox", `0 0 ${W} ${H}`);
    sv.setAttribute("role", "img");
    sv.setAttribute("aria-label", `Sueldo del presidente del Gobierno en euros de ${hist.base_ipc}, de ${a.anyo} a ${b.anyo}: de ${eur(real(a))} a ${eur(real(b))}`);
    sv.innerHTML = `<path class="a" d="${area}"/><line class="base-l" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/><path class="l" d="${linea}"/>
      <circle class="p" cx="${x(a.anyo)}" cy="${y(real(a))}" r="4.5"/><circle class="p" cx="${x(b.anyo)}" cy="${y(real(b))}" r="4.5"/>
      <text class="f" x="${x(a.anyo)}" y="${y(real(a)) - 10}">${eur(real(a))}</text>
      <text class="f" x="${x(b.anyo)}" y="${y(real(b)) - 10}" text-anchor="end">${eur(real(b))}</text>
      <text x="${x(a.anyo)}" y="${H - 3}">${a.anyo}</text><text x="${x(b.anyo)}" y="${H - 3}" text-anchor="end">${b.anyo}</text>`;
    $("fv-sueldos-f").innerHTML = `* Solo la parte que fija el Estado: el sueldo real de un maestro o enfermero suele ser mayor. Fuente: <a href="${esc(D.url)}" target="_blank" rel="noopener">${esc(D.ley)}</a> (BOE) y leyes de presupuestos desde ${a.anyo}; inflación: ${enlace(hist.fuentes[hist.fuentes.length - 1])}.`;
  }

  // ---------------- Tarjeta 3: Ayuntamientos ----------------
  const lt = { electos: suma((c) => loc(c).electos), eventual: suma((c) => loc(c).eventual), diputaciones: suma((c) => loc(c).diputaciones) };
  const frE = fraccion(lt.electos / tLocal);
  $("fv-local-t").textContent = frE ? `En ayuntamientos y diputaciones, ${minus(frE)} euros son sueldos de alcaldes y concejales` : `En ayuntamientos y diputaciones, el ${pct(lt.electos / tLocal)} son sueldos de alcaldes y concejales`;
  $("fv-local-s").textContent = `Ayuntamientos y diputaciones: ${millE(tLocal)} en ${datos.anyo} en toda España, ${eur2(tLocal / pob)} por persona. Así se reparten:`;
  const LOCAL = [["Alcaldes y concejales", lt.electos], ["Asesores de los ayuntamientos", lt.eventual], ["Diputaciones, cabildos, consejos insulares y otras entidades locales", lt.diputaciones]];
  const maxL = d3.max(LOCAL, (d) => d[1]);
  $("g-local").innerHTML = LOCAL.map(([n, v]) => `<div class="hb">
      <div class="hb-et"><span>${n}</span><b>${mill(v)}</b></div>
      <div class="hb-pista" role="img" aria-label="${n}: ${millE(v)}"><i style="width:${((v / maxL) * 100).toFixed(1)}%"></i></div></div>`).join("");
  const conAviso = CC.filter((c) => c.avisos.length).length;
  $("fv-local-d").innerHTML = `<span class="etiqueta">Gasto real</span><span>Lo que cobraron alcaldes y concejales y lo que se pagó a los asesores.</span>` +
    (conAviso ? `<span>En ${conAviso} comunidades faltan datos de algunos municipios: la cifra real es algo mayor.</span>` : "");
  $("fv-local-f").innerHTML = `Fuente: ${datos.fuentes_local.map(enlaceOrg).join(" y ")}`;

  // ---------------- Tarjeta 4: ¿Qué se podría pagar? ----------------
  const R = D.referencias;
  const PROF = [
    { id: "a2", txt: "maestros o enfermeros", uno: "maestro o enfermero", boton: "Maestros o enfermeros", ref: R.funcionario_A2_22 },
    { id: "a1", txt: "médicos o profesores de secundaria", uno: "médico o profesor de secundaria", boton: "Médicos o profesores", ref: R.funcionario_A1_24 },
    { id: "c1", txt: "administrativos", uno: "administrativo", boton: "Administrativos", ref: R.funcionario_C1_18 },
  ];
  let prof = PROF[0];
  let ambito = "es";
  $("calc-prof").innerHTML = PROF.map((p) => `<button type="button" data-p="${p.id}" aria-pressed="${p === prof}">${p.boton}</button>`).join("");
  $("calc-prof").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    prof = PROF.find((p) => p.id === b.dataset.p);
    pintarCalc();
  });
  $("calc-donde").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    ambito = b.dataset.a;
    pintarCalc();
  });
  function pintarCalc() {
    const f = sel && porId.get(sel);
    if (!f) ambito = "es";
    $("calc-donde").hidden = !f;
    if (f) $("calc-donde").innerHTML = [["es", "Toda España"], ["ccaa", corto(f.c.nombre)]]
      .map(([a, t]) => `<button type="button" data-a="${a}" aria-pressed="${ambito === a}">${esc(t)}</button>`).join("");
    $("calc-prof").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.p === prof.id)));
    const enCcaa = f && ambito === "ccaa";
    const dinero = enCcaa ? f.total : total;
    const n = Math.floor(dinero / prof.ref.anual);
    $("fv-calc-t").textContent = enCcaa
      ? `En ${f.c.nombre}, con ese dinero se pagaría el sueldo básico de ${ent(n)} ${prof.txt}`
      : `Con todo ese dinero se pagaría el sueldo básico de ${ent(n)} ${prof.txt} durante un año`;
    $("fv-calc-s").textContent = (enCcaa ? `Los ${millE(dinero)} al año de su gobierno, su parlamento y sus ayuntamientos` : `Los ${millE(dinero)} al año`) +
      ` ÷ ${eur(prof.ref.anual)}, la retribución básica estatal de un ${prof.uno} (${D.anyo}).`;
    const POR = [10, 100, 1000, 10000].find((k) => n / k <= 120) || 10000;
    const figuras = Math.max(1, Math.round(n / POR));
    $("g-calc").innerHTML = `<svg viewBox="0 0 16 22" aria-hidden="true"><use href="#persona"/></svg>`.repeat(figuras);
    $("g-calc").setAttribute("aria-label", `${ent(n)} ${prof.txt}: ${figuras} figuras, cada una ${ent(POR)} personas`);
    $("fv-calc-d").innerHTML = `<span class="leyenda-picto"><svg viewBox="0 0 16 22" aria-hidden="true"><use href="#persona"/></svg>= ${ent(POR)} ${prof.txt}</span>` +
      `<span>Es un mínimo: el sueldo real suele ser mayor, así que serían algo menos personas.</span>`;
    $("fv-calc-f").innerHTML = `${esc(prof.ref.texto)}. ${esc(R.nota.split(":")[0])}: ${esc(R.nota.split(":").slice(1).join(":").split(" (")[0].trim())}. Fuente: <a href="${esc(D.url)}" target="_blank" rel="noopener">${esc(D.ley)} (BOE)</a>.`;
  }

  // ---------------- Pie: fecha y todas las fuentes ----------------
  $("pie-fecha").innerHTML = `Datos de ${datos.anyo}, actualizados el ${fecha(datos.generado)}. Población: ${enlace({ url: datos.poblacion.url, texto: datos.poblacion.fuente })}.`;
  $("pie-fuentes").innerHTML = `Fuentes: ${[...est.fuentes.map(enlace), ...datos.fuentes_local.map(enlaceOrg), ...hist.fuentes.map(enlace),
    `<a href="${esc(D.url)}" target="_blank" rel="noopener">${esc(D.ley)} (BOE)</a>`].join(" · ")}. Las de cada comunidad, en su ficha del mapa y en <a href="comunidades.html">Tu comunidad</a>. ` +
    `Método completo en <a href="periodistas.html#metodo">Periodistas y datos</a>.`;

  // ---------------- Dibujo inicial y al cambiar de ancho ----------------
  function dibujar() { pintarNiveles(); graficoEstado(); graficoSueldos(); poder(); pintarEtiquetas(); if (sel) pintarFicha(); }
  // Comunidad de la dirección (#extremadura o #c=11) o la última elegida en este navegador
  const h = decodeURIComponent(location.hash.slice(1));
  const desdeHash = porSlug.get(h) || (h.startsWith("c=") && porId.has(h.slice(2)) ? h.slice(2) : null);
  const previa = leer("cp-comunidad");
  dibujar();
  seleccionar(desdeHash || (previa && porId.has(previa) ? previa : null), "inicio");
  vigilarBarra();
  window.addEventListener("hashchange", () => {
    const k = decodeURIComponent(location.hash.slice(1));
    if (porSlug.has(k) && porSlug.get(k) !== sel) seleccionar(porSlug.get(k), "hash");
  });
  let espera, anchoPrevio = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === anchoPrevio) return;
    anchoPrevio = window.innerWidth;
    clearTimeout(espera);
    espera = setTimeout(dibujar, 120);
  });
})();
