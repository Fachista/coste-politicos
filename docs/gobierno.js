// Gobierno central: pestañas, resumen, ministerios y Congreso y Senado.
// La pestaña «Evolución» la pinta estado.js y «Sueldos», sueldos.js.
(async function () {
  "use strict";

  // ---- Pestañas (la elegida queda en la dirección: gobierno.html#sueldos) ----
  const TABS = ["resumen", "ministerios", "evolucion", "sueldos", "cortes"];
  function mostrar(tab, desplazar) {
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
    // Los gráficos se dibujan con el ancho real del panel, que solo existe cuando está visible
    window.dispatchEvent(new Event("resize"));
    if (desplazar) document.querySelector(".pestanas").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  document.querySelectorAll("[data-tab]").forEach((b) => {
    b.addEventListener("click", () => mostrar(b.dataset.tab));
    b.addEventListener("keydown", (e) => {
      const i = TABS.indexOf(b.dataset.tab), d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      const sig = TABS[(i + d + TABS.length) % TABS.length];
      mostrar(sig);
      document.querySelector(`[data-tab="${sig}"]`).focus();
    });
  });
  window.addEventListener("hashchange", () => mostrar(location.hash.slice(1)));
  mostrar(location.hash.slice(1));

  const [datos, hist] = await Promise.all([C.json("datos.json"), C.json("historico.json")]);
  const est = datos.estado, serie = hist.estado;
  const suma = (t) => est.partes[t].altos + est.partes[t].eventual;
  const ESCANOS = { congreso: 350, senado: 266 };
  const propio = [...serie].reverse().find((r) => !r.prorrogado);

  // ---- Resumen ----
  const partes = [
    ["Altos cargos de los ministerios", est.partes.gobierno.altos, "--c-1"],
    ["Asesores de los ministerios", est.partes.gobierno.eventual, "--c-2"],
    ["Congreso de los Diputados", suma("congreso"), "--c-3"],
    ["Senado", suma("senado"), "--c-4"],
  ];
  const total = partes.reduce((s, p) => s + p[1], 0);
  document.getElementById("r-etiqueta").textContent = `Lo que paga cada persona al año (${datos.anyo})`;
  document.getElementById("r-cifra").innerHTML = `${C.eur2(total / datos.poblacion.total)}`;
  document.getElementById("r-total").textContent = `${C.millones(total)} en total · ministerios: presupuesto; Cortes: gasto real`;
  document.getElementById("r-pila").innerHTML = partes.map(([n, v, col]) => `<span style="flex:${v};background:var(${col})" title="${n}"></span>`).join("");
  document.getElementById("r-desglose").innerHTML = `<tbody>${partes.map(([n, v, col]) =>
    `<tr><td><i class="mu" style="background:var(${col})"></i>${n}</td><td class="num">${C.millones(v)}</td><td class="num pct">${C.pct(v / total)}</td></tr>`).join("")}</tbody>`;

  const a18 = serie.find((r) => r.anyo === 2018);
  const cargos = hist.sueldos.detalle.cargos;
  const presi = cargos.find((c) => c.cargo === "Presidente del Gobierno");
  const masQuePresi = cargos.filter((c) => c.anual > presi.anual).length;
  const mayor = [...propio.por_ministerio].sort((a, b) => b.altos + b.asesores - a.altos - a.asesores)[0];
  const corto = (n) => n.split(",")[0];
  const DATOS = [
    { tab: "ministerios", val: propio.ministerios, txt: `ministerios (${serie[0].ministerios} en ${serie[0].anyo})` },
    { tab: "evolucion", val: "+" + C.pct(propio.gobierno_asesores / a18.gobierno_asesores - 1), txt: `para asesores de ministerios desde 2018` },
    { tab: "ministerios", val: C.millones(mayor.altos + mayor.asesores), txt: `${corto(mayor.nombre)}, el ministerio que más gasta` },
    { tab: "sueldos", val: C.eur(presi.anual), txt: `sueldo del presidente; ${masQuePresi} cargos cobran más` },
    { tab: "cortes", val: C.eur(est.partes.congreso.altos / ESCANOS.congreso), txt: "sueldo medio de un diputado" },
  ];
  const cont = document.getElementById("r-datos");
  cont.innerHTML = DATOS.map((d) => `<button class="dato" data-ir="${d.tab}"><b>${d.val}</b><span>${d.txt}</span><i aria-hidden="true">›</i></button>`).join("");
  cont.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => mostrar(b.dataset.ir, true)));

  // ---- Ministerios ----
  const sel = document.getElementById("m-anyo");
  sel.innerHTML = [...serie].reverse().map((r) => `<option value="${r.anyo}">${r.anyo}${r.prorrogado ? ` (prorrogado de ${r.prorrogado})` : ""}</option>`).join("");
  sel.value = propio.anyo;
  function ministerios() {
    const r = serie.find((x) => x.anyo === +sel.value);
    const filas = [...r.por_ministerio].sort((a, b) => b.altos + b.asesores - a.altos - a.asesores);
    const max = filas[0].altos + filas[0].asesores;
    document.getElementById("m-sub").textContent = `${filas.length} ministerios · gobierna ${r.gobierna} · presupuesto elaborado por el Gobierno de ${r.autor} · euros de cada año`;
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
  window.addEventListener("anyo-elegido", (e) => { sel.value = e.detail; ministerios(); mostrar("ministerios", true); });
  ministerios();

  // ---- Congreso y Senado ----
  const camara = (k, nombre, quien) => {
    const p = est.partes[k];
    return `<section class="tarjeta camara">
      <div class="det">${nombre} · ${datos.anyo}</div>
      <div class="gran-cifra media">${C.millones(p.altos + p.eventual)}</div>
      <table class="desglose"><tbody>
        <tr><td>Sueldos de ${quien}</td><td class="num">${C.millones(p.altos)}</td></tr>
        <tr><td>Personal eventual (asesores)</td><td class="num">${C.millones(p.eventual)}</td></tr>
        <tr><td>Media por escaño (${ESCANOS[k]})</td><td class="num">${C.eur(p.altos / ESCANOS[k])}</td></tr>
      </tbody></table>
    </section>`;
  };
  document.getElementById("c-camaras").innerHTML =
    camara("congreso", "Congreso de los Diputados", "los diputados") + camara("senado", "Senado", "los senadores");

  function serieCortes() {
    const svg = d3.select("#c-serie");
    const d = serie.filter((r) => r.factor_ipc);
    const ancho = Math.max(320, svg.node().getBoundingClientRect().width || 900), alto = ancho < 560 ? 240 : 280;
    const m = { t: 14, r: ancho < 560 ? 76 : 96, b: 26, l: 52 };
    svg.attr("viewBox", `0 0 ${ancho} ${alto}`).selectAll("*").remove();
    const x = d3.scaleLinear().domain(d3.extent(d, (r) => r.anyo)).range([m.l, ancho - m.r]);
    const val = (r, k) => r[k] * r.factor_ipc;
    const y = d3.scaleLinear().domain([0, d3.max(d, (r) => Math.max(val(r, "congreso"), val(r, "senado"))) * 1.1]).nice().range([alto - m.b, m.t]);
    svg.append("g").attr("class", "rejilla-y").selectAll("line").data(y.ticks(4)).join("line").attr("x1", m.l).attr("x2", ancho - m.r).attr("y1", y).attr("y2", y);
    svg.append("g").attr("class", "eje").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat((v) => C.fmtEnt.format(v / 1e6) + " M€").tickSize(0).tickPadding(6)).call((g) => g.select(".domain").remove());
    svg.append("g").attr("class", "eje").attr("transform", `translate(0,${alto - m.b})`)
      .call(d3.axisBottom(x).ticks(ancho < 560 ? 4 : 8).tickFormat(d3.format("d")).tickSize(0).tickPadding(8));
    [["congreso", "Congreso", "--c-3"], ["senado", "Senado", "--c-4"]].forEach(([k, n, col]) => {
      svg.append("path").attr("class", "linea").attr("stroke", `var(${col})`).attr("d", d3.line().x((r) => x(r.anyo)).y((r) => y(val(r, k)))(d));
      const u = d[d.length - 1];
      svg.append("text").attr("x", x(u.anyo) + 6).attr("y", y(val(u, k)) + 4).attr("font-size", 11).attr("fill", "var(--tinta)").text(`${n} ${C.fmtM.format(val(u, k) / 1e6)} M€`);
    });
    const guia = svg.append("line").attr("stroke", "var(--eje)").attr("y1", m.t).attr("y2", alto - m.b).style("display", "none");
    svg.append("rect").attr("class", "marca-hover").attr("x", m.l).attr("width", ancho - m.r - m.l).attr("y", m.t).attr("height", alto - m.b - m.t)
      .on("mousemove", (ev) => {
        const a = Math.round(x.invert(d3.pointer(ev)[0]));
        const r = d.reduce((b, c) => (Math.abs(c.anyo - a) < Math.abs(b.anyo - a) ? c : b));
        guia.attr("x1", x(r.anyo)).attr("x2", x(r.anyo)).style("display", null);
        C.tip(ev, `<b>${r.anyo}</b>Congreso: ${C.millones(val(r, "congreso"))}<br>Senado: ${C.millones(val(r, "senado"))}<br><span class="t2">euros de ${hist.base_ipc}${r.prorrogado ? ` · prorrogado de ${r.prorrogado}` : ""}</span>`);
      })
      .on("mouseleave", () => { guia.style("display", "none"); C.ocultarTip(); });
    document.getElementById("c-nota").textContent =
      `Créditos iniciales de cada presupuesto del Estado para sueldos de parlamentarios y personal eventual, en euros de ${hist.base_ipc}. ` +
      `Las cifras de arriba son el gasto real de ${datos.anyo} según las cuentas de cada cámara.`;
  }
  window.addEventListener("resize", serieCortes);
  serieCortes();
})();
