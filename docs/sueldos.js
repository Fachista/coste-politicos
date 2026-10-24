(async function () {
  "use strict";
  const hist = await C.json("historico.json");
  const S = hist.sueldos, D = S.detalle;
  // Salario mínimo interprofesional del año de la ley: Real Decreto 99/2023 (1.080 € al mes en 14 pagas, comprobado en el BOE)
  const SMI = { anyo: 2023, anual: 15120, fuente: "Real Decreto 99/2023, de 14 de febrero", url: "https://www.boe.es/buscar/doc.php?id=BOE-A-2023-3982" };
  const presi = D.cargos.find((c) => c.cargo === "Presidente del Gobierno");
  const maestro = D.referencias.funcionario_A2_22;
  const REF = {
    presi: { v: presi.anual, txt: "el presidente del Gobierno" },
    smi: { v: SMI.anual, txt: "el salario mínimo" },
    maestro: { v: maestro.anual, txt: "la retribución básica de un maestro o enfermero" },
  };
  document.querySelectorAll(".anyo-ley").forEach((e) => (e.textContent = D.anyo));
  document.getElementById("smi").textContent = C.eur(SMI.anual) + " al año";
  document.getElementById("maestro").textContent = C.eur(maestro.anual) + " al año";
  document.getElementById("titulo-ranking").textContent = `Sueldos fijados por ley en ${D.anyo}, de mayor a menor`;

  const fmtVeces = (v) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(v) + " veces";

  function ranking() {
    const ref = REF[document.getElementById("comparar").value];
    const max = D.cargos[0].anual;
    const cont = document.getElementById("ranking");
    cont.innerHTML = D.cargos.map((c) => `
      <div class="barra-fila" tabindex="0" data-c="${C.esc(c.cargo)}">
        <span class="nom">${C.esc(c.cargo)}${c.anual > presi.anual ? ` <span class="etiqueta alerta">más que el presidente</span>` : ""}</span>
        <span class="pista"><span class="bar" style="width:${(c.anual / max) * 100}%"></span>
          ${ref.v <= max ? `<span class="ref" style="left:${(ref.v / max) * 100}%"></span>` : ""}</span>
        <span class="v">${C.eur(c.anual)}</span>
      </div>`).join("");
    cont.querySelectorAll(".barra-fila").forEach((el) => {
      const c = D.cargos.find((x) => x.cargo === el.dataset.c);
      el.addEventListener("mousemove", (ev) => C.tip(ev, `<b>${C.esc(c.cargo)}</b>${C.eur(c.anual)} brutos al año<br>
        <span class="t2">${fmtVeces(c.anual / ref.v)} ${ref.txt}<br>${c.grupo} · ${c.calculo}</span>`));
      el.addEventListener("mouseleave", C.ocultarTip);
    });
    document.getElementById("nota-ranking").innerHTML =
      `Línea discontinua: ${ref.txt} (${C.eur(ref.v)}). Fuente: <a href="${D.url}" target="_blank" rel="noopener">${D.ley}, de Presupuestos Generales del Estado para ${D.anyo}</a>, texto consolidado del BOE. ` +
      `En 2024 y 2025 no hubo ley de presupuestos nueva; las subidas generales de esos años, aprobadas por real decreto-ley, aún no están incorporadas.`;
    const mas = D.cargos.filter((c) => c.anual > presi.anual);
    document.getElementById("resumen-justo").innerHTML =
      `En ${D.anyo}, <b>${mas.length} cargos</b> tenían fijado un sueldo mayor que el del presidente del Gobierno, todos en órganos constitucionales y consultivos (Tribunal Constitucional, Consejo General del Poder Judicial, Tribunal de Cuentas…). ` +
      `El sueldo más alto, ${C.eur(D.cargos[0].anual)}, equivale a ${fmtVeces(D.cargos[0].anual / SMI.anual)} el salario mínimo. ` +
      `Un secretario de Estado (${C.eur(D.cargos.find((c) => c.cargo === "Secretario de Estado").anual)}) cobra más que un ministro (${C.eur(D.cargos.find((c) => c.cargo === "Ministro del Gobierno").anual)}), porque recibe complementos y pagas extra que el ministro no tiene.`;
  }

  // ---- Serie histórica ----
  let ipc = true;
  const SERIES = [["presidente", "Presidente", "--c-1"], ["vicepresidente", "Vicepresidente", "--c-2"], ["ministro", "Ministro", "--c-3"]];
  const datosSerie = () => S.serie.filter((r) => !ipc || r.factor_ipc);
  const val = (r, k) => (r[k] == null ? null : r[k] * (ipc ? r.factor_ipc : 1));
  function serie() {
    const svg = d3.select("#serie");
    const ancho = Math.max(320, svg.node().getBoundingClientRect().width || 900), alto = ancho < 560 ? 260 : 320;
    const m = { t: 14, r: ancho < 560 ? 104 : 130, b: 26, l: 58 };
    svg.attr("viewBox", `0 0 ${ancho} ${alto}`).selectAll("*").remove();
    const d = datosSerie();
    const x = d3.scaleLinear().domain(d3.extent(d, (r) => r.anyo)).range([m.l, ancho - m.r]);
    const vals = d.flatMap((r) => SERIES.map(([k]) => val(r, k)).filter((v) => v != null));
    const y = d3.scaleLinear().domain([0, d3.max(vals) * 1.08]).nice().range([alto - m.b, m.t]);
    svg.append("g").attr("class", "rejilla-y").selectAll("line").data(y.ticks(5)).join("line").attr("x1", m.l).attr("x2", ancho - m.r).attr("y1", y).attr("y2", y);
    svg.append("g").attr("class", "eje").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat((v) => C.fmtEnt.format(v / 1000) + " mil €").tickSize(0).tickPadding(6)).call((g) => g.select(".domain").remove());
    svg.append("g").attr("class", "eje").attr("transform", `translate(0,${alto - m.b})`)
      .call(d3.axisBottom(x).ticks(ancho < 560 ? 4 : 8).tickFormat(d3.format("d")).tickSize(0).tickPadding(8));
    const etiquetas = [];
    SERIES.forEach(([k, n, col]) => {
      const linea = d3.line().defined((r) => val(r, k) != null).x((r) => x(r.anyo)).y((r) => y(val(r, k)));
      svg.append("path").attr("class", "linea").attr("stroke", `var(${col})`).attr("d", linea(d));
      const u = [...d].reverse().find((r) => val(r, k) != null);
      etiquetas.push({ x: x(u.anyo) + 6, y: y(val(u, k)) + 4, t: `${n} ${C.fmtEnt.format(Math.round(val(u, k) / 1000))} mil` });
    });
    // Etiquetas finales separadas al menos 13 px para que no se pisen
    etiquetas.sort((a, b) => a.y - b.y).forEach((e, i, arr) => { if (i && e.y - arr[i - 1].y < 13) e.y = arr[i - 1].y + 13; });
    etiquetas.forEach((e) => svg.append("text").attr("x", e.x).attr("y", e.y).attr("font-size", 11).attr("fill", "var(--tinta)").text(e.t));
    // Crosshair + tooltip
    const guia = svg.append("line").attr("stroke", "var(--eje)").attr("y1", m.t).attr("y2", alto - m.b).style("display", "none");
    svg.append("rect").attr("class", "marca-hover").attr("x", m.l).attr("width", ancho - m.r - m.l).attr("y", m.t).attr("height", alto - m.b - m.t)
      .on("mousemove", (ev) => {
        const [px] = d3.pointer(ev);
        const a = Math.round(x.invert(px));
        const r = d.reduce((b, c) => (Math.abs(c.anyo - a) < Math.abs(b.anyo - a) ? c : b));
        guia.attr("x1", x(r.anyo)).attr("x2", x(r.anyo)).style("display", null);
        C.tip(ev, `<b>${r.anyo}</b>${SERIES.map(([k, n]) => val(r, k) != null ? `${n}: ${C.eur(val(r, k))}` : "").filter(Boolean).join("<br>")}
          <br><span class="t2">${r.ley}${ipc ? ` · en euros de ${hist.base_ipc}` : ""}</span>`);
      })
      .on("mouseleave", () => { guia.style("display", "none"); C.ocultarTip(); });
    document.getElementById("leyenda-serie").innerHTML = SERIES.map(([, n, col]) => `<span><i class="mu" style="background:var(${col})"></i>${n} del Gobierno</span>`).join("");
    const p86 = d.find((r) => r.presidente), pu = [...d].reverse().find((r) => r.presidente);
    document.getElementById("nota-serie").innerHTML =
      `Sueldo bruto anual fijado en cada Ley de Presupuestos (12 mensualidades, sin pagas extra). ${ipc ? `Sin inflación, el sueldo del presidente pasa de ${C.eur(val(p86, "presidente"))} en ${p86.anyo} a ${C.eur(val(pu, "presidente"))} en ${pu.anyo} (euros de ${hist.base_ipc}).` : ""} ` +
      `En 2010 se recortó un 15 % y se congeló hasta 2015. Faltan los años sin ley de presupuestos propia (1996, 2019, 2020) y 1983-1985, cuya ley no trae el cuadro. Hasta 2001 las leyes están en pesetas (1 € = 166,386 pta).`;
    document.getElementById("tabla-serie").innerHTML = `<table class="tabla"><thead><tr><th>Año</th>${SERIES.map(([, n]) => `<th class="num">${n}</th>`).join("")}<th>Ley</th></tr></thead><tbody>
      ${d.map((r) => `<tr><td>${r.anyo}</td>${SERIES.map(([k]) => `<td class="num">${val(r, k) != null ? C.eur(val(r, k)) : "—"}</td>`).join("")}<td><a href="${r.url}" target="_blank" rel="noopener">${r.ley}</a></td></tr>`).join("")}</tbody></table>`;
    document.querySelectorAll("[data-ipc-s]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.ipcS === "si") === ipc)));
  }
  document.querySelectorAll("[data-ipc-s]").forEach((b) => b.addEventListener("click", () => { ipc = b.dataset.ipcS === "si"; serie(); }));
  document.getElementById("comparar").addEventListener("change", ranking);
  document.getElementById("descargar-s").addEventListener("click", () => {
    C.descargarCSV("sueldos_altos_cargos.csv", ["cargo", "grupo", "anyo", "sueldo_bruto_anual_eur", "calculo", "ley"],
      [...D.cargos.map((c) => [c.cargo, c.grupo, D.anyo, c.anual, c.calculo, D.ley]),
       ...S.serie.flatMap((r) => SERIES.filter(([k]) => r[k] != null).map(([k, n]) => [n + " del Gobierno", "Gobierno", r.anyo, r[k], "12 mensualidades, sin pagas extra", r.ley]))]);
  });
  window.addEventListener("resize", serie);
  ranking();
  serie();
  document.getElementById("pie-sueldos").innerHTML =
    `Fuentes: Leyes de Presupuestos Generales del Estado (BOE), leídas del texto consolidado que reproduce <a href="https://github.com/legalize-dev/legalize-es" target="_blank" rel="noopener">legalize-es</a>; salario mínimo: <a href="${SMI.url}" target="_blank" rel="noopener">${SMI.fuente}</a>; inflación: IPC del INE vía Banco Mundial. ${D.referencias.nota}`;
})();
