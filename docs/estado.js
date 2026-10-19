(async function () {
  "use strict";
  const hist = await C.json("historico.json");
  const COLOR = {
    gobierno_altos: "--c-1", gobierno_asesores: "--c-2", congreso: "--c-3", senado: "--c-4",
    justicia: "--c-5", organos: "--c-7", organismos: "--c-8",
  };
  const CATS = hist.categorias;
  const serieCompleta = hist.estado;
  const estado = { ipc: true, medida: "total", anyo: null };
  document.querySelectorAll(".base-ipc").forEach((e) => (e.textContent = hist.base_ipc));

  // Valor mostrado según los controles (sin inflación: euros del año base; por habitante: / población)
  const serie = () => serieCompleta.filter((r) => !estado.ipc || r.factor_ipc);
  const valor = (r, k) => {
    let v = k === "total" ? r.total : r[k];
    if (estado.ipc) v *= r.factor_ipc;
    if (estado.medida === "hab") v /= r.poblacion;
    return v;
  };
  const fmt = (v) => (estado.medida === "hab" ? C.eur2(v) : C.millones(v));
  const fmtEje = (v) => (estado.medida === "hab" ? C.fmtEur.format(v) + " €" : C.fmtEnt.format(v / 1e6) + " M€");

  // ---- KPIs ----
  function kpis() {
    const propio = [...serieCompleta].reverse().find((r) => !r.prorrogado);
    const ini = serieCompleta[0];
    const real = (r) => r.total * r.factor_ipc;
    document.getElementById("kpis").innerHTML = `
      <div class="kpi"><div class="et">Último presupuesto aprobado (${propio.anyo})</div><div class="val">${C.millones(propio.total)}</div><div class="det">altos cargos, asesores y Cortes</div></div>
      <div class="kpi"><div class="et">Por habitante</div><div class="val">${C.eur2(propio.total / propio.poblacion)}</div><div class="det">al año, en ${propio.anyo}</div></div>
      <div class="kpi"><div class="et">Ministerios</div><div class="val">${propio.ministerios}</div><div class="det">${ini.ministerios} en ${ini.anyo}</div></div>
      <div class="kpi"><div class="et">Frente a ${ini.anyo}, sin inflación</div><div class="val">${real(propio) >= real(ini) ? "+" : ""}${C.pct(real(propio) / real(ini) - 1)}</div><div class="det">${C.millones(real(ini))} → ${C.millones(real(propio))} (€ de ${hist.base_ipc})</div></div>`;
  }

  // ---- Gráfico principal: barras apiladas por categoría ----
  const svg = d3.select("#grafico");
  function grafico() {
    const datos = serie();
    const ancho = Math.max(320, svg.node().getBoundingClientRect().width || 900);
    const alto = ancho < 560 ? 300 : 360;
    const m = { t: 26, r: 8, b: 26, l: estado.medida === "hab" ? 48 : 52 };
    svg.attr("viewBox", `0 0 ${ancho} ${alto}`).selectAll("*").remove();
    document.getElementById("titulo-grafico").textContent =
      (estado.medida === "hab" ? "Por habitante y año" : "Total anual") + (estado.ipc ? `, en euros de ${hist.base_ipc}` : ", en euros de cada año");
    const x = d3.scaleBand().domain(datos.map((r) => r.anyo)).range([m.l, ancho - m.r]).paddingInner(0.25).paddingOuter(0.1);
    const ymax = d3.max(datos, (r) => valor(r, "total"));
    const y = d3.scaleLinear().domain([0, ymax * 1.08]).nice().range([alto - m.b, m.t]);

    const defs = svg.append("defs");
    defs.append("pattern").attr("id", "rayado").attr("width", 6).attr("height", 6).attr("patternUnits", "userSpaceOnUse")
      .attr("patternTransform", "rotate(45)")
      .append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 6).attr("stroke", C.css("--superficie")).attr("stroke-width", 2.5);

    // Bandas de cada presidente (gobernó la mayor parte del año)
    const tramos = [];
    datos.forEach((r) => {
      const t = tramos[tramos.length - 1];
      if (t && t.p === r.gobierna) t.hasta = r.anyo; else tramos.push({ p: r.gobierna, desde: r.anyo, hasta: r.anyo });
    });
    const paso = x.step();
    tramos.forEach((t, i) => {
      const x0 = x(t.desde) - (paso - x.bandwidth()) / 2, x1 = x(t.hasta) + x.bandwidth() + (paso - x.bandwidth()) / 2;
      if (i % 2 === 0) svg.append("rect").attr("class", "banda").attr("x", x0).attr("width", x1 - x0).attr("y", m.t - 22).attr("height", alto - m.b - m.t + 22);
      const nombre = t.p.split(" ").slice(-1)[0] === "Zapatero" ? "Zapatero" : t.p.split(" ").slice(-1)[0];
      svg.append("text").attr("class", "banda-et").attr("x", (x0 + x1) / 2).attr("y", m.t - 9).attr("text-anchor", "middle").text(nombre);
    });

    // Rejilla y ejes
    const ticks = y.ticks(5);
    svg.append("g").attr("class", "rejilla-y").selectAll("line").data(ticks).join("line")
      .attr("x1", m.l).attr("x2", ancho - m.r).attr("y1", y).attr("y2", y);
    svg.append("g").attr("class", "eje").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).tickValues(ticks).tickFormat(fmtEje).tickSize(0).tickPadding(6)).call((g) => g.select(".domain").remove());
    const cada = ancho < 560 ? 3 : 1;
    svg.append("g").attr("class", "eje").attr("transform", `translate(0,${alto - m.b})`)
      .call(d3.axisBottom(x).tickValues(x.domain().filter((a, i) => i % cada === 0)).tickSize(0).tickPadding(8));

    // Barras apiladas, con 2 px de separación entre segmentos y extremo superior redondeado
    datos.forEach((r) => {
      let base = 0;
      const g = svg.append("g");
      const visibles = CATS.filter((k) => valor(r, k.id) > 0);
      visibles.forEach((k, i) => {
        const v = valor(r, k.id);
        const y0 = y(base), y1 = y(base + v);
        const h = Math.max(0, y0 - y1 - (i < visibles.length - 1 ? 2 : 0));
        const ultimo = i === visibles.length - 1;
        if (ultimo) {
          const rr = Math.min(4, h, x.bandwidth() / 2), xx = x(r.anyo), w = x.bandwidth(), yy = y1;
          g.append("path").attr("fill", `var(${COLOR[k.id]})`)
            .attr("d", `M${xx},${yy + h}V${yy + rr}Q${xx},${yy} ${xx + rr},${yy}H${xx + w - rr}Q${xx + w},${yy} ${xx + w},${yy + rr}V${yy + h}Z`);
        } else {
          g.append("rect").attr("x", x(r.anyo)).attr("width", x.bandwidth()).attr("y", y0 - h).attr("height", h).attr("fill", `var(${COLOR[k.id]})`);
        }
        base += v;
      });
      if (r.prorrogado) {
        g.append("rect").attr("class", "prorroga").attr("x", x(r.anyo)).attr("width", x.bandwidth())
          .attr("y", y(base)).attr("height", y(0) - y(base));
      }
      if (r.anyo === estado.anyo) {
        svg.append("rect").attr("x", x(r.anyo) - 2).attr("width", x.bandwidth() + 4).attr("y", y(base) - 2).attr("height", y(0) - y(base) + 2)
          .attr("fill", "none").attr("stroke", "var(--tinta)").attr("stroke-width", 1.5).attr("rx", 3);
      }
      // Zona de toque: toda la columna
      svg.append("rect").attr("class", "marca-hover").attr("x", x(r.anyo) - (paso - x.bandwidth()) / 2).attr("width", paso)
        .attr("y", m.t).attr("height", alto - m.b - m.t)
        .on("mousemove", (ev) => C.tip(ev, tipAnyo(r)))
        .on("mouseleave", C.ocultarTip)
        .on("click", () => { estado.anyo = r.anyo; C.ocultarTip(); grafico(); detalle(); });
    });

    // Etiqueta directa: el último año propio y el primero
    const etiquetar = (r) => svg.append("text").attr("x", x(r.anyo) + x.bandwidth() / 2).attr("y", y(valor(r, "total")) - 5)
      .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "var(--tinta)").text(fmt(valor(r, "total")));
    etiquetar(datos[0]);
    etiquetar([...datos].reverse().find((r) => !r.prorrogado));
  }

  function tipAnyo(r) {
    const filas = [...CATS].reverse().filter((k) => r[k.id] > 0).map((k) =>
      `<div style="display:flex;justify-content:space-between;gap:12px"><span><i class="mu" style="background:var(${COLOR[k.id]})"></i>${k.nombre}</span><span>${fmt(valor(r, k.id))}</span></div>`).join("");
    return `<b>${r.anyo} · ${fmt(valor(r, "total"))}</b>
      <span class="t2">${r.prorrogado ? `Presupuesto de ${r.prorrogado} prorrogado` : "Presupuesto del año"} · gobierna ${r.gobierna}</span>${filas}`;
  }

  function leyenda() {
    document.getElementById("leyenda").innerHTML = CATS.map((k) =>
      `<span><i class="mu" style="background:var(${COLOR[k.id]})"></i>${k.nombre}</span>`).join("");
  }

  function tabla() {
    const datos = serie();
    document.getElementById("tabla").innerHTML = `<table class="tabla"><thead><tr><th>Año</th>${CATS.map((k) => `<th class="num">${k.nombre}</th>`).join("")}<th class="num">Total</th></tr></thead><tbody>
      ${datos.map((r) => `<tr><td>${r.anyo}${r.prorrogado ? ` <span class="etiqueta">prorrogado</span>` : ""}</td>${CATS.map((k) => `<td class="num">${fmt(valor(r, k.id))}</td>`).join("")}<td class="num"><b>${fmt(valor(r, "total"))}</b></td></tr>`).join("")}
      </tbody></table>`;
  }

  // ---- Ministerios y secretarías de Estado (dos recuentos en la misma escala) ----
  function graficoN() {
    const s = d3.select("#grafico-n");
    const ancho = Math.max(300, s.node().getBoundingClientRect().width || 500), alto = 220;
    const m = { t: 12, r: 120, b: 24, l: 28 };
    s.attr("viewBox", `0 0 ${ancho} ${alto}`).selectAll("*").remove();
    const d = serieCompleta;
    const x = d3.scaleLinear().domain(d3.extent(d, (r) => r.anyo)).range([m.l, ancho - m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(d, (r) => Math.max(r.ministerios, r.secretarias_estado)) * 1.1]).nice().range([alto - m.b, m.t]);
    s.append("g").attr("class", "rejilla-y").selectAll("line").data(y.ticks(4)).join("line").attr("x1", m.l).attr("x2", ancho - m.r).attr("y1", y).attr("y2", y);
    s.append("g").attr("class", "eje").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(0).tickPadding(6)).call((g) => g.select(".domain").remove());
    s.append("g").attr("class", "eje").attr("transform", `translate(0,${alto - m.b})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("d")).tickSize(0).tickPadding(8));
    [["ministerios", "Ministerios", "--c-1"], ["secretarias_estado", "Secretarías de Estado", "--c-2"]].forEach(([k, n, col]) => {
      s.append("path").attr("class", "linea").attr("stroke", `var(${col})`).attr("d", d3.line().curve(d3.curveStepAfter).x((r) => x(r.anyo)).y((r) => y(r[k]))(d));
      const u = d[d.length - 1];
      s.append("text").attr("x", x(u.anyo) + 6).attr("y", y(u[k]) + 4).attr("font-size", 11).attr("fill", "var(--tinta)").text(`${n}: ${u[k]}`);
    });
    // Tooltip por año
    d.forEach((r) => s.append("rect").attr("class", "marca-hover").attr("x", x(r.anyo) - 10).attr("width", 20).attr("y", m.t).attr("height", alto - m.b - m.t)
      .on("mousemove", (ev) => C.tip(ev, `<b>${r.anyo}</b>${r.ministerios} ministerios · ${r.secretarias_estado} secretarías de Estado${r.prorrogado ? `<br><span class="t2">estructura del presupuesto de ${r.prorrogado}</span>` : ""}`))
      .on("mouseleave", C.ocultarTip));
  }

  // ---- Detalle del año elegido ----
  function detalle() {
    const r = serieCompleta.find((x) => x.anyo === estado.anyo) || [...serieCompleta].reverse().find((x) => !x.prorrogado);
    const ipc = estado.ipc && r.factor_ipc ? r.factor_ipc : 1;
    const f = (v) => C.millones(v * ipc);
    document.getElementById("detalle").innerHTML = `
      <div class="ficha-cab"><h2>${r.anyo}: ministerio a ministerio</h2><span class="base">${r.prorrogado ? `prorrogado de ${r.prorrogado}` : "presupuesto del año"}</span></div>
      <p class="datos-linea">Gobierna ${r.gobierna} · presupuesto elaborado por el Gobierno de ${r.autor}${ipc !== 1 ? ` · euros de ${hist.base_ipc}` : ""}</p>
      <div class="tabla-scroll"><table class="tabla"><thead><tr><th>Ministerio</th><th class="num">Altos cargos</th><th class="num">Asesores</th></tr></thead><tbody>
      ${r.por_ministerio.map((m) => `<tr><td>${C.esc(m.nombre)}</td><td class="num">${f(m.altos)}</td><td class="num">${f(m.asesores)}</td></tr>`).join("")}
      </tbody></table></div>`;
  }

  // ---- Por presidente: media de los presupuestos que elaboró ----
  function porGobierno() {
    const grupos = d3.groups(serieCompleta.filter((r) => !r.prorrogado && r.factor_ipc), (r) => r.autor);
    document.getElementById("por-gobierno").innerHTML = `<table class="tabla"><thead><tr><th>Presidente</th><th>Presupuestos propios</th>
      <th class="num">Media anual</th><th class="num">De ella, asesores de ministerios</th><th class="num">Por habitante</th><th class="num">Ministerios</th></tr></thead><tbody>
      ${grupos.map(([p, rs]) => {
        const media = (f) => d3.mean(rs, f);
        return `<tr><td>${p}</td><td>${rs.map((r) => r.anyo).join(", ")}</td>
          <td class="num">${C.millones(media((r) => r.total * r.factor_ipc))}</td>
          <td class="num">${C.millones(media((r) => r.gobierno_asesores * r.factor_ipc))}</td>
          <td class="num">${C.eur2(media((r) => (r.total * r.factor_ipc) / r.poblacion))}</td>
          <td class="num">${d3.min(rs, (r) => r.ministerios)}–${d3.max(rs, (r) => r.ministerios)}</td></tr>`;
      }).join("")}</tbody></table>`;
  }

  document.getElementById("descargar").addEventListener("click", () => {
    C.descargarCSV("gobierno_central_altos_cargos_asesores.csv",
      ["anyo", "prorrogado_de", "gobierna", "elaborado_por", ...CATS.map((k) => k.id), "total_eur", "poblacion", `factor_eur_${hist.base_ipc}`, "ministerios", "secretarias_estado"],
      serieCompleta.map((r) => [r.anyo, r.prorrogado || "", r.gobierna, r.autor, ...CATS.map((k) => r[k.id]), r.total, r.poblacion, r.factor_ipc ?? "", r.ministerios, r.secretarias_estado]));
  });

  function render() {
    document.querySelectorAll("[data-ipc]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.ipc === "si") === estado.ipc)));
    document.querySelectorAll("[data-medida]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.medida === estado.medida)));
    grafico();
    tabla();
    detalle();
  }
  document.querySelectorAll("[data-ipc]").forEach((b) => b.addEventListener("click", () => { estado.ipc = b.dataset.ipc === "si"; render(); }));
  document.querySelectorAll("[data-medida]").forEach((b) => b.addEventListener("click", () => { estado.medida = b.dataset.medida; render(); }));
  window.addEventListener("resize", () => { grafico(); graficoN(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", grafico);

  kpis();
  leyenda();
  graficoN();
  porGobierno();
  render();
  document.getElementById("pie-fuentes").innerHTML = "Fuentes: " + hist.fuentes.map((f) => `<a href="${f.url}" target="_blank" rel="noopener">${f.texto}</a>`).join(" · ") +
    `. Sin inflación: el último año (${serieCompleta[serieCompleta.length - 1].anyo}) solo aparece en euros corrientes porque aún no hay IPC anual cerrado.`;
})();
