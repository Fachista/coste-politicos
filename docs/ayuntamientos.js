(async function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const datos = await C.json("datos.json");
  let munis = null;
  try { munis = await C.json("municipios.json"); } catch (e) { munis = null; }
  $("pie-fuentes").innerHTML = C.masInfo("municipios");

  // Sin lista completa: los 15 ayuntamientos con más gasto de cada comunidad (están en datos.json)
  if (!munis) {
    $("buscador").hidden = true;
    $("sin-datos").hidden = false;
    const ccs = datos.comunidades.filter((c) => c.municipios.length);
    $("ccaa").innerHTML = ccs.map((c) => `<option>${c.nombre}</option>`).join("");
    const pintar = () => {
      const c = ccs.find((x) => x.nombre === $("ccaa").value);
      const max = c.municipios[0].electos + c.municipios[0].eventual;
      $("top").innerHTML = c.municipios.map((m) => `<div class="barra-fila"><span class="nom">${C.esc(m.nombre)}</span>
        <span class="pista"><span class="bar" style="width:${((m.electos + m.eventual) / max) * 100}%"></span></span>
        <span class="v">${C.millones(m.electos + m.eventual)}</span></div>`).join("") +
        `<p class="nota-pie">Alcalde, concejales y asesores, ${datos.anyo}. Sin población por municipio todavía no se puede calcular el coste por habitante.</p>`;
    };
    $("ccaa").addEventListener("change", pintar);
    pintar();
    return;
  }

  const [iNom, iProv, iCc, iPob, iEl, iAs] = [0, 1, 2, 3, 4, 5];
  const norm = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();
  const filas = munis.filas.filter((f) => f[iPob] > 0).map((f) => ({
    nombre: f[iNom], prov: f[iProv], cc: f[iCc], pob: f[iPob], electos: f[iEl], asesores: f[iAs], n: norm(f[iNom]),
  }));
  const TRAMOS = [[0, 1000, "menos de 1.000"], [1000, 5000, "1.000 a 5.000"], [5000, 20000, "5.000 a 20.000"], [20000, 50000, "20.000 a 50.000"],
    [50000, 100000, "50.000 a 100.000"], [100000, 500000, "100.000 a 500.000"], [500000, Infinity, "más de 500.000"]];
  const tramo = (p) => TRAMOS.find(([a, b]) => p >= a && p < b);
  const mediana = (v) => { const o = [...v].sort((a, b) => a - b), m = o.length >> 1; return o.length ? (o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2) : 0; };
  const stats = new Map(TRAMOS.map((t) => {
    const g = filas.filter((f) => tramo(f.pob) === t);
    return [t, { n: g.length, el: mediana(g.map((f) => f.electos / f.pob)), as: mediana(g.map((f) => f.asesores / f.pob)),
      tot: mediana(g.map((f) => (f.electos + f.asesores) / f.pob)), conAs: g.filter((f) => f.asesores > 0).length / Math.max(1, g.length) }];
  }));

  function sugerir() {
    const q = norm($("q").value);
    if (q.length < 2) { $("sugerencias").innerHTML = ""; return; }
    const res = filas.filter((f) => f.n.includes(q)).sort((a, b) => (a.n.startsWith(q) ? 0 : 1) - (b.n.startsWith(q) ? 0 : 1) || b.pob - a.pob).slice(0, 8);
    $("sugerencias").innerHTML = res.length ? res.map((f, i) => `<button class="boton" data-i="${filas.indexOf(f)}" style="justify-content:space-between;width:100%">
      <span>${C.esc(f.nombre)} <span class="datos-linea">· ${C.esc(f.prov)}</span></span><span class="datos-linea">${C.fmtEnt.format(f.pob)} hab.</span></button>`).join("")
      : `<p class="datos-linea">No aparece. Puede que su ayuntamiento no enviara datos a Hacienda.</p>`;
    $("sugerencias").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => ficha(filas[+b.dataset.i])));
  }

  function ficha(f) {
    location.hash = encodeURIComponent(f.nombre + "|" + f.prov);
    $("sugerencias").innerHTML = "";
    const t = tramo(f.pob), s = stats.get(t);
    const tot = (f.electos + f.asesores) / f.pob;
    const rel = s.tot > 0 ? tot / s.tot : 1;
    const comp = rel > 1.2 ? `${C.fmtPct.format((rel - 1) * 100)} % más que` : rel < 0.8 ? `${C.fmtPct.format((1 - rel) * 100)} % menos que` : "parecido a";
    const razones = [];
    const el = f.electos / f.pob, as = f.asesores / f.pob;
    if (s.el > 0 && el > s.el * 1.3) razones.push(`Alcalde y concejales cobran más que en municipios de su tamaño: ${C.eur2(el)} por habitante frente a ${C.eur2(s.el)}. Suele pasar cuando hay más concejales con dedicación exclusiva o parcial.`);
    if (s.el > 0 && el < s.el * 0.7) razones.push(`Alcalde y concejales cobran menos que en municipios de su tamaño: ${C.eur2(el)} por habitante frente a ${C.eur2(s.el)}.`);
    if (f.asesores > 0 && as > Math.max(s.as * 1.3, 0.3)) razones.push(`Gasta más en asesores (personal eventual) que la mayoría de municipios de su tamaño: ${C.millones(f.asesores)} al año, ${C.eur2(as)} por habitante.`);
    if (f.asesores === 0 && s.conAs > 0.5) razones.push("No tiene asesores, aunque la mayoría de municipios de su tamaño sí los tienen.");
    if (f.asesores === 0 && s.conAs <= 0.5) razones.push("No tiene asesores, como la mayoría de municipios de su tamaño.");
    const frase = `En ${munis.anyo}, el alcalde, los concejales y los asesores del Ayuntamiento de ${f.nombre} (${f.prov}) costaron ${C.millones(f.electos + f.asesores)}, ${C.eur2(tot)} por habitante: ${comp} un municipio típico de ${t[2]} habitantes (${C.eur2(s.tot)}).`;
    $("ficha").hidden = false;
    $("ficha").innerHTML = `
      <div class="ficha-cab"><h2>${C.esc(f.nombre)}</h2><span class="base">${C.esc(f.prov)} · ${C.esc(f.cc)}</span></div>
      <div class="heroe">${C.eur2(tot)} <small>por habitante y año</small></div>
      <div class="comp"><b>${comp} un municipio típico de su tamaño</b> (${t[2]} habitantes: ${C.eur2(s.tot)})</div>
      <div class="datos-linea">${C.millones(f.electos + f.asesores)} al año · ${C.fmtEnt.format(f.pob)} habitantes</div>
      <table class="desglose" style="margin-top:12px"><tbody>
        <tr><td><i class="mu" style="background:var(--c-4)"></i>Alcalde y concejales</td><td class="num">${C.millones(f.electos)}</td><td class="num pct">${C.eur2(el)}/hab</td></tr>
        <tr><td><i class="mu" style="background:var(--c-6)"></i>Asesores</td><td class="num">${C.millones(f.asesores)}</td><td class="num pct">${C.eur2(as)}/hab</td></tr>
      </tbody></table>
      <div class="porque"><h3>¿Por qué?</h3><ul>${razones.map((r) => `<li>${r}</li>`).join("") || "<li>Ninguna parte destaca frente a los municipios de su tamaño.</li>"}</ul></div>
      <p><button class="boton" id="copiar-m">Copiar con fuente</button></p>`;
    $("copiar-m").addEventListener("click", (e) => C.copiar(e.target, frase + ` (Fuentes: ISPA y CONPREL ${munis.anyo}.)`));
  }

  $("q").addEventListener("input", sugerir);
  if (location.hash) {
    const [n, p] = decodeURIComponent(location.hash.slice(1)).split("|");
    const f = filas.find((x) => x.nombre === n && x.prov === p);
    if (f) { $("q").value = f.nombre; ficha(f); }
  }
})();
