// Gobierno central: resumen, comparación del Gobierno actual con los anteriores, ministerios, sueldos y Cortes.
// Todo el texto explicativo vive en fuentes.html; aquí solo cifras, barras y frases cortas.
(async function () {
  "use strict";

  // ---- Pestañas (la elegida queda en la dirección: gobierno.html#este) ----
  const TABS = ["resumen", "este", "ministerios", "sueldos", "cortes"];
  const ALIAS = { evolucion: "este" };   // direcciones antiguas
  function mostrar(tab, desplazar) {
    tab = ALIAS[tab] || tab;
    if (!TABS.includes(tab)) tab = "resumen";
    TABS.forEach((t) => {
      document.getElementById("p-" + t).hidden = t !== tab;
      const b = document.querySelector(`[data-tab="${t}"]`);
      b.setAttribute("aria-selected", String(t === tab));
      b.tabIndex = t === tab ? 0 : -1;
    });
    history.replaceState(null, "", "#" + tab);
    const activa = document.querySelector(`[data-tab="${tab}"]`), fila = activa.parentElement;
    fila.scrollLeft = activa.offsetLeft - (fila.clientWidth - activa.offsetWidth) / 2;
    window.dispatchEvent(new Event("resize"));   // los gráficos se dibujan con el ancho del panel visible
    if (desplazar) window.scrollTo({ top: 0, behavior: "smooth" });
  }
  document.querySelectorAll("[data-tab]").forEach((b) => {
    b.addEventListener("click", () => mostrar(b.dataset.tab));
    b.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      const sig = TABS[(TABS.indexOf(b.dataset.tab) + d + TABS.length) % TABS.length];
      mostrar(sig);
      document.querySelector(`[data-tab="${sig}"]`).focus();
    });
  });
  window.addEventListener("hashchange", () => mostrar(location.hash.slice(1), true));
  mostrar(location.hash.slice(1));

  const [datos, hist] = await Promise.all([C.json("datos.json"), C.json("historico.json")]);
  const est = datos.estado, serie = hist.estado;
  const suma = (t) => est.partes[t].altos + est.partes[t].eventual;
  const ESCANOS = { congreso: 350, senado: 266 };
  const G = C.comparaGobiernos(serie);
  const { real, media, propios, autores, actual, anterior, A, B, ultB, prorrogados, prorrogadosB, anyosB, apellido, rango } = G;
  const COMPARA = G.compara, pctTxt = C.pctCambio, extra = G.extra;
  const maestro = hist.sueldos.detalle.referencias.funcionario_A2_22.anual;

  // ---- Resumen ----
  const partes = [
    ["Altos cargos de los ministerios", est.partes.gobierno.altos, "--c-1"],
    ["Asesores de los ministerios", est.partes.gobierno.eventual, "--c-2"],
    ["Congreso", suma("congreso"), "--c-3"],
    ["Senado", suma("senado"), "--c-4"],
  ];
  const total = partes.reduce((s, p) => s + p[1], 0);
  document.getElementById("r-cifra").textContent = C.eur2(total / datos.poblacion.total);
  document.getElementById("r-total").textContent = `${C.millones(total)} en ${datos.anyo}`;
  document.getElementById("r-pila").innerHTML = partes.map(([n, v, col]) => `<span style="flex:${v};background:var(${col})" title="${n}"></span>`).join("");
  document.getElementById("r-partes").innerHTML = partes.map(([n, v, col]) =>
    `<div><i class="mu" style="background:var(${col})"></i><span>${n}</span><b>${C.millones(v)}</b></div>`).join("");
  document.getElementById("r-alertas").innerHTML = C.alertasGobierno(G);
  document.getElementById("r-calc").innerHTML = C.icono("calculadora");
  document.getElementById("r-info").innerHTML = C.masInfo("gobierno");

  // ---- Este Gobierno ----
  document.getElementById("e-titulo").textContent = `Gobierno de ${actual} frente al de ${anterior}`;
  document.getElementById("e-sub").textContent = `Sus presupuestos (${rango(B)}) frente a los anteriores (${rango(A)}). Sin efecto de la inflación.`;
  document.getElementById("e-comparaciones").innerHTML = COMPARA.map((k) => {
    const sube = k.b > k.a, max = Math.max(k.a, k.b);
    return `<div class="comparacion${sube ? " sube" : ""}">
      <div class="comp-cab"><span>${k.t}</span><b class="delta">${sube ? "▲" : "▼"} ${pctTxt(k.a, k.b)}</b></div>
      <div class="comp-fila"><span>${apellido(anterior)}</span><span class="pista"><span style="width:${(k.a / max) * 100}%"></span></span><b>${k.f(k.a)}</b></div>
      <div class="comp-fila ahora"><span>${apellido(actual)}</span><span class="pista"><span style="width:${(k.b / max) * 100}%"></span></span><b>${k.f(k.b)}</b></div>
      ${k.nota ? `<div class="comp-nota">${k.nota}</div>` : ""}
    </div>`;
  }).join("") +
  `<div class="comparacion sube">
    <div class="comp-cab"><span>Años sin presupuesto nuevo</span><b class="delta">${prorrogadosB.length} de ${anyosB}</b></div>
    <div class="anyos">${serie.map((r) => `<span class="${r.prorrogado ? "prorrogado" : ""}${r.gobierna === actual ? " actual" : ""}" title="${r.anyo}${r.prorrogado ? ": prorrogado" : ""}">${String(r.anyo).slice(2)}</span>`).join("")}</div>
    <div class="comp-nota">${prorrogados.length === prorrogadosB.length ? `Desde 2007, ningún otro Gobierno pasó un año entero sin presupuesto nuevo` : ""}</div>
  </div>`;
  document.getElementById("e-extra").innerHTML = `
    <div class="det">Gasto de más cada año frente al Gobierno anterior</div>
    <div class="gran-cifra">${C.millones(extra)}</div>
    <div class="det">Con eso se pagaría el sueldo básico de <b>${C.fmtEnt.format(Math.round(extra / maestro))} maestros o enfermeros</b> · <a href="calculadora.html">haz tus cuentas</a></div>`;

  // Media anual de cada Gobierno (presupuestos propios, sin inflación)
  const medias = autores.map((p) => ({ p, rs: propios(p) })).filter((g) => g.rs.length)
    .map((g) => ({ ...g, v: media(g.rs, (r) => real(r, "nucleo")) }));
  const maxM = Math.max(...medias.map((g) => g.v));
  document.getElementById("e-medias-sub").textContent = `Altos cargos, asesores y Cortes · euros de ${hist.base_ipc}`;
  document.getElementById("e-medias").innerHTML = medias.map((g) => `
    <div class="barra-gob${g.p === actual ? " actual" : ""}">
      <span class="nom">${apellido(g.p)} <small>${rango(g.rs)}</small></span>
      <span class="pista"><span style="width:${(g.v / maxM) * 100}%"></span></span>
      <b>${C.millones(g.v)}</b>
    </div>`).join("");

  function serieAnual() {
    const svg = d3.select("#e-serie");
    const d = serie.filter((r) => r.factor_ipc);
    const ancho = Math.max(320, svg.node().getBoundingClientRect().width || 900), alto = ancho < 560 ? 220 : 280;
    const m = { t: 18, r: 6, b: 24, l: 46 };
    svg.attr("viewBox", `0 0 ${ancho} ${alto}`).selectAll("*").remove();
    svg.append("defs").append("pattern").attr("id", "rayas").attr("patternUnits", "userSpaceOnUse")
      .attr("width", 5).attr("height", 5).attr("patternTransform", "rotate(45)")
      .append("rect").attr("width", 2).attr("height", 5);
    const x = d3.scaleBand().domain(d.map((r) => r.anyo)).range([m.l, ancho - m.r]).padding(0.25);
    const y = d3.scaleLinear().domain([0, d3.max(d, (r) => real(r, "nucleo")) * 1.1]).nice().range([alto - m.b, m.t]);
    svg.append("g").attr("class", "rejilla-y").selectAll("line").data(y.ticks(4)).join("line").attr("x1", m.l).attr("x2", ancho - m.r).attr("y1", y).attr("y2", y);
    svg.append("g").attr("class", "eje").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat((v) => C.fmtEnt.format(v / 1e6) + " M€").tickSize(0).tickPadding(6)).call((g) => g.select(".domain").remove());
    const cada = ancho < 560 ? 3 : 2;
    svg.append("g").attr("class", "eje").attr("transform", `translate(0,${alto - m.b})`)
      .call(d3.axisBottom(x).tickValues(x.domain().filter((a, i) => i % cada === 0)).tickFormat((a) => "'" + String(a).slice(2)).tickSize(0).tickPadding(6));
    d.forEach((r) => {
      const h = y(0) - y(real(r, "nucleo")), w = x.bandwidth(), rr = Math.min(4, w / 2);
      const xx = x(r.anyo), yy = y(real(r, "nucleo"));
      svg.append("path").attr("class", "barra-anyo" + (r.gobierna === actual ? " actual" : "") + (r.prorrogado ? " prorrogado" : ""))
        .attr("d", `M${xx},${yy + h}V${yy + rr}Q${xx},${yy} ${xx + rr},${yy}H${xx + w - rr}Q${xx + w},${yy} ${xx + w},${yy + rr}V${yy + h}Z`);
      svg.append("rect").attr("class", "marca-hover").attr("x", xx - 2).attr("width", w + 4).attr("y", m.t).attr("height", alto - m.b - m.t)
        .on("mousemove", (ev) => C.tip(ev, `<b>${r.anyo} · ${C.millones(real(r, "nucleo"))}</b>Gobierna ${r.gobierna}${r.prorrogado ? `<br><span class="t2">sin presupuesto nuevo: se repite el de ${r.prorrogado}</span>` : ""}`))
        .on("mouseleave", C.ocultarTip);
    });
    document.getElementById("e-leyenda").innerHTML =
      `<span><i class="mu" style="background:var(--alerta)"></i>${apellido(actual)}</span><span><i class="mu" style="background:var(--gris-barra)"></i>Gobiernos anteriores</span><span><i class="mu rayado"></i>Sin presupuesto nuevo</span>`;
  }
  window.addEventListener("resize", serieAnual);
  serieAnual();
  document.getElementById("e-info").innerHTML = C.masInfo("gobierno");

  // ---- Ministerios ----
  const sel = document.getElementById("m-anyo");
  sel.innerHTML = [...serie].reverse().filter((r) => !r.prorrogado).map((r) => `<option value="${r.anyo}">Presupuesto ${r.anyo}</option>`).join("");
  sel.value = ultB.anyo;
  function ministerios() {
    const r = serie.find((x) => x.anyo === +sel.value);
    const filas = [...r.por_ministerio].sort((a, b) => b.altos + b.asesores - a.altos - a.asesores);
    const max = filas[0].altos + filas[0].asesores;
    document.getElementById("m-lista").innerHTML = filas.map((m) => `
      <div class="barra-doble" tabindex="0" data-n="${C.esc(m.nombre)}">
        <span class="nom">${C.esc(m.nombre)}</span>
        <span class="pista"><span style="width:${(m.altos / max) * 100}%;background:var(--c-1)"></span><span style="width:${(m.asesores / max) * 100}%;background:var(--c-2)"></span></span>
        <span class="v">${C.millones(m.altos + m.asesores)}</span>
      </div>`).join("");
    document.querySelectorAll("#m-lista .barra-doble").forEach((el) => {
      const m = filas.find((x) => x.nombre === el.dataset.n);
      el.addEventListener("mousemove", (ev) => C.tip(ev, `<b>${C.esc(m.nombre)}</b>Altos cargos: ${C.millones(m.altos)}<br>Asesores: ${C.millones(m.asesores)}`));
      el.addEventListener("mouseleave", C.ocultarTip);
    });
  }
  sel.addEventListener("change", ministerios);
  ministerios();
  document.getElementById("m-info").innerHTML = C.masInfo("gobierno");

  // ---- Sueldos ----
  const D = hist.sueldos.detalle, presi = D.cargos.find((c) => c.cargo === "Presidente del Gobierno");
  document.getElementById("s-titulo").textContent = `¿Cuánto cobra cada cargo del Estado? (${D.anyo})`;
  const maxS = D.cargos[0].anual, masQue = D.cargos.filter((c) => c.anual > presi.anual).length;
  document.getElementById("s-resumen").innerHTML = `<b>${masQue} de ${D.cargos.length}</b> cargos cobran más que el presidente del Gobierno (${C.eur(presi.anual)} al año)`;
  document.getElementById("s-ranking").innerHTML = D.cargos.map((c) => `
    <div class="barra-fila${c === presi ? " es-ref" : ""}" tabindex="0">
      <span class="nom">${C.esc(c.cargo)}</span>
      <span class="pista"><span class="bar" style="width:${(c.anual / maxS) * 100}%"></span><span class="ref" style="left:${(presi.anual / maxS) * 100}%"></span></span>
      <span class="v">${C.eur(c.anual)}</span>
    </div>`).join("");
  document.getElementById("s-info").innerHTML = C.masInfo("sueldos");

  function seriePresidente() {
    const svg = d3.select("#s-serie");
    const d = hist.sueldos.serie.filter((r) => r.factor_ipc && r.presidente);
    const ancho = Math.max(320, svg.node().getBoundingClientRect().width || 900), alto = ancho < 560 ? 200 : 240;
    const m = { t: 22, r: 12, b: 24, l: 54 };
    svg.attr("viewBox", `0 0 ${ancho} ${alto}`).selectAll("*").remove();
    const v = (r) => r.presidente * r.factor_ipc;
    const x = d3.scaleLinear().domain(d3.extent(d, (r) => r.anyo)).range([m.l, ancho - m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(d, v) * 1.15]).nice().range([alto - m.b, m.t]);
    svg.append("g").attr("class", "rejilla-y").selectAll("line").data(y.ticks(4)).join("line").attr("x1", m.l).attr("x2", ancho - m.r).attr("y1", y).attr("y2", y);
    svg.append("g").attr("class", "eje").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat((t) => C.fmtEnt.format(t / 1000) + " mil €").tickSize(0).tickPadding(6)).call((g) => g.select(".domain").remove());
    svg.append("g").attr("class", "eje").attr("transform", `translate(0,${alto - m.b})`)
      .call(d3.axisBottom(x).ticks(ancho < 560 ? 4 : 8).tickFormat(d3.format("d")).tickSize(0).tickPadding(6));
    svg.append("path").attr("class", "linea").attr("stroke", "var(--c-1)").attr("d", d3.line().x((r) => x(r.anyo)).y((r) => y(v(r)))(d));
    [d[0], d[d.length - 1]].forEach((r, i) => {
      svg.append("circle").attr("class", "punto").attr("fill", "var(--c-1)").attr("r", 4).attr("cx", x(r.anyo)).attr("cy", y(v(r)));
      svg.append("text").attr("x", x(r.anyo)).attr("y", y(v(r)) - 9).attr("text-anchor", i ? "end" : "start")
        .attr("font-size", 12).attr("font-weight", 600).attr("fill", "var(--tinta)").text(`${C.eur(v(r))} en ${r.anyo}`);
    });
    const guia = svg.append("line").attr("stroke", "var(--eje)").attr("y1", m.t).attr("y2", alto - m.b).style("display", "none");
    svg.append("rect").attr("class", "marca-hover").attr("x", m.l).attr("width", ancho - m.r - m.l).attr("y", m.t).attr("height", alto - m.b - m.t)
      .on("mousemove", (ev) => {
        const a = Math.round(x.invert(d3.pointer(ev)[0]));
        const r = d.reduce((b, c) => (Math.abs(c.anyo - a) < Math.abs(b.anyo - a) ? c : b));
        guia.attr("x1", x(r.anyo)).attr("x2", x(r.anyo)).style("display", null);
        C.tip(ev, `<b>${r.anyo}</b>${C.eur(v(r))} al año<br><span class="t2">en euros de ${hist.base_ipc}</span>`);
      })
      .on("mouseleave", () => { guia.style("display", "none"); C.ocultarTip(); });
  }
  window.addEventListener("resize", seriePresidente);
  seriePresidente();

  // ---- Congreso y Senado ----
  const camara = (k, nombre) => {
    const p = est.partes[k];
    return `<section class="tarjeta camara">
      <div class="det">${nombre} · ${datos.anyo}</div>
      <div class="gran-cifra media">${C.millones(p.altos + p.eventual)}</div>
      <div class="partes">
        <div><span>Sueldos de ${ESCANOS[k]} ${k === "congreso" ? "diputados" : "senadores"}</span><b>${C.millones(p.altos)}</b></div>
        <div><span>Asesores</span><b>${C.millones(p.eventual)}</b></div>
        <div><span>Sueldo medio por escaño</span><b>${C.eur(p.altos / ESCANOS[k])}</b></div>
      </div>
    </section>`;
  };
  document.getElementById("c-camaras").innerHTML = camara("congreso", "Congreso de los Diputados") + camara("senado", "Senado");
  document.getElementById("c-info").innerHTML = C.masInfo("cortes");

  function serieCortes() {
    const svg = d3.select("#c-serie");
    const d = serie.filter((r) => r.factor_ipc);
    const ancho = Math.max(320, svg.node().getBoundingClientRect().width || 900), alto = ancho < 560 ? 220 : 260;
    const m = { t: 14, r: ancho < 560 ? 70 : 90, b: 24, l: 46 };
    svg.attr("viewBox", `0 0 ${ancho} ${alto}`).selectAll("*").remove();
    const x = d3.scaleLinear().domain(d3.extent(d, (r) => r.anyo)).range([m.l, ancho - m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(d, (r) => Math.max(real(r, "congreso"), real(r, "senado"))) * 1.1]).nice().range([alto - m.b, m.t]);
    svg.append("g").attr("class", "rejilla-y").selectAll("line").data(y.ticks(4)).join("line").attr("x1", m.l).attr("x2", ancho - m.r).attr("y1", y).attr("y2", y);
    svg.append("g").attr("class", "eje").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat((v) => C.fmtEnt.format(v / 1e6) + " M€").tickSize(0).tickPadding(6)).call((g) => g.select(".domain").remove());
    svg.append("g").attr("class", "eje").attr("transform", `translate(0,${alto - m.b})`)
      .call(d3.axisBottom(x).ticks(ancho < 560 ? 4 : 8).tickFormat(d3.format("d")).tickSize(0).tickPadding(6));
    [["congreso", "Congreso", "--c-3"], ["senado", "Senado", "--c-4"]].forEach(([k, n, col]) => {
      svg.append("path").attr("class", "linea").attr("stroke", `var(${col})`).attr("d", d3.line().x((r) => x(r.anyo)).y((r) => y(real(r, k)))(d));
      const u = d[d.length - 1];
      svg.append("text").attr("x", x(u.anyo) + 6).attr("y", y(real(u, k)) + 4).attr("font-size", 11).attr("fill", "var(--tinta)").text(`${C.fmtM.format(real(u, k) / 1e6)} M€`);
    });
    const guia = svg.append("line").attr("stroke", "var(--eje)").attr("y1", m.t).attr("y2", alto - m.b).style("display", "none");
    svg.append("rect").attr("class", "marca-hover").attr("x", m.l).attr("width", ancho - m.r - m.l).attr("y", m.t).attr("height", alto - m.b - m.t)
      .on("mousemove", (ev) => {
        const a = Math.round(x.invert(d3.pointer(ev)[0]));
        const r = d.reduce((b, c) => (Math.abs(c.anyo - a) < Math.abs(b.anyo - a) ? c : b));
        guia.attr("x1", x(r.anyo)).attr("x2", x(r.anyo)).style("display", null);
        C.tip(ev, `<b>${r.anyo}</b>Congreso: ${C.millones(real(r, "congreso"))}<br>Senado: ${C.millones(real(r, "senado"))}`);
      })
      .on("mouseleave", () => { guia.style("display", "none"); C.ocultarTip(); });
  }
  window.addEventListener("resize", serieCortes);
  serieCortes();
})();
