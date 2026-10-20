// Propuesta A · «Historia guiada»: la portada cuenta la situación en cinco pasos.
// Todas las cifras se calculan aquí a partir de datos.json e historico.json.
(async function () {
  "use strict";
  const RAIZ = "../../";
  const [datos, hist, topo] = await Promise.all([
    C.json(RAIZ + "datos.json"),
    C.json(RAIZ + "historico.json"),
    C.json(RAIZ + "vendor/autonomous_regions.json"),
  ]);

  const $ = (id) => document.getElementById(id);
  const esc = C.esc;
  const fmt1 = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ent = (v) => C.fmtEnt.format(Math.round(v));
  // Con espacio duro: «39,52 €» nunca se parte en dos líneas
  const eur2 = (v) => C.fmtEur.format(v) + "\u00a0€";
  const eur = (v) => C.fmtEnt.format(Math.round(v)) + "\u00a0€";
  const pct = (v) => C.fmtPct.format(v * 100) + "\u00a0%";
  // «1.351 millones», «311,8 millones»: palabras en vez de «M€» para quien no lee presupuestos
  const millones = (v) => (v >= 100e6 ? ent(v / 1e6) : fmt1.format(v / 1e6)) + " millones";
  const mEje = (v) => ent(v / 1e6);
  const apellido = (n) => n.split(" ").slice(-1)[0];
  const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  document.querySelectorAll(".d-anyo").forEach((e) => (e.textContent = datos.anyo));

  // ---------------- Cálculos ----------------
  const CC = datos.comunidades;
  const pob = datos.poblacion.total;
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  const parte = (c, t, k) => (c.partes[t] ? c.partes[t][k] || 0 : 0);
  const localDe = (c) => (c.partes.local ? c.partes.local.electos + c.partes.local.diputaciones + c.partes.local.eventual : 0);
  const autDe = (c) => ["gobierno", "parlamento"].reduce((s, t) => s + parte(c, t, "altos") + parte(c, t, "eventual"), 0);
  const local = sum(CC, localDe);
  const autonomico = sum(CC, autDe);
  const estado = C.nucleoEstado(datos.estado);
  const total = sum(CC, C.nucleoComunidad) + estado;
  const porPersona = total / pob;
  const EP = datos.estado.partes;
  const asesores = sum(CC, (c) => parte(c, "gobierno", "eventual") + parte(c, "parlamento", "eventual") + (c.partes.local ? c.partes.local.eventual : 0))
    + ["gobierno", "congreso", "senado"].reduce((s, t) => s + (EP[t] ? EP[t].eventual : 0), 0);

  // ---------------- Monedas ----------------
  let idClip = 0;
  // Una moneda de radio r centrada en (cx, cy); frac < 1 dibuja solo esa parte (el resto, hueco)
  function moneda(cx, cy, r, frac, i, clase) {
    const glifo = r >= 8 ? `<text class="glifo" x="${cx}" y="${cy + r * 0.36}" font-size="${r * 1.02}" text-anchor="middle">€</text>` : "";
    const llena = `<circle class="disco" cx="${cx}" cy="${cy}" r="${r}"/><circle class="aro" cx="${cx}" cy="${cy}" r="${r * 0.76}"/>${glifo}`;
    const retardo = i != null ? ` style="animation-delay:${i * 24}ms"` : "";
    if (frac >= 0.995) return `<g class="mon ${clase || ""}"${retardo}>${llena}</g>`;
    const id = "clip-m" + ++idClip;
    return `<g class="mon ${clase || ""}"${retardo}><clipPath id="${id}"><rect x="${cx - r}" y="${cy - r}" width="${2 * r * frac}" height="${2 * r}"/></clipPath>
      <circle class="hueco" cx="${cx}" cy="${cy}" r="${r - 0.5}"/><g clip-path="url(#${id})">${llena}</g></g>`;
  }
  // Fila o rejilla de monedas para un importe en euros (cada moneda, 1 €)
  function monedas(valor, { cols, paso, r, anim }) {
    const n = Math.ceil(valor - 1e-9);
    let s = "";
    for (let i = 0; i < n; i++) {
      const col = i % cols, fila = Math.floor(i / cols);
      s += moneda(paso / 2 + col * paso, paso / 2 + fila * paso, r, Math.min(1, valor - i), anim ? i : null);
    }
    const filas = Math.ceil(n / cols);
    return { svg: s, ancho: cols * paso, alto: filas * paso };
  }

  // ---------------- Portada ----------------
  $("cifra").innerHTML = `${C.fmtEur.format(porPersona)}<span class="eur">&#8239;€</span>`;
  $("cuenta").innerHTML = `
    <div class="dato"><b>${eur2(porPersona / 12)}</b><span>al mes por persona</span></div>
    <div class="dato"><b>${millones(total)}</b><span>de euros en total</span></div>
    <div class="dato"><b>${fmt1.format(pob / 1e6)} millones</b><span>de habitantes</span></div>`;
  (function heroe() {
    const m = monedas(porPersona, { cols: 7, paso: 60, r: 26, anim: !reducido });
    const svg = $("monedas-heroe");
    svg.setAttribute("viewBox", `0 0 ${m.ancho} ${m.alto}`);
    svg.setAttribute("aria-label", `${eur2(porPersona)}: ${Math.floor(porPersona)} monedas de un euro y parte de otra`);
    svg.innerHTML = m.svg;
    if (!reducido) svg.classList.add("anima");
  })();

  // ---------------- 1 · A dónde va ----------------
  const FRAC = [[1, 2], [2, 3], [3, 4], [1, 3], [1, 4], [3, 5], [2, 5], [4, 5]];
  const NUM = ["", "Uno", "Dos", "Tres", "Cuatro", "Cinco"];
  const fr = FRAC.find(([a, b]) => Math.abs(local / total - a / b) < 0.015);
  $("t1").textContent = fr
    ? `${NUM[fr[0]]} de cada ${NUM[fr[1]].toLowerCase()} euros van a ayuntamientos y diputaciones`
    : `El ${pct(local / total)} va a ayuntamientos y diputaciones`;
  $("e1").innerHTML = `Alcaldes, concejales, diputaciones y sus asesores: <b>${millones(local)} de euros</b> al año.`;
  const NIVELES = [
    { v: local, nombre: "Ayuntamientos y diputaciones", det: "Alcaldes, concejales, diputados provinciales y sus asesores", prin: true },
    { v: autonomico, nombre: "Comunidades autónomas", det: "Presidentes, consejeros, parlamentos autonómicos y sus asesores" },
    { v: estado, nombre: "Gobierno central y Cortes", det: "Ministros, altos cargos, diputados, senadores y sus asesores" },
  ];
  function niveles() {
    const cont = $("niveles");
    const ancho = cont.clientWidth || 600;
    const maxMon = Math.max(...NIVELES.map((n) => Math.ceil(n.v / pob)));
    const paso = Math.min(34, ancho / (maxMon + 0.2));
    cont.innerHTML = `<p class="grafico-t">Tus ${eur2(porPersona)} al año, repartidos (cada moneda, 1 €)</p>` + NIVELES.map((n) => {
      const pp = n.v / pob;
      const m = monedas(pp, { cols: maxMon + 1, paso, r: paso * 0.42, anim: true });
      return `<div class="nivel${n.prin ? " prin" : ""}">
        <div class="nom"><b>${n.nombre}</b><span>${n.det}</span></div>
        <div class="val"><b>${eur2(pp)}</b><i>${pct(n.v / total)}</i><small>${millones(n.v)} de euros</small></div>
        <svg viewBox="0 0 ${ancho} ${m.alto}" role="img" aria-label="${n.nombre}: ${eur2(pp)} por persona">${m.svg}</svg>
      </div>`;
    }).join("");
    // De cada 10 €, cuántos son de asesores
    const diez = Math.round((asesores / total) * 10);
    const exacto = Math.abs((asesores / total) * 10 - diez) < 0.2;
    let s = "";
    for (let i = 0; i < 10; i++) s += moneda(10 + i * 19, 10, 8.2, 1, null, i < diez ? "" : "gris");
    $("asesores").innerHTML = `<svg viewBox="0 0 190 20" role="img" aria-label="${diez} de cada 10 euros">${s}</svg>
      <p>${exacto ? `<b>${diez} de cada 10 €</b> son` : `<b>El ${pct(asesores / total)}</b> es`} para <b>asesores de confianza</b>: personas que cada cargo elige libremente, sin oposición.</p>`;
  }

  // ---------------- 2 · Dónde vives ----------------
  const filas = CC.map((c) => ({ c, v: C.nucleoComunidad(c) / c.poblacion })).sort((a, b) => b.v - a.v);
  const porId = new Map(filas.map((f) => [f.c.id, f]));
  const caro = filas[0], barato = filas[filas.length - 1];
  const media = sum(CC, C.nucleoComunidad) / sum(CC, (c) => c.poblacion);
  const NOMBRE_CORTO = { "Comunidad de Madrid": "Madrid", "Comunitat Valenciana": "C. Valenciana", "Región de Murcia": "Murcia", "Castilla-La Mancha": "C.-La Mancha" };
  const corto = (n) => NOMBRE_CORTO[n] || n;
  $("t2").textContent = `Según dónde vivas, de ${eur2(barato.v)} a ${eur2(caro.v)} por persona`;
  $("e2").textContent = "Lo que cuestan, por habitante, el gobierno, el parlamento y los ayuntamientos de cada comunidad.";
  const escala = d3.scaleQuantile().domain(filas.map((f) => f.v)).range([1, 2, 3, 4, 5]);
  const colorDe = (v) => `var(--seq-${escala(v)})`;
  let seleccion = null;

  // Mapa
  const regiones = topojson.feature(topo, topo.objects.autonomous_regions).features.filter((f) => f.id !== "20" && porId.has(f.id));
  const MW = 640, MH = 470;
  const proy = d3.geoConicConformalSpain().fitExtent([[4, 4], [MW - 4, MH - 4]], { type: "FeatureCollection", features: regiones });
  const ruta = d3.geoPath(proy);
  const mapa = d3.select("#mapa").attr("viewBox", `0 0 ${MW} ${MH}`);
  mapa.append("path").attr("class", "marco").attr("d", proy.getCompositionBorders());
  const capa = mapa.append("g");
  const pequenas = new Set(["18", "19"]); // Ceuta y Melilla: un punto para poder verlas y tocarlas
  const formas = capa.selectAll(".region").data(regiones).join((e) => e.append((f) => document.createElementNS("http://www.w3.org/2000/svg", pequenas.has(f.id) ? "circle" : "path")))
    .attr("class", "region")
    .each(function (f) {
      const el = d3.select(this);
      if (pequenas.has(f.id)) el.attr("cx", ruta.centroid(f)[0]).attr("cy", ruta.centroid(f)[1]).attr("r", 8);
      else el.attr("d", ruta);
    })
    .style("fill", (f) => colorDe(porId.get(f.id).v))
    .attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", (f) => `${porId.get(f.id).c.nombre}: ${eur2(porId.get(f.id).v)} por habitante`)
    .on("pointermove", (ev, f) => C.tip(ev, tipCcaa(porId.get(f.id))))
    .on("pointerleave", C.ocultarTip)
    .on("click", (ev, f) => elegir(f.id))
    .on("keydown", (ev, f) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); elegir(f.id); } });
  // Etiquetas directas: la más cara y la más barata (nombre y cifra)
  [caro, barato].forEach((f) => {
    const g = regiones.find((r) => r.id === f.c.id);
    const [x, y] = ruta.centroid(g);
    const t = mapa.append("text").attr("class", "et-mapa").attr("x", x).attr("y", y).attr("text-anchor", "middle");
    t.append("tspan").attr("class", "et-n").attr("x", x).attr("dy", "-0.2em").text(corto(f.c.nombre));
    t.append("tspan").attr("x", x).attr("dy", "1.15em").text(eur2(f.v));
  });

  function ajustarMapa() {
    const w = $("mapa").getBoundingClientRect().width || MW;
    const k = MW / w;
    mapa.selectAll(".et-mapa").style("font-size", 13 * k + "px").style("stroke-width", 3.5 * k + "px");
    formas.filter((f) => pequenas.has(f.id)).attr("r", Math.max(7, 6 * k));
  }

  function tipCcaa(f) {
    const d = f.v / media - 1;
    return `<b>${esc(f.c.nombre)}${f.c.faltan.length ? " *" : ""}</b>${eur2(f.v)} por habitante<br><span class="t2">${Math.abs(d) < 0.005 ? "En la media" : pct(Math.abs(d)) + (d > 0 ? " más" : " menos") + " que la media"}</span>`;
  }

  // Tira: todas las comunidades en una recta (es también la leyenda de colores)
  function tira() {
    const cont = $("tira");
    const W = cont.clientWidth || 600;
    const r = W < 500 ? 6 : 7;
    const m = { l: 10, r: 10 };
    const x = d3.scaleLinear().domain([Math.floor(barato.v - 1), Math.ceil(caro.v + 1)]).range([m.l, W - m.r]);
    // Apilar puntos que se tocan
    const orden = [...filas].sort((a, b) => a.v - b.v);
    const pos = [];
    orden.forEach((f) => {
      let nivel = 0;
      while (pos.some((p) => p.nivel === nivel && Math.abs(x(p.f.v) - x(f.v)) < 2 * r + 1)) nivel++;
      pos.push({ f, nivel });
    });
    const maxNivel = d3.max(pos, (p) => p.nivel);
    const arriba = 26, y0 = arriba + 6 + (maxNivel + 1) * (2 * r + 1);
    const H = y0 + 34;
    const ticks = x.ticks(W < 500 ? 4 : 6);
    const sel = seleccion ? porId.get(seleccion) : null;
    const selPos = sel ? pos.find((p) => p.f === sel) : null;
    let s = `<line class="base" x1="${m.l}" x2="${W - m.r}" y1="${y0 + 2}" y2="${y0 + 2}"/>`;
    s += ticks.map((t) => `<text x="${x(t)}" y="${y0 + 18}" text-anchor="middle">${t} €</text>`).join("");
    s += `<line class="media" x1="${x(media)}" x2="${x(media)}" y1="${arriba - 22}" y2="${y0 + 2}"/>`;
    const mediaDer = x(media) + 120 < W;
    s += `<text x="${x(media) + (mediaDer ? 6 : -6)}" y="${arriba - 10}" text-anchor="${mediaDer ? "start" : "end"}">Media nacional: <tspan class="fuerte">${eur2(media)}</tspan></text>`;
    s += pos.map((p) => `<circle class="punto${p.f === sel ? " sel" : ""}" data-id="${p.f.c.id}" cx="${x(p.f.v)}" cy="${y0 - r - p.nivel * (2 * r + 1)}" r="${r}" style="fill:${colorDe(p.f.v)}"><title>${esc(p.f.c.nombre)}: ${eur2(p.f.v)}</title></circle>`).join("");
    s += `<text x="${m.l}" y="${y0 + 32}" text-anchor="start">← más barato</text><text x="${W - m.r}" y="${y0 + 32}" text-anchor="end">más caro →</text>`;
    if (selPos) {
      const cx = x(sel.v), cy = y0 - r - selPos.nivel * (2 * r + 1);
      const anc = cx < 90 ? "start" : cx > W - 90 ? "end" : "middle";
      s += `<text class="fuerte" x="${cx}" y="${Math.max(cy - r - 6, arriba - 6)}" text-anchor="${anc}" style="paint-order:stroke;stroke:var(--plano);stroke-width:4px">${esc(corto(sel.c.nombre))}</text>`;
    }
    cont.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Coste por habitante de cada comunidad, de menor a mayor">${s}</svg>`;
    cont.querySelectorAll(".punto").forEach((c) => {
      const f = porId.get(c.dataset.id);
      c.addEventListener("pointermove", (ev) => C.tip(ev, tipCcaa(f)));
      c.addEventListener("pointerleave", C.ocultarTip);
      c.addEventListener("click", () => elegir(f.c.id));
    });
  }

  function ficha() {
    const f = seleccion ? porId.get(seleccion) : null;
    const ver = $("ver-ccaa");
    if (!f) {
      $("ficha").innerHTML = `<div class="nombre">Media nacional</div>
        <div class="valor">${eur2(media)} <small>por habitante y año</small></div>
        <div class="comp">Con el Gobierno central y las Cortes (${eur2(estado / pob)}) salen los <b>${eur2(porPersona)}</b> del principio.</div>
        <div class="vacia"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10"/><path d="M12 10V8.5a1.5 1.5 0 0 1 3 0V11"/><path d="M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.8-2.4L4 15.5a1.5 1.5 0 0 1 2.3-1.9L9 16"/></svg>
        <span>Toca tu comunidad en el mapa para compararla.</span></div>`;
      ver.innerHTML = `Ver todas las comunidades <span aria-hidden="true">→</span>`;
      ver.href = RAIZ + "comunidades.html";
      return;
    }
    const d = f.v / media - 1;
    $("ficha").innerHTML = `<div class="nombre">${esc(f.c.nombre)}</div>
      <div class="valor">${eur2(f.v)} <small>por habitante y año</small></div>
      <div class="comp">${Math.abs(d) < 0.005 ? "<b>En la media</b> nacional" : `<b>${pct(Math.abs(d))} ${d > 0 ? "más" : "menos"}</b> que la media nacional (${eur2(media)})`}</div>
      ${f.c.faltan.length ? `<div class="nota">* Faltan datos de su parlamento: la cifra real es algo mayor.</div>` : ""}`;
    ver.innerHTML = `Ver la ficha de ${esc(corto(f.c.nombre))} <span aria-hidden="true">→</span>`;
    ver.href = RAIZ + "comunidades.html#c=" + f.c.id;
  }

  function elegir(id) {
    seleccion = id && porId.has(id) ? id : null;
    guardar("cp-comunidad", seleccion || "");
    $("elige-ccaa").value = seleccion || "";
    formas.classed("sel", (f) => f.id === seleccion);
    if (seleccion) formas.filter((f) => f.id === seleccion).raise();
    ficha();
    tira();
  }
  $("elige-ccaa").innerHTML = `<option value="">Elige…</option>` +
    [...CC].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("");
  $("elige-ccaa").addEventListener("change", (e) => elegir(e.target.value));
  $("lista-ccaa").innerHTML = filas.map((f) => `<li><span>${esc(f.c.nombre)}${f.c.faltan.length ? " *" : ""}</span><span>${eur2(f.v)}</span></li>`).join("");
  if (filas.some((f) => f.c.faltan.length)) $("lista-ccaa").insertAdjacentHTML("afterend", `<p class="fuente">* Faltan datos de su parlamento: la cifra real es algo mayor.</p>`);

  // ---------------- 3 · Gobierno central ----------------
  const serie = hist.estado.filter((r) => r.factor_ipc);
  const valG = (r) => (r.gobierno_altos + r.gobierno_asesores) * r.factor_ipc;
  // Tramos según quién elaboró el presupuesto (un presupuesto prorrogado sigue siendo del Gobierno que lo hizo)
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
  const minMin = d3.min(serie, (r) => r.ministerios), maxMin = d3.max(serie, (r) => r.ministerios);
  $("t3").textContent = `Con cada presidente cambia el tamaño del Gobierno: de ${minMin} a ${maxMin} ministerios`;
  const lista = (xs) => xs.length > 1 ? xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1] : xs[0];
  $("e3").textContent = "Lo que cuestan cada año los altos cargos y asesores de los ministerios, ya descontada la inflación.";
  // Resumen del gráfico para lectores de pantalla
  $("g-gobierno").setAttribute("aria-label", `Media al año en millones de euros de ${hist.base_ipc}: ` +
    lista(tramos.map((t) => `${millones(t.media)} con ${apellido(t.p)} (${t.minM === t.maxM ? t.minM : t.minM + " a " + t.maxM} ministerios)`)) + ".");
  $("g3-t").textContent = `Altos cargos y asesores de los ministerios, en millones de euros de ${hist.base_ipc}`;
  // Años en que gobernaba un presidente con el presupuesto de otro (sale de los datos, no se escribe a mano)
  const cruzados = serie.filter((r) => r.gobierna !== r.autor);
  const cruce = cruzados.length
    ? ` De ${cruzados[0].anyo} a ${cruzados[cruzados.length - 1].anyo} gobernaba ${esc(apellido(cruzados[0].gobierna))} con el presupuesto de ${esc(apellido(cruzados[0].autor))}.` : "";
  $("f3").innerHTML = `Es lo presupuestado cada año, no lo gastado. Rayado: año sin presupuesto nuevo, se repite el anterior.${cruce} ` +
    `Fuente: ${hist.fuentes.map((f) => `<a href="${f.url}" target="_blank" rel="noopener">${esc(f.texto)}</a>`).join(" · ")}.`;

  $("lista-gob").innerHTML = serie.map((r) => `<li><span>${r.anyo}${r.prorrogado ? " (prorrogado)" : ""}</span>` +
    `<span>${fmt1.format(valG(r) / 1e6)} millones · ${r.ministerios} ministerios</span></li>`).join("");

  function graficoGobierno() {
    const svg = d3.select("#g-gobierno");
    const W = svg.node().getBoundingClientRect().width || 640;
    const movil = W < 520;
    const H = movil ? 250 : 290;
    const m = { t: movil ? 50 : 64, r: 4, b: 26, l: 30 };
    svg.attr("viewBox", `0 0 ${W} ${H}`).selectAll("*").remove();
    const x = d3.scaleBand().domain(serie.map((r) => r.anyo)).range([m.l, W - m.r]).paddingInner(0.3).paddingOuter(0.15);
    const y = d3.scaleLinear().domain([0, d3.max(serie, valG) * 1.08]).nice().range([H - m.b, m.t]);
    const bw = Math.min(24, x.bandwidth());
    const off = (x.bandwidth() - bw) / 2;
    const paso = x.step();
    const defs = svg.append("defs");
    defs.append("pattern").attr("id", "rayado").attr("width", 6).attr("height", 6).attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(45)")
      .append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 6).style("stroke", "var(--plano)").attr("stroke-width", 2.6);

    // Bandas por presidente
    tramos.forEach((t, i) => {
      const x0 = x(t.rs[0].anyo) - (paso - x.bandwidth()) / 2, x1 = x(t.rs[t.rs.length - 1].anyo) + x.bandwidth() + (paso - x.bandwidth()) / 2;
      if (i % 2 === 0) svg.append("rect").attr("class", "banda").attr("x", x0).attr("width", x1 - x0).attr("y", 0).attr("height", H - m.b).attr("rx", 6);
      svg.append("text").attr("class", "banda-n").attr("x", (x0 + x1) / 2).attr("y", 18).attr("text-anchor", "middle").text(apellido(t.p));
      svg.append("text").attr("class", "banda-v").attr("x", (x0 + x1) / 2).attr("y", 34).attr("text-anchor", "middle")
        .text(movil ? `media: ${mEje(t.media)}` : `media: ${mEje(t.media)} millones`);
      if (!movil) svg.append("text").attr("class", "banda-v").attr("x", (x0 + x1) / 2).attr("y", 50).attr("text-anchor", "middle")
        .text(`${t.minM === t.maxM ? t.minM : t.minM + "–" + t.maxM} ministerios`);
    });
    // Rejilla
    const ticks = y.ticks(3);
    svg.append("g").selectAll("line").data(ticks.filter((t) => t > 0)).join("line").attr("class", "rejilla-y")
      .attr("x1", m.l).attr("x2", W - m.r).attr("y1", (t) => y(t)).attr("y2", (t) => y(t));
    svg.append("g").selectAll("text").data(ticks).join("text").attr("class", "eje-t")
      .attr("x", m.l - 6).attr("y", (t) => y(t) + 4).attr("text-anchor", "end").text((t) => mEje(t));
    svg.append("line").attr("class", "linea-base").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(0)).attr("y2", y(0));
    // Columnas: extremo superior redondeado, base recta
    const col = svg.append("g");
    serie.forEach((r) => {
      const xx = x(r.anyo) + off, yy = y(valG(r)), h = y(0) - yy, rr = Math.min(4, h, bw / 2);
      const g = col.append("g").attr("class", "col");
      g.append("path").style("fill", "var(--c-1)").attr("opacity", r.prorrogado ? 0.55 : 1)
        .attr("d", `M${xx},${yy + h}V${yy + rr}Q${xx},${yy} ${xx + rr},${yy}H${xx + bw - rr}Q${xx + bw},${yy} ${xx + bw},${yy + rr}V${yy + h}Z`);
      if (r.prorrogado) g.append("rect").attr("x", xx).attr("y", yy).attr("width", bw).attr("height", h).style("fill", "url(#rayado)");
    });
    // Media de cada presidente sobre sus presupuestos propios
    tramos.forEach((t) => {
      const a = t.propios[0], b = t.propios[t.propios.length - 1];
      svg.append("line").attr("class", "media-l").attr("x1", x(a.anyo) - 3).attr("x2", x(b.anyo) + x.bandwidth() + 3).attr("y1", y(t.media)).attr("y2", y(t.media));
    });
    // Eje X
    const ult = serie[serie.length - 1].anyo;
    const marcas = serie.map((r) => r.anyo).filter((a) => a === serie[0].anyo || a === ult || (a % 5 === 0 && ult - a >= (movil ? 3 : 2)));
    svg.append("g").selectAll("text").data(marcas).join("text").attr("class", "eje-t")
      .attr("x", (a) => x(a) + x.bandwidth() / 2).attr("y", H - 8).attr("text-anchor", "middle").text((a) => a);
    // Zonas de toque: toda la columna
    serie.forEach((r) => {
      svg.append("rect").attr("class", "hit").attr("x", x(r.anyo) - (paso - x.bandwidth()) / 2).attr("width", paso).attr("y", m.t - 8).attr("height", H - m.b - m.t + 8)
        .on("pointermove", (ev) => C.tip(ev, `<b>${r.anyo} · ${fmt1.format(valG(r) / 1e6)} millones</b>` +
          `Altos cargos: ${fmt1.format((r.gobierno_altos * r.factor_ipc) / 1e6)} · asesores: ${fmt1.format((r.gobierno_asesores * r.factor_ipc) / 1e6)}<br>` +
          `<span class="t2">${r.ministerios} ministerios · ${r.prorrogado ? `presupuesto de ${r.prorrogado} prorrogado` : `presupuesto del Gobierno de ${esc(apellido(r.autor))}`}` +
          `${r.gobierna !== r.autor ? ` · gobernaba ${esc(apellido(r.gobierna))}` : ""} · euros de ${hist.base_ipc}</span>`))
        .on("pointerleave", C.ocultarTip);
    });
  }

  // ---------------- 4 · Quién cobra más ----------------
  const D = hist.sueldos.detalle;
  const presi = D.cargos.find((c) => c.cargo === "Presidente del Gobierno");
  const mas = D.cargos.filter((c) => c.anual > presi.anual);
  const maestro = D.referencias.funcionario_A2_22;
  const minus = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  $("t4").textContent = `${mas.length} cargos públicos cobran más que el presidente del Gobierno`;
  const todosOrganos = mas.every((c) => /^Órganos/.test(c.grupo));
  $("e4").innerHTML = `El presidente cobra <b>${eur(presi.anual)}</b> brutos al año. ` +
    `${todosOrganos ? "Por encima, cargos de tribunales y órganos del Estado; el" : "El"} que más, el ${minus(mas[0].cargo)}: <b>${eur(mas[0].anual)}</b>.`;
  $("g4-t").textContent = `Sueldos fijados por ley en ${D.anyo}, euros brutos al año`;
  $("lista-sueldos-t").textContent = `Ver los ${mas.length} cargos que cobran más`;
  $("lista-sueldos").innerHTML = [...mas, presi].map((c) => `<li class="${c === presi ? "ref" : ""}"><span>${esc(c.cargo)}</span><span>${eur(c.anual)}</span></li>`).join("");

  function graficoSueldos() {
    const svg = d3.select("#g-sueldos");
    const W = svg.node().getBoundingClientRect().width || 640;
    const movil = W < 520;
    const r = movil ? 5.5 : 8;
    const m = { l: 6, r: 10 };
    const x = d3.scaleLinear().domain([0, mas[0].anual * 1.03]).range([m.l, W - m.r]);
    const puntos = [
      ...D.cargos.map((c) => ({ c, v: c.anual, tipo: c === presi ? "presi" : c.anual > presi.anual ? "mas" : "menos" })),
      { c: { cargo: "Maestro o enfermero (sueldo básico)", grupo: maestro.texto }, v: maestro.anual, tipo: "ref" },
    ].sort((a, b) => a.v - b.v);
    // Apilar puntos que se tocan
    const colocados = [];
    puntos.forEach((p) => {
      const rr = p.tipo === "presi" ? r + 2.5 : r;
      let nivel = 0;
      while (colocados.some((q) => q.nivel === nivel && Math.abs(x(q.v) - x(p.v)) < rr + q.rr + 1.5)) nivel++;
      colocados.push({ ...p, nivel, rr });
    });
    const maxNivel = d3.max(colocados, (p) => p.nivel);
    const arriba = 34, y0 = arriba + (movil ? 14 : 30) + (maxNivel + 1) * (2 * r + 2);
    const H = y0 + 28;
    svg.attr("viewBox", `0 0 ${W} ${H}`).selectAll("*").remove();
    const xp = x(presi.anual);
    svg.append("rect").attr("class", "zona").attr("x", xp).attr("y", arriba - 30).attr("width", W - xp).attr("height", y0 - arriba + 30).attr("rx", 6);
    svg.append("line").attr("class", "ref-l").attr("x1", xp).attr("x2", xp).attr("y1", arriba - 30).attr("y2", y0);
    // Rótulos de la línea
    const t1 = svg.append("text").attr("class", "et").attr("x", xp - 8).attr("y", arriba - 14).attr("text-anchor", "end");
    t1.append("tspan").attr("class", "et-f").text("Presidente del Gobierno");
    t1.append("tspan").attr("x", xp - 8).attr("dy", 16).text(eur(presi.anual));
    const t2 = svg.append("text").attr("class", "et").attr("x", xp + 8).attr("y", arriba - 14).attr("text-anchor", "start");
    t2.append("tspan").attr("class", "et-f").text(`${mas.length} cargos cobran más`);
    t2.append("tspan").attr("x", xp + 8).attr("dy", 16).text(`hasta ${eur(mas[0].anual)}`);
    // Eje
    svg.append("line").attr("class", "linea-base").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y0 + 1).attr("y2", y0 + 1);
    const ticks = movil ? [0, 50000, 100000, 150000] : [0, 25000, 50000, 75000, 100000, 125000, 150000];
    svg.append("g").selectAll("text").data(ticks).join("text").attr("class", "eje-t")
      .attr("x", (t) => x(t)).attr("y", y0 + 18).attr("text-anchor", (t) => (t === 0 ? "start" : "middle"))
      .text((t) => (t === 0 ? "0 €" : C.fmtEnt.format(t) + " €"));
    // Puntos
    const COLOR = { presi: "var(--tinta)", mas: "var(--c-1)", menos: "var(--gris-dato)", ref: "var(--c-3)" };
    colocados.forEach((p) => {
      const cy = y0 - p.rr - 1 - p.nivel * (2 * r + 2);
      const g = svg.append("g");
      const punto = p.tipo === "ref"
        ? g.append("rect").attr("class", "dot").attr("x", x(p.v) - r).attr("y", cy - r).attr("width", 2 * r).attr("height", 2 * r).attr("transform", `rotate(45 ${x(p.v)} ${cy})`)
        : g.append("circle").attr("class", "dot").attr("cx", x(p.v)).attr("cy", cy).attr("r", p.rr);
      punto.style("fill", COLOR[p.tipo]);
      g.append("circle").attr("class", "hit").attr("cx", x(p.v)).attr("cy", cy).attr("r", Math.max(12, p.rr + 4))
        .on("pointermove", (ev) => { punto.classed("hov", true); C.tip(ev, `<b>${eur(p.v)}</b>${esc(p.c.cargo)}<br><span class="t2">${esc(p.c.grupo)}</span>`); })
        .on("pointerleave", () => { punto.classed("hov", false); C.ocultarTip(); });
    });
    // Leyenda (identidad por forma y color, con los valores clave)
    $("leyenda-sueldos") && $("leyenda-sueldos").remove();
    svg.node().insertAdjacentHTML("afterend", `<ul class="leyenda-s" id="leyenda-sueldos">
      <li><i style="background:var(--c-1)"></i>Cobran más que el presidente</li>
      <li><i style="background:var(--tinta)"></i>Presidente del Gobierno</li>
      <li><i style="background:var(--gris-dato)"></i>Vicepresidente, ministros y otros altos cargos</li>
      <li><i class="rombo" style="background:var(--c-3)"></i>Maestro o enfermero: ${eur(maestro.anual)}</li></ul>`);
  }

  // Poder de compra del sueldo del presidente desde la primera ley disponible
  function poder() {
    const s = hist.sueldos.serie.filter((r) => r.factor_ipc && r.presidente);
    const a = s[0], b = s[s.length - 1];
    const real = (r) => r.presidente * r.factor_ipc;
    const cambio = real(b) / real(a) - 1;
    $("poder").innerHTML = `<p></p><svg></svg>`;
    const W = Math.max(200, $("poder").querySelector("svg").getBoundingClientRect().width || 300), H = 104, m = { t: 24, r: 8, b: 20, l: 8 };
    const x = d3.scaleLinear().domain([a.anyo, b.anyo]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, real(a) * 1.05]).range([H - m.b, m.t]);
    const linea = d3.line().x((r) => x(r.anyo)).y((r) => y(real(r)))(s);
    const area = d3.area().x((r) => x(r.anyo)).y0(H - m.b).y1((r) => y(real(r)))(s);
    $("poder").innerHTML = `<p><span class="big">${cambio < 0 ? "−" : "+"}${pct(Math.abs(cambio))}</span>
        Lo que ha ${cambio < 0 ? "perdido" : "ganado"} el sueldo del presidente desde ${a.anyo}, descontada la inflación (en euros de ${hist.base_ipc}).</p>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sueldo del presidente del Gobierno sin efecto de la inflación, ${a.anyo}-${b.anyo}">
        <path class="a" d="${area}"/><path class="l" d="${linea}"/>
        <circle class="p" cx="${x(a.anyo)}" cy="${y(real(a))}" r="4.5"/><circle class="p" cx="${x(b.anyo)}" cy="${y(real(b))}" r="4.5"/>
        <text class="f" x="${x(a.anyo)}" y="${y(real(a)) - 10}">${eur(real(a))}</text>
        <text class="f" x="${x(b.anyo)}" y="${y(real(b)) - 10}" text-anchor="end">${eur(real(b))}</text>
        <text x="${x(a.anyo)}" y="${H - 4}">${a.anyo}</text><text x="${x(b.anyo)}" y="${H - 4}" text-anchor="end">${b.anyo}</text>
      </svg>`;
    $("f4").innerHTML = `Fuente: <a href="${D.url}" target="_blank" rel="noopener">${esc(D.ley)}, de Presupuestos Generales del Estado para ${D.anyo}</a> (BOE) y leyes de presupuestos desde ${a.anyo}. Sueldos brutos fijados por ley, sin dietas ni cotizaciones.`;
  }

  // ---------------- 5 · Para hacerse una idea ----------------
  const R = D.referencias;
  const PROF = [
    { id: "a2", txt: "maestros o enfermeros", boton: "Maestros o enfermeros", ref: R.funcionario_A2_22 },
    { id: "a1", txt: "médicos o profesores de secundaria", boton: "Médicos o profesores", ref: R.funcionario_A1_24 },
    { id: "c1", txt: "administrativos", boton: "Administrativos", ref: R.funcionario_C1_18 },
  ];
  let prof = PROF[0];
  const POR_ICONO = 1000;
  $("profesiones").innerHTML = PROF.map((p) => `<button type="button" data-p="${p.id}" aria-pressed="${p === prof}">${p.boton}</button>`).join("");
  $("profesiones").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    prof = PROF.find((p) => p.id === b.dataset.p);
    $("profesiones").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    personas();
  });
  const PERSONA = "M10 0a5.2 5.2 0 1 1 0 10.4A5.2 5.2 0 0 1 10 0zM3 30V19.5C3 15 5.8 12.4 9 12.4h2c3.2 0 6 2.6 6 7.1V30z";
  function personas() {
    const n = Math.floor(total / prof.ref.anual);
    $("t5").innerHTML = `Con ese dinero se pagaría el sueldo básico de <span class="num">${C.fmtEnt.format(n)}</span> ${prof.txt}`;
    $("e5").innerHTML = `Los <b>${millones(total)} de euros</b> al año, medidos con algo conocido. Solo para hacerse una idea.`;
    const cont = $("personas");
    const W = cont.clientWidth || 600;
    const iconos = n / POR_ICONO;
    const cols = W < 500 ? 12 : 16;
    const cw = W / cols, ch = cw * 1.45;
    const k = (cw * 0.72) / 20;
    let s = "";
    const total_i = Math.ceil(iconos);
    for (let i = 0; i < total_i; i++) {
      const col = i % cols, fila = Math.floor(i / cols);
      const tx = col * cw + (cw - 20 * k) / 2, ty = fila * ch + (ch - 30 * k) / 2;
      const frac = Math.min(1, iconos - i);
      const ret = `style="animation-delay:${i * 12}ms"`;
      if (frac >= 0.995) s += `<g class="mon" ${ret}><path class="pers" transform="translate(${tx} ${ty}) scale(${k})" d="${PERSONA}"/></g>`;
      else s += `<clipPath id="clip-p${i}"><rect x="0" y="0" width="${20 * frac}" height="30"/></clipPath>
        <g class="mon" ${ret}><g transform="translate(${tx} ${ty}) scale(${k})"><path class="pers-hueco" d="${PERSONA}"/><path class="pers" clip-path="url(#clip-p${i})" d="${PERSONA}"/></g></g>`;
    }
    const H = Math.ceil(total_i / cols) * ch;
    cont.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${s}</svg>`;
    cont.setAttribute("aria-label", `${C.fmtEnt.format(n)} ${prof.txt}; cada figura, ${C.fmtEnt.format(POR_ICONO)} personas`);
    $("escala").innerHTML = `<svg viewBox="0 0 20 30" aria-hidden="true"><path d="${PERSONA}"/></svg> Cada figura = ${C.fmtEnt.format(POR_ICONO)} personas · sueldo básico de ${eur(prof.ref.anual)} brutos al año`;
    $("f5").innerHTML = `${esc(prof.ref.texto)}. ${esc(R.nota)} Fuente: <a href="${D.url}" target="_blank" rel="noopener">${esc(D.ley)}</a> (BOE).`;
  }

  // ---------------- Pie y menú ----------------
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const [ga, gm, gd] = datos.generado.split("-");
  $("pie").innerHTML = `Datos de ${datos.anyo}, actualizados el ${+gd} de ${MESES[+gm - 1]} de ${ga}. Población: <a href="${datos.poblacion.url}" target="_blank" rel="noopener">${esc(datos.poblacion.fuente)}</a>. ` +
    `Prototipo de portada · propuesta A.`;
  $("cab-boton").addEventListener("click", () => {
    const abierta = document.querySelector(".cab").classList.toggle("abierta");
    $("cab-boton").setAttribute("aria-expanded", String(abierta));
  });

  // ---------------- Barra de la historia: aparece al dejar la portada y marca el paso actual ----------------
  (function progreso() {
    const barra = $("progreso");
    const indice = document.querySelector(".indice");
    $("progreso-cifra").innerHTML = `<span class="moneda-ico" aria-hidden="true"></span>${eur2(porPersona)} por persona`;
    const enlaces = [...barra.querySelectorAll("ol a")];
    const pasos = enlaces.map((a) => document.querySelector(a.getAttribute("href")));
    function actualizar() {
      const visible = indice.getBoundingClientRect().bottom < 0;
      barra.classList.toggle("visible", visible);
      barra.toggleAttribute("inert", !visible);
      const ref = window.innerHeight * 0.45;
      let actual = -1;
      pasos.forEach((p, i) => { if (p.getBoundingClientRect().top <= ref) actual = i; });
      enlaces.forEach((a, i) => {
        if (i === actual) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current");
        a.classList.toggle("hecho", i < actual);
      });
    }
    let pendiente = false;
    window.addEventListener("scroll", () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => { pendiente = false; actualizar(); });
    }, { passive: true });
    actualizar();
  })();

  // ---------------- Pintar y redibujar ----------------
  function pintar() {
    niveles();
    tira();
    graficoGobierno();
    graficoSueldos();
    poder();
    personas();
    ajustarMapa();
  }
  ficha();
  pintar();

  // Las monedas y las figuras «caen» cuando el lector llega a ellas (solo si no pide menos movimiento)
  if (!reducido && "IntersectionObserver" in window) {
    const vistos = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (!e.isIntersecting) return;
        vistos.unobserve(e.target);
        e.target.classList.remove("espera");
        e.target.classList.add("anima");
        setTimeout(() => e.target.classList.remove("anima"), 1800);
      });
    }, { threshold: 0.25 });
    ["niveles", "personas"].forEach((id) => {
      const el = $(id), b = el.getBoundingClientRect();
      if (b.top > window.innerHeight) { el.classList.add("espera"); vistos.observe(el); }
    });
  }
  const previa = leer("cp-comunidad");
  if (previa && porId.has(previa)) elegir(previa);
  let espera;
  let anchoPrevio = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === anchoPrevio) return;
    anchoPrevio = window.innerWidth;
    clearTimeout(espera);
    espera = setTimeout(pintar, 120);
  });
})();
