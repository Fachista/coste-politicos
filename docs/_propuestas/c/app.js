// Portada «Tú y tu dinero»: empieza por la persona («¿dónde vives?») y le cuenta lo que le toca pagar.
// Todas las cifras se calculan aquí a partir de datos.json e historico.json; no hay ningún número escrito a mano.
(async function () {
  "use strict";
  const RAIZ = "../../";
  const $ = (id) => document.getElementById(id);
  const svgNS = "http://www.w3.org/2000/svg";
  const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Menú en móvil ----
  const cab = document.querySelector(".cabecera");
  const botonMenu = cab.querySelector(".menu-boton");
  botonMenu.addEventListener("click", () => {
    const abierto = cab.classList.toggle("abierta");
    botonMenu.setAttribute("aria-expanded", abierto);
  });

  const [datos, hist, topo] = await Promise.all([
    C.json(RAIZ + "datos.json"),
    C.json(RAIZ + "historico.json"),
    C.json(RAIZ + "vendor/autonomous_regions.json"),
  ]);

  // ---- Formatos ----
  const eur2 = C.eur2;
  const fmtEnt = C.fmtEnt;
  const centimos = (v) => Math.round(v * 100);
  const sinArticulo = (t) => t.charAt(0).toLowerCase() + t.slice(1);

  // ---- Las cuatro partes del recibo (orden y color fijos) ----
  const PARTES = [
    { id: "local", nombre: "Ayuntamientos y diputaciones", color: "--p-local" },
    { id: "gobierno", nombre: "Gobierno autonómico", color: "--p-gobierno" },
    { id: "parlamento", nombre: "Parlamento autonómico", color: "--p-parlamento" },
    { id: "estado", nombre: "Gobierno de España y Cortes", color: "--p-estado" },
  ];
  const BASE = { ejecutado: "gasto real", presupuestado: "presupuesto" };

  const pobEsp = datos.poblacion.total;
  const est = datos.estado.partes;
  const sumaE = (t) => (est[t] ? est[t].altos + est[t].eventual : 0);
  const estadoTotal = C.nucleoEstado(datos.estado);

  // Desglose de una zona en euros (importes absolutos). La parte del Estado se reparte por habitante.
  function desglose(lista, pob) {
    const z = { local: [], gobierno: [], parlamento: [], estado: [] };
    const sum = (f) => lista.reduce((s, c) => s + f(c), 0);
    const loc = (c, k) => (c.partes.local ? c.partes.local[k] : 0);
    const pt = (c, t, k) => (c.partes[t] ? c.partes[t][k] : 0);
    z.local = [
      { n: "Alcaldes y concejales", v: sum((c) => loc(c, "electos")) },
      { n: "Asesores de los ayuntamientos", v: sum((c) => loc(c, "eventual")), asesor: true },
      { n: "Diputaciones, cabildos y comarcas", v: sum((c) => loc(c, "diputaciones")) },
    ];
    z.gobierno = [
      { n: "Presidencia, consejeros y altos cargos", v: sum((c) => pt(c, "gobierno", "altos")) },
      { n: "Asesores de confianza", v: sum((c) => pt(c, "gobierno", "eventual")), asesor: true },
    ];
    z.parlamento = [
      { n: "Diputados y cargos del parlamento", v: sum((c) => pt(c, "parlamento", "altos")) },
      { n: "Asesores del parlamento", v: sum((c) => pt(c, "parlamento", "eventual")), asesor: true },
    ];
    const f = pob / pobEsp;
    z.estado = [
      { n: "Ministros y altos cargos", v: est.gobierno.altos * f },
      { n: "Asesores de los ministerios", v: est.gobierno.eventual * f, asesor: true },
      { n: "Congreso de los Diputados", v: sumaE("congreso") * f },
      { n: "Senado", v: sumaE("senado") * f },
    ];
    const out = { pob, partes: {}, total: 0, asesores: 0 };
    for (const p of PARTES) {
      const v = z[p.id].reduce((s, d) => s + d.v, 0);
      out.partes[p.id] = { v, pp: v / pob, det: z[p.id] };
      out.total += v;
      out.asesores += z[p.id].filter((d) => d.asesor).reduce((s, d) => s + d.v, 0);
    }
    out.pp = out.total / pob;
    return out;
  }

  const ZONAS = new Map();
  for (const c of datos.comunidades) ZONAS.set(c.id, Object.assign(desglose([c], c.poblacion), { c, id: c.id, nombre: c.nombre }));
  const ESP = Object.assign(desglose(datos.comunidades, pobEsp), { id: "", nombre: "España" });
  // Comprobación: la suma de las partes coincide con las funciones comunes de la web
  const control = datos.comunidades.reduce((s, c) => s + C.nucleoComunidad(c), 0) + estadoTotal;
  if (Math.abs(control - ESP.total) > 1) console.warn("Descuadre en el total", control, ESP.total);

  const orden = [...ZONAS.values()].sort((a, b) => b.pp - a.pp);
  const maxPP = orden[0].pp, minPP = orden[orden.length - 1].pp;
  const slug = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const porSlug = new Map([...ZONAS.values()].map((z) => [slug(z.nombre), z.id]));

  // ---- Estado de la página ----
  let sel = "";
  let personas = 1;
  try {
    const h = decodeURIComponent(location.hash.slice(1));
    if (porSlug.has(h)) sel = porSlug.get(h);
    else if (!h) { const g = localStorage.getItem("cp-donde"); if (g && ZONAS.has(g)) sel = g; }
    const n = +localStorage.getItem("cp-personas");
    if (n >= 1 && n <= 10) personas = n;
  } catch (e) { /* sin almacenamiento: se usa la media de España */ }

  function elegir(id, desdeMapa) {
    sel = ZONAS.has(id) ? id : "";
    try { localStorage.setItem("cp-donde", sel); } catch (e) { /* nada */ }
    history.replaceState(null, "", sel ? "#" + slug(ZONAS.get(sel).nombre) : location.pathname + location.search);
    pintar();
    if (desdeMapa && window.innerWidth < 900) $("cifra").closest(".resultado").scrollIntoView({ behavior: sinMovimiento ? "auto" : "smooth", block: "center" });
  }

  // ---- Selector ----
  const select = $("donde");
  [...ZONAS.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).forEach((z) => {
    const o = document.createElement("option");
    o.value = z.id;
    o.textContent = z.nombre;
    select.appendChild(o);
  });
  select.addEventListener("change", () => elegir(select.value));

  // ---- Utilidades de dibujo ----
  function el(tag, attrs, padre) {
    const n = document.createElementNS(svgNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (padre) padre.appendChild(n);
    return n;
  }
  const ICONO = {
    arriba: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    abajo: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    igual: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6h10M3 10h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    aviso: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8 15 14H1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 6.2v3.6M8 11.6v.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    info: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 7.2v4M8 4.8v.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    copiar: '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.5 3.2V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v6.5a1 1 0 0 0 1 1h.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    flecha: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    persona: '<svg viewBox="0 0 26 34" aria-hidden="true"><circle cx="13" cy="8" r="6" fill="currentColor"/><path d="M2 33c0-8 4.6-13 11-13s11 5 11 13z" fill="currentColor"/></svg>',
    tarta: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12l6 6"/></svg>',
    asesor: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.3 2.7-5 5.5-5s4.9 1.7 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c2.6-.3 4.6 1.2 5 4.8"/></svg>',
    mapa: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  };
  const anima = new Map();
  function contar(nodo, valor, fmt) {
    const desde = anima.get(nodo) ?? valor;
    anima.set(nodo, valor);
    if (sinMovimiento || desde === valor) { nodo.textContent = fmt(valor); return; }
    const t0 = performance.now(), dur = 550;
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      nodo.textContent = fmt(desde + (valor - desde) * e);
      if (k < 1 && anima.get(nodo) === valor) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }
  const numero = (v) => C.fmtEur.format(v);
  function textoTip(z, extra) {
    return `<b>${eur2(z.pp)}</b><span class="t2">${C.esc(z.nombre)} · por habitante y año</span>${extra || ""}`;
  }

  // ---- 1. Primera pantalla ----
  function pintarHeroe() {
    const z = sel ? ZONAS.get(sel) : ESP;
    select.value = sel;
    document.querySelectorAll(".anyo").forEach((e) => (e.textContent = datos.anyo));
    $("frase-arriba").innerHTML = sel
      ? `Si vives en <b>${C.esc(z.nombre)}</b>, cada año te toca pagar`
      : `En España, a cada persona le toca pagar de media`;
    contar($("cifra"), z.pp, numero);

    const comp = $("comparacion");
    if (sel) {
      const d = z.pp - ESP.pp, r = z.pp / ESP.pp - 1;
      if (Math.abs(r) < 0.005) {
        comp.innerHTML = `<span class="flecha">${ICONO.igual}</span><span>Justo en la media de España (${eur2(ESP.pp)}).</span>`;
      } else {
        comp.innerHTML = `<span class="flecha">${d > 0 ? ICONO.arriba : ICONO.abajo}</span>
          <span><b>${eur2(Math.abs(d))} ${d > 0 ? "más" : "menos"}</b> que la media de España (${eur2(ESP.pp)}), un ${C.pct(Math.abs(r))} ${d > 0 ? "más" : "menos"}.</span>`;
      }
    } else {
      comp.innerHTML = `<span>Depende de dónde vivas: de ${eur2(minPP)} (${C.esc(orden[orden.length - 1].nombre)}) a ${eur2(maxPP)} (${C.esc(orden[0].nombre)}).</span>`;
    }
    // Reparto en miniatura (el detalle está en la sección siguiente)
    const CORTO = { local: "Ayuntamientos", gobierno: "Gobierno autonómico", parlamento: "Parlamento", estado: "Estado" };
    const vivas = PARTES.filter((p) => z.partes[p.id].v > 0);
    $("mini-reparto").innerHTML = `<div class="mini-barra" aria-hidden="true">${vivas.map((p) => `<i style="flex-grow:${z.partes[p.id].pp};flex-basis:0;background:var(${p.color})"></i>`).join("")}</div>
      <div class="mini-leyenda">${vivas.map((p) => `<span><i class="mu" style="background:var(${p.color})"></i>${CORTO[p.id]} <b>${eur2(z.partes[p.id].pp)}</b></span>`).join("")}</div>`;
    const cts = centimos(z.pp / 365);
    $("equivalencias").innerHTML = `<li><b>${eur2(z.pp / 12)}</b> al mes</li><li>unos <b>${cts} céntimos</b> al día</li>`;
  }
  $("copiar").innerHTML = `${ICONO.copiar}<span>Compartir</span>`;
  $("copiar").addEventListener("click", (ev) => {
    const z = sel ? ZONAS.get(sel) : ESP;
    const quien = sel ? `Si vives en ${z.nombre}, los sueldos de tus políticos y de sus asesores te cuestan ${eur2(z.pp)} al año (media de España: ${eur2(ESP.pp)}).`
      : `En España, los sueldos de los políticos y de sus asesores cuestan ${eur2(ESP.pp)} al año por persona.`;
    C.copiar(ev.currentTarget.querySelector("span"), `${quien} Sueldos brutos de ${datos.anyo}, sin dietas ni cotizaciones. Fuente: Coste de los políticos, con datos oficiales. ${location.href}`);
  });

  // ---- Mapa (selector y contexto: más oscuro = más caro por habitante) ----
  const mapa = d3.select("#mapa");
  const ANCHO = 640, ALTO = 470;
  mapa.attr("viewBox", `0 0 ${ANCHO} ${ALTO}`);
  const regiones = topojson.feature(topo, topo.objects.autonomous_regions).features.filter((f) => f.id !== "20" && ZONAS.has(f.id));
  const proy = d3.geoConicConformalSpain().fitSize([ANCHO, ALTO - 6], { type: "FeatureCollection", features: regiones });
  const ruta = d3.geoPath(proy);
  const capa = mapa.append("g");
  mapa.append("path").attr("class", "marco").attr("d", proy.getCompositionBorders());
  const escalaMapa = d3.scaleQuantile().domain(orden.map((z) => z.pp)).range([1, 2, 3, 4, 5]);
  const pequenas = new Set(["18", "19"]);
  const formas = capa.selectAll(".region").data(regiones).join((e) => e.append((f) => document.createElementNS(svgNS, pequenas.has(f.id) ? "circle" : "path")))
    .attr("class", "region")
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (f) => `${ZONAS.get(f.id).nombre}: ${eur2(ZONAS.get(f.id).pp)} por habitante y año`)
    .style("fill", (f) => `var(--seq-${escalaMapa(ZONAS.get(f.id).pp)})`)
    .on("pointermove", (ev, f) => C.tip(ev, textoTip(ZONAS.get(f.id))))
    .on("pointerleave", C.ocultarTip)
    .on("click", (ev, f) => { C.ocultarTip(); elegir(f.id, true); })
    .on("keydown", (ev, f) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); elegir(f.id); } });
  formas.filter((f) => !pequenas.has(f.id)).attr("d", ruta);
  formas.filter((f) => pequenas.has(f.id)).attr("r", 8).attr("cx", (f) => ruta.centroid(f)[0]).attr("cy", (f) => ruta.centroid(f)[1]);
  // Ceuta y Melilla son diminutas: se dibujan como un punto con su nombre
  formas.filter((f) => pequenas.has(f.id)).each((f) => {
    const [cx, cy] = ruta.centroid(f);
    mapa.append("text").attr("class", "ciudad").attr("data-id", f.id).attr("x", cx + 12).attr("y", cy + 4).text(ZONAS.get(f.id).nombre);
  });
  const nombreMapa = mapa.append("text").attr("class", "nombre-sel").attr("text-anchor", "middle");
  // Leyenda del mapa: rampa de 5 tramos con sus extremos
  $("leyenda-mapa").innerHTML = `<span>Por habitante:</span><span class="num">${eur2(minPP)}</span>
    <span class="rampa">${[1, 2, 3, 4, 5].map((i) => `<i style="background:var(--seq-${i})"></i>`).join("")}</span>
    <span class="num">${eur2(maxPP)}</span>`;
  $("mapa-pista").innerHTML = `${ICONO.mapa.replace("<svg", '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"')}<span>O toca tu comunidad en el mapa</span>`;

  function pintarMapa() {
    mapa.classed("con-sel", !!sel);
    formas.classed("sel", (f) => f.id === sel);
    formas.filter((f) => f.id === sel).raise();
    mapa.selectAll(".ciudad").classed("sel", function () { return this.dataset.id === sel; });
    if (sel && !pequenas.has(sel)) {
      const f = regiones.find((r) => r.id === sel);
      const [cx, cy] = ruta.centroid(f);
      const yTexto = cy + 5;
      const x = Math.max(70, Math.min(ANCHO - 70, cx));
      nombreMapa.attr("x", x).attr("y", yTexto).text(ZONAS.get(sel).nombre).raise();
    } else nombreMapa.text("");
  }

  // ---- 2. Barras apiladas: tú frente a la media ----
  function luminancia(rgb) {
    const m = rgb.match(/\d+(\.\d+)?/g);
    if (!m) return 0.5;
    const [r, g, b] = m.slice(0, 3).map((v) => { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function filaBarras(z, titulo, sub) {
    const fila = document.createElement("div");
    fila.className = "bc-fila";
    const partes = PARTES.filter((p) => z.partes[p.id].v > 0);
    fila.innerHTML = `<div class="bc-cab"><span class="bc-nombre">${titulo}${sub ? ` <small>${sub}</small>` : ""}</span></div>
      <div class="bc-pista"><div class="bc-barra" style="width:calc((100% - 88px) * ${z.pp / maxPP})">
      ${partes.map((p) => `<span class="seg" tabindex="0" data-p="${p.id}" style="flex-grow:${z.partes[p.id].pp};flex-basis:0;background:var(${p.color})"
          aria-label="${p.nombre}: ${eur2(z.partes[p.id].pp)}"><span class="seg-et">${eur2(z.partes[p.id].pp)}</span></span>`).join("")}
      </div><span class="bc-total">${eur2(z.pp)}</span></div>`;
    fila.querySelectorAll(".seg").forEach((s) => {
      const p = PARTES.find((k) => k.id === s.dataset.p);
      const html = () => `<b>${eur2(z.partes[p.id].pp)}</b><span class="t2"><i class="linea" style="background:var(${p.color})"></i>${p.nombre}</span>
        <span class="t2">${C.pct(z.partes[p.id].v / z.total)} del total · ${C.esc(z.nombre)}</span>`;
      s.addEventListener("pointermove", (ev) => C.tip(ev, html()));
      s.addEventListener("pointerleave", C.ocultarTip);
      s.addEventListener("focus", () => { const r = s.getBoundingClientRect(); C.tip({ clientX: r.left + r.width / 2, clientY: r.bottom }, html()); });
      s.addEventListener("blur", C.ocultarTip);
    });
    return fila;
  }
  function ajustarEtiquetas() {
    document.querySelectorAll(".bc-fila").forEach((fila) => {
      const barra = fila.querySelector(".bc-barra");
      if (!barra) return;
      const segs = [...barra.querySelectorAll(".seg")];
      const ancho = barra.getBoundingClientRect().width - 2 * (segs.length - 1);
      const total = segs.reduce((s, x) => s + +x.style.flexGrow, 0);
      segs.forEach((s) => {
        const et = s.querySelector(".seg-et");
        const w = (ancho * +s.style.flexGrow) / total;
        et.classList.toggle("oculta", et.offsetWidth + 4 > w);
        const L = luminancia(getComputedStyle(s).backgroundColor);
        const cBlanco = 1.05 / (L + 0.05), cTinta = (L + 0.05) / (luminancia("rgb(11,11,11)") + 0.05);
        et.style.color = cBlanco >= cTinta ? "#fff" : "#0b0b0b";
      });
    });
  }

  function pintarReparto() {
    const z = sel ? ZONAS.get(sel) : null;
    const cont = $("barras");
    cont.innerHTML = "";
    if (z) cont.appendChild(filaBarras(z, "Tú", "en " + C.esc(z.nombre)));
    else {
      const v = document.createElement("div");
      v.className = "bc-fila vacia";
      v.innerHTML = `<div class="bc-cab"><span class="bc-nombre">Tú</span></div><button type="button" class="bc-pista bc-elige">Elige dónde vives para ver tu barra</button>`;
      v.querySelector("button").addEventListener("click", () => { select.focus(); select.scrollIntoView({ block: "center", behavior: sinMovimiento ? "auto" : "smooth" }); });
      cont.appendChild(v);
    }
    cont.appendChild(filaBarras(ESP, "Media de España", ""));
    $("sub-reparto").textContent = z ? `Tus ${eur2(z.pp)}, parte por parte, frente a la media de España.` : "Los euros de cada persona, parte por parte.";
    $("leyenda").innerHTML = PARTES.map((p) => `<li><i class="mu" style="background:var(${p.color})"></i>${p.nombre}</li>`).join("");
    requestAnimationFrame(ajustarEtiquetas);

    // Frases clave, calculadas
    const zz = z || ESP;
    const mayor = PARTES.reduce((a, b) => (zz.partes[b.id].v > zz.partes[a.id].v ? b : a));
    const claves = [];
    claves.push({ ico: ICONO.tarta, t: `La parte más grande es la de <b>${sinArticulo(mayor.nombre)}</b>: ${eur2(zz.partes[mayor.id].pp)} de cada ${eur2(zz.pp)} (${C.pct(zz.partes[mayor.id].v / zz.total)}).` });
    const dec = Math.round((zz.asesores / zz.total) * 10);
    claves.push({ ico: ICONO.asesor, t: `Unos <b>${dec} de cada 10 euros</b> son sueldos de asesores de confianza: el personal que elige libremente cada cargo (${C.pct(zz.asesores / zz.total)}).` });
    if (z) {
      const dif = PARTES.map((p) => ({ p, d: z.partes[p.id].pp - ESP.partes[p.id].pp })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
      if (Math.abs(dif.d) >= 0.5) claves.push({ ico: ICONO.mapa, t: `Donde más te separas de la media: <b>${sinArticulo(dif.p.nombre)}</b>, ${eur2(z.partes[dif.p.id].pp)} frente a ${eur2(ESP.partes[dif.p.id].pp)}.` });
    } else {
      const n = orden.filter((x) => PARTES.reduce((a, b) => (x.partes[b.id].v > x.partes[a.id].v ? b : a)).id === mayor.id).length;
      claves.push({ ico: ICONO.mapa, t: `En ${n} de las ${orden.length} comunidades y ciudades autónomas, ${sinArticulo(mayor.nombre)} son también la parte más grande.` });
    }
    $("claves").innerHTML = claves.map((k) => `<li><span class="ico" aria-hidden="true">${k.ico}</span><span>${k.t}</span></li>`).join("");

    pintarRecibo(zz, !!z);
  }

  // ---- El recibo (la tabla con todos los valores) ----
  function pintarRecibo(z, esComunidad) {
    const c = z.c;
    const baseAuton = esComunidad ? BASE[c.base] || c.base : "presupuesto o gasto real, según la comunidad";
    const bases = { local: "gasto real", gobierno: baseAuton, parlamento: baseAuton, estado: sinArticulo(datos.estado.base) };
    const faltaParl = esComunidad && c.faltan.length > 0;
    let filas = "";
    for (const p of PARTES) {
      const parte = z.partes[p.id];
      if (parte.v <= 0 && !(p.id === "parlamento" && faltaParl)) continue;
      filas += `<tr class="grupo"><td><i class="mu" style="background:var(${p.color})"></i><span>${p.nombre}<small>${bases[p.id].charAt(0).toUpperCase() + bases[p.id].slice(1)}</small></span></td><td class="num">${parte.v > 0 ? eur2(parte.pp) : "sin datos"}</td></tr>`;
      for (const d of parte.det) if (d.v > 0) filas += `<tr class="det"><td>${d.n}</td><td class="num">${eur2(d.v / z.pob)}</td></tr>`;
    }
    filas += `<tr class="sep"><td colspan="2"></td></tr><tr class="total"><td>Total al año</td><td class="num">${eur2(z.pp)}</td></tr>`;

    const avisos = esComunidad
      ? [...c.faltan.map((t) => ["falta", "Sin datos: " + t + " La cifra real es algo mayor."]), ...c.avisos.map((t) => ["aviso", t]), ...c.notas.map((t) => ["nota", t])]
      : [["nota", "Media de España: el coste de todas las comunidades, ayuntamientos y el Estado dividido entre todos los habitantes."]];
    const fuentes = esComunidad
      ? [...c.fuentes, ...(z.partes.local.v > 0 ? datos.fuentes_local : []), ...datos.estado.fuentes]
      : [...datos.fuentes_local, ...datos.estado.fuentes];
    $("recibo").innerHTML = `
      <div class="recibo-cab"><b>Tu recibo ${datos.anyo}</b><span>${C.esc(esComunidad ? z.nombre : "Media de España")} · por habitante</span></div>
      <table><tbody>${filas}</tbody></table>
      <button type="button" class="desplegar" aria-expanded="false">Ver cada línea del recibo <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      ${avisos.length ? `<ul class="avisos">${avisos.map(([k, t]) => `<li class="${k}">${k === "nota" ? ICONO.info : ICONO.aviso}<span>${C.esc(t)}</span></li>`).join("")}</ul>` : ""}
      ${z.partes.local.v > 0 ? `<a class="enlace-ayto" href="${RAIZ}ayuntamientos.html">La parte local es la media de ${esComunidad ? "tu comunidad" : "España"}. Busca tu ayuntamiento ${ICONO.flecha}</a>` : ""}
      <div class="fuentes">Fuentes: ${fuentes.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${C.esc(s.texto)}</a>`).join(" · ")}${esComunidad ? "" : ` · <a href="${RAIZ}periodistas.html#fuentes">y las de cada comunidad</a>`}.
      Población: <a href="${datos.poblacion.url}" target="_blank" rel="noopener">${C.esc(datos.poblacion.fuente)}</a>.</div>`;
    const rec = $("recibo"), bot = rec.querySelector(".desplegar");
    rec.classList.toggle("abierto", reciboAbierto);
    bot.setAttribute("aria-expanded", reciboAbierto);
    bot.addEventListener("click", () => {
      reciboAbierto = !reciboAbierto;
      rec.classList.toggle("abierto", reciboAbierto);
      bot.setAttribute("aria-expanded", reciboAbierto);
      bot.firstChild.textContent = reciboAbierto ? "Ocultar el detalle " : "Ver cada línea del recibo ";
    });
    bot.firstChild.textContent = reciboAbierto ? "Ocultar el detalle " : "Ver cada línea del recibo ";
  }
  let reciboAbierto = false;

  // ---- 3a. ¿Cómo quedas? Un punto por comunidad ----
  function pintarEnjambre() {
    const cont = $("enjambre");
    const w = Math.max(280, cont.clientWidth);
    const estrecho = w < 520;
    const r = estrecho ? 6.5 : 8;
    const m = { l: 10, r: 10 };
    const x = d3.scaleLinear().domain([Math.floor(minPP / 5) * 5, Math.ceil(maxPP / 5) * 5]).range([m.l + r, w - m.r - r]);
    // Enjambre: cada punto busca el hueco libre más cercano a la línea central
    const colocados = [];
    const pasoY = [...orden].sort((a, b) => a.pp - b.pp).map((z) => {
      const cx = x(z.pp), d = 2 * r + 1.5;
      const vecinos = colocados.filter((p) => Math.abs(p.cx - cx) < d);
      const candidatos = [0];
      vecinos.forEach((p) => { const dy = Math.sqrt(d * d - (p.cx - cx) ** 2); candidatos.push(p.cy + dy, p.cy - dy); });
      candidatos.sort((a, b) => Math.abs(a) - Math.abs(b));
      const cy = candidatos.find((cy) => vecinos.every((p) => (p.cx - cx) ** 2 + (p.cy - cy) ** 2 >= d * d - 0.01));
      const p = { z, cx, cy };
      colocados.push(p);
      return p;
    });
    const extension = Math.max(...pasoY.map((p) => Math.abs(p.cy))) + r;
    const selP = pasoY.find((p) => p.z.id === sel);
    cont.innerHTML = "";
    const svg = el("svg", { role: "img", "aria-label": "Coste por habitante de cada comunidad, de menos a más" }, cont);
    const capaLineas = el("g", {}, svg), capaPuntos = el("g", {}, svg), capaTextos = el("g", {}, svg);

    // Etiquetas sobre el gráfico. Cada una prueba fila y posición (encima, a la derecha o a la izquierda de su línea)
    // hasta que no pisa a otra etiqueta ni la cruza ninguna línea.
    const xm = x(ESP.pp);
    const ets = [];
    if (selP) ets.push({ html: [`<tspan class="fuerte">Tú</tspan> · ${C.esc(selP.z.nombre)} <tspan class="fuerte">${eur2(selP.z.pp)}</tspan>`, `<tspan class="fuerte">Tú ${eur2(selP.z.pp)}</tspan>`], lx: selP.cx, p: selP, pos: ["c", "d", "i"] });
    if (!selP) {
      const a = pasoY[0], b = pasoY[pasoY.length - 1];
      ets.push({ html: [`${C.esc(a.z.nombre)} <tspan class="fuerte">${eur2(a.z.pp)}</tspan>`, `<tspan class="fuerte">${eur2(a.z.pp)}</tspan>`], lx: a.cx, p: a, pos: ["d", "c", "i"] });
      ets.push({ html: [`${C.esc(b.z.nombre)} <tspan class="fuerte">${eur2(b.z.pp)}</tspan>`, `<tspan class="fuerte">${eur2(b.z.pp)}</tspan>`], lx: b.cx, p: b, pos: ["i", "c", "d"] });
    }
    ets.push({ html: [`Media de España <tspan class="fuerte">${eur2(ESP.pp)}</tspan>`, `Media <tspan class="fuerte">${eur2(ESP.pp)}</tspan>`], lx: xm, clase: "sec", media: true, pos: ["c", "d", "i"] });
    const FILA = 18, puestas = [];
    const choca = (A, B) => {
      if (A.fila === B.fila && A.x0 < B.x1 + 8 && B.x0 < A.x1 + 8) return true;
      const cruza = (L, T) => T.fila >= L.desde && L.lx > T.x0 - 4 && L.lx < T.x1 + 4;
      return cruza(A, B) || cruza(B, A);
    };
    ets.forEach((e) => {
      e.t = el("text", { class: "et " + (e.clase || ""), x: 0, y: 0 }, capaTextos);
      let elegido = null;
      // Primero la versión larga en cualquier fila; si no cabe sin pisar, la corta
      for (const version of e.html) {
        if (elegido) break;
        e.t.innerHTML = version;
        e.ancho = e.t.getComputedTextLength();
      for (let f = 0; f < 4 && !elegido; f++) {
        for (const pos of e.pos) {
          let x0 = pos === "c" ? e.lx - e.ancho / 2 : pos === "d" ? e.lx + 5 : e.lx - 5 - e.ancho;
          x0 = Math.max(0, Math.min(w - e.ancho, x0));
          const cand = { lx: e.lx, x0, x1: x0 + e.ancho, fila: f };
          const debajo = cand.lx > x0 - 2 && cand.lx < cand.x1 + 2; // la línea sale por debajo del texto
          cand.desde = debajo ? f + 1 : f;
          if (!puestas.some((o) => choca(cand, o))) { elegido = cand; break; }
        }
      }
      }
      if (!elegido) { // último recurso: encima de su línea, en la primera fila libre
        let f = 0;
        const x0 = Math.max(0, Math.min(w - e.ancho, e.lx - e.ancho / 2));
        while (puestas.some((o) => o.fila === f && x0 < o.x1 + 8 && o.x0 < x0 + e.ancho + 8)) f++;
        elegido = { lx: e.lx, x0, x1: x0 + e.ancho, fila: f, desde: f + 1 };
      }
      Object.assign(e, elegido);
      puestas.push(e);
    });
    const nFilas = Math.max(...ets.map((e) => e.fila)) + 1;
    const arriba = nFilas * FILA + 10;
    const yc = arriba + extension + 6;
    const yEje = yc + extension + 10;
    const alto = yEje + 26;
    svg.setAttribute("viewBox", `0 0 ${w} ${alto}`);
    ets.forEach((e) => {
      e.t.setAttribute("x", e.x0);
      e.t.setAttribute("y", 13 + e.fila * FILA);
      const y1 = e.desde > e.fila ? e.fila * FILA + 18 : e.fila * FILA + 3;
      if (e.media) el("line", { class: "media", x1: xm, x2: xm, y1, y2: yEje }, capaLineas);
      else el("line", { class: "guia", x1: e.lx, x2: e.lx, y1, y2: yc + e.p.cy - r - 1 }, capaLineas);
    });
    // Eje
    const eje = el("g", { class: "eje" }, capaLineas);
    el("line", { class: "base", x1: m.l, x2: w - m.r, y1: yEje, y2: yEje }, eje);
    x.ticks(estrecho ? 4 : 6).forEach((t) => {
      el("line", { x1: x(t), x2: x(t), y1: yEje, y2: yEje + 5, class: "base" }, eje);
      el("text", { x: x(t), y: yEje + 18, "text-anchor": "middle" }, eje).textContent = fmtEnt.format(t) + " €";
    });
    // Puntos (el elegido, encima de todos)
    [...pasoY].sort((a, b) => (a === selP) - (b === selP)).forEach((p) => {
      const c = el("circle", { class: "punto" + (p === selP ? " sel" : ""), cx: p.cx, cy: yc + p.cy, r, "aria-label": `${p.z.nombre}: ${eur2(p.z.pp)}` }, capaPuntos);
      c.style.fill = p === selP ? "var(--acento)" : "var(--apagado)";
      c.addEventListener("pointermove", (ev) => C.tip(ev, textoTip(p.z)));
      c.addEventListener("pointerleave", C.ocultarTip);
      c.addEventListener("click", () => { C.ocultarTip(); elegir(p.z.id); });
    });
    // Texto
    const n = orden.length;
    if (sel) {
      const pos = orden.findIndex((z) => z.id === sel) + 1;
      const z = ZONAS.get(sel);
      $("quedas-texto").innerHTML = pos === 1 ? `${C.esc(z.nombre)} es donde más se paga por habitante de las ${n} comunidades y ciudades autónomas.`
        : pos === n ? `${C.esc(z.nombre)} es donde menos se paga por habitante de las ${n} comunidades y ciudades autónomas.`
        : `${C.esc(z.nombre)} ocupa el puesto <b>${pos} de ${n}</b>, contando de la que más paga por habitante a la que menos.`;
    } else {
      $("quedas-texto").textContent = `Cada punto es una de las ${n} comunidades y ciudades autónomas. Toca uno para elegirlo.`;
    }
  }

  // ---- 3b. En tu casa ----
  function pintarCasa() {
    const z = sel ? ZONAS.get(sel) : ESP;
    $("personas").textContent = personas;
    $("menos").disabled = personas <= 1;
    $("mas").disabled = personas >= 10;
    $("casa-iconos").innerHTML = ICONO.persona.repeat(personas);
    $("casa-cifra").innerHTML = `${eur2(z.pp * personas)} <small>al año</small>`;
    $("casa-texto").innerHTML = personas === 1
      ? `Si vives solo o sola. Pulsa + para sumar a los que viven contigo, niños incluidos.`
      : `Entre los ${personas} de casa: <b>${eur2((z.pp * personas) / 12)} al mes</b>.`;
  }
  function cambiarPersonas(d) {
    personas = Math.max(1, Math.min(10, personas + d));
    try { localStorage.setItem("cp-personas", personas); } catch (e) { /* nada */ }
    pintarCasa();
  }
  $("menos").addEventListener("click", () => cambiarPersonas(-1));
  $("mas").addEventListener("click", () => cambiarPersonas(1));

  // ---- 3c. Entre todos ----
  const ref = hist.sueldos.detalle.referencias.funcionario_A2_22;
  function pintarVecinos() {
    const z = sel ? ZONAS.get(sel) : ESP;
    const n = Math.round(z.total / ref.anual);
    $("t-vecinos").textContent = sel ? "Entre todos tus vecinos" : "Entre todos";
    $("vecinos-cifra").innerHTML = `${C.millones(z.total)} <small>al año</small>`;
    $("vecinos-texto").innerHTML = `Es lo que pagan los ${fmtEnt.format(z.pob)} habitantes de ${C.esc(z.nombre)}. Con ese dinero se pagaría la retribución básica de <b>${fmtEnt.format(n)} maestros o enfermeros</b> durante un año.`;
    $("vecinos-nota").innerHTML = `${C.esc(ref.texto)}: ${C.eur(ref.anual)} brutos al año en ${hist.sueldos.detalle.anyo} (<a href="${hist.sueldos.detalle.url}" target="_blank" rel="noopener">${C.esc(hist.sueldos.detalle.ley)}</a>). ${C.esc(hist.sueldos.detalle.referencias.nota)}`;
  }

  // ---- 4. Accesos a las demás secciones, cada uno con un adelanto de sus datos ----
  function vistaComunidades(svg, W, H) {
    // Barras finas ordenadas: coste de cada comunidad (gobierno, parlamento y ayuntamientos), como en su página
    const v = datos.comunidades.map((c) => ({ id: c.id, v: C.nucleoComunidad(c) / c.poblacion })).sort((a, b) => b.v - a.v);
    const bw = W / v.length, max = v[0].v, base = H - 2;
    v.forEach((d, i) => {
      const h = (d.v / max) * (base - 6);
      const b = el("rect", { x: i * bw + 1, y: base - h, width: Math.max(1, bw - 2), height: h, rx: 2 }, svg);
      b.style.fill = d.id === sel ? "var(--acento)" : sel ? "var(--apagado)" : "var(--seq-3)";
    });
    el("line", { x1: 0, x2: W, y1: base, y2: base, stroke: "var(--eje)" }, svg);
  }
  function vistaAyuntamientos(svg, W, H) {
    const share = ESP.partes.local.v / ESP.total;
    el("text", { x: 0, y: H * 0.42, class: "fuerte", style: "font-size:30px" }, svg).textContent = C.pct(share);
    el("text", { x: 0, y: H * 0.42 + 18 }, svg).textContent = "del total";
    const bg = el("rect", { x: 0, y: H - 14, width: W, height: 12, rx: 4 }, svg); bg.style.fill = "var(--rejilla)";
    const fg = el("rect", { x: 0, y: H - 14, width: W * share, height: 12, rx: 4 }, svg); fg.style.fill = "var(--p-local)";
  }
  function vistaEstado(svg, W, H) {
    const serie = hist.estado.filter((r) => r.factor_ipc);
    const top = 16, pie = 16, bw = W / serie.length;
    const real = (r) => r.total * r.factor_ipc;
    const max = d3.max(serie, real);
    serie.forEach((r, i) => {
      const h = (real(r) / max) * (H - top - pie - 2);
      const b = el("rect", { x: i * bw + 1, y: H - pie - h, width: Math.max(1, bw - 2), height: h, rx: 2 }, svg);
      b.style.fill = "var(--p-estado)";
    });
    el("line", { x1: 0, x2: W, y1: H - pie, y2: H - pie, stroke: "var(--eje)" }, svg);
    const a = serie[0], b = serie[serie.length - 1];
    el("text", { x: 0, y: H - 3 }, svg).textContent = a.anyo;
    el("text", { x: W, y: H - 3, "text-anchor": "end" }, svg).textContent = b.anyo;
    el("text", { x: 0, y: 10, class: "fuerte" }, svg).textContent = C.millones(real(a));
    el("text", { x: W, y: 10, class: "fuerte", "text-anchor": "end" }, svg).textContent = C.millones(real(b));
  }
  const cargos = hist.sueldos.detalle.cargos;
  const presi = cargos.find((c) => c.cargo === "Presidente del Gobierno");
  const masQuePresi = cargos.filter((c) => c.anual > presi.anual);
  function vistaSueldos(svg, W, H) {
    const filas = [
      { n: W < 190 ? "El que más cobra" : cargos[0].cargo.replace("Presidente del ", "Pres. del "), v: cargos[0].anual },
      { n: "Presidente del Gobierno", v: presi.anual, sel: true },
      { n: "Maestro o enfermero", v: ref.anual },
    ];
    const max = filas[0].v, hueco = H / 3, ancho = W - 64;
    filas.forEach((f, i) => {
      const y = i * hueco;
      el("text", { x: 0, y: y + 10 }, svg).textContent = f.n;
      const b = el("rect", { x: 0, y: y + 14, width: Math.max(3, (f.v / max) * ancho), height: 9, rx: 3 }, svg);
      b.style.fill = f.sel ? "var(--acento)" : "var(--apagado)";
      el("text", { x: (f.v / max) * ancho + 5, y: y + 22, class: "fuerte" }, svg).textContent = fmtEnt.format(Math.round(f.v / 1000)) + " mil €";
    });
  }
  function vistaCalculadora(svg, W, H) {
    const miles = Math.round(ESP.total / ref.anual / 1000);
    const paso = 9.2, cols = Math.max(5, Math.floor((W + 2) / paso));
    for (let i = 0; i < miles; i++) {
      const c = el("circle", { cx: 4 + (i % cols) * paso, cy: 4 + Math.floor(i / cols) * paso, r: 3.3 }, svg);
      c.style.fill = "var(--c-3)";
    }
    el("text", { x: 0, y: Math.min(H - 2, Math.ceil(miles / cols) * paso + 12) }, svg).textContent = "cada punto, 1.000 maestros";
  }
  function vistaPeriodistas(svg, W, H) {
    const cx = W / 2;
    const g = el("g", { fill: "none", stroke: "var(--tinta-2)", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", transform: `translate(${cx - 46} ${(H - 80) / 2})` }, svg);
    el("path", { d: "M0 0h34l16 16v64H0z" }, g);
    el("path", { d: "M34 0v16h16M10 34h30M10 46h30M10 58h18" }, g);
    const f = el("g", { fill: "none", stroke: "var(--acento)", "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round", transform: `translate(${cx - 46} ${(H - 80) / 2})` }, svg);
    el("path", { d: "M80 30v30M69 50l11 11 11-11M68 74h24" }, f);
  }
  const ACCESOS = [
    { href: "comunidades.html", p: "¿Dónde se paga más?", t: "Tu comunidad, a fondo",
      g: () => `Mapa, ranking y el porqué de cada una.`, vista: vistaComunidades },
    { href: "ayuntamientos.html", p: "¿Y tu pueblo o ciudad?", t: "Tu ayuntamiento",
      g: () => `Es la parte más grande. Busca el tuyo y compáralo con otros de su tamaño.`, vista: vistaAyuntamientos },
    { href: "estado.html", p: "¿Cambia con cada Gobierno?", t: "Gobierno de España",
      g: () => `Altos cargos, asesores y Cortes, año a año desde ${hist.estado[0].anyo}, en euros de ${hist.base_ipc}.`, vista: vistaEstado },
    { href: "sueldos.html", p: "¿Cuánto cobra cada cargo?", t: "Los sueldos que fija la ley",
      g: () => `${masQuePresi.length} cargos del Estado cobran más que el presidente del Gobierno.`, vista: vistaSueldos },
    { href: "calculadora.html", p: "¿Qué se podría pagar?", t: "La calculadora",
      g: () => `Todo junto equivale al sueldo básico de ${fmtEnt.format(Math.round(ESP.total / ref.anual))} maestros o enfermeros.`, vista: vistaCalculadora },
    { href: "periodistas.html", p: "¿Vas a citar estos datos?", t: "Periodistas y datos",
      g: () => `Cifras para citar con su fuente, descargas y método.`, vista: vistaPeriodistas },
  ];
  function pintarAccesos() {
    const cont = $("accesos");
    cont.innerHTML = "";
    ACCESOS.forEach((a) => {
      const n = document.createElement("a");
      n.className = "acceso";
      n.href = RAIZ + a.href;
      n.innerHTML = `<div class="vista"><svg aria-hidden="true" preserveAspectRatio="xMidYMid meet"></svg></div>
        <div class="texto"><span class="pregunta-acceso">${a.p}</span><b>${a.t}</b><span class="gancho">${C.esc(a.g())}</span><span class="ir">Ver ${ICONO.flecha}</span></div>`;
      cont.appendChild(n);
      const caja = n.querySelector(".vista"), svg = n.querySelector("svg");
      const cs = getComputedStyle(caja);
      const W = Math.max(100, caja.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
      const H = Math.max(60, caja.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      a.vista(svg, W, H);
    });
  }

  $("pie").innerHTML = `Datos de ${datos.anyo}, actualizados el ${datos.generado.split("-").reverse().join("/")}. Población: <a href="${datos.poblacion.url}" target="_blank" rel="noopener">${C.esc(datos.poblacion.fuente)}</a>. Todas las cifras de esta página se calculan a partir de los <a href="${RAIZ}periodistas.html">datos abiertos de la web</a>.`;

  function pintar() {
    pintarHeroe();
    pintarMapa();
    pintarReparto();
    pintarEnjambre();
    pintarCasa();
    pintarVecinos();
    pintarAccesos();
  }
  pintar();

  let espera;
  let anchoPrevio = window.innerWidth;
  window.addEventListener("resize", () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      if (window.innerWidth === anchoPrevio) return;
      anchoPrevio = window.innerWidth;
      pintarEnjambre();
      pintarAccesos();
      ajustarEtiquetas();
    }, 120);
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", ajustarEtiquetas);
  window.addEventListener("hashchange", () => {
    const h = decodeURIComponent(location.hash.slice(1));
    if (porSlug.has(h) && porSlug.get(h) !== sel) elegir(porSlug.get(h));
  });
})();
