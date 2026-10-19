(async function () {
  "use strict";
  const [datos, hist] = await Promise.all([C.json("datos.json"), C.json("historico.json")]);
  const est = datos.estado, ref = hist.sueldos.detalle.referencias, D = hist.sueldos.detalle;
  const ultimo = [...hist.estado].reverse().find((r) => !r.prorrogado);

  // Partidas que se pueden recortar (importes anuales en euros)
  const sum = (f) => datos.comunidades.reduce((s, c) => s + f(c), 0);
  const ev = (c, t) => (c.partes[t] ? c.partes[t].eventual : 0);
  const asesoresCCAA = sum((c) => ev(c, "gobierno") + ev(c, "parlamento") + ev(c, "organismo") + ev(c, "estatutario"));
  const asesoresLocal = sum((c) => (c.partes.local ? c.partes.local.eventual : 0));
  const asesoresEstado = ["gobierno", "congreso", "senado", "organismo", "estatutario"].reduce((s, t) => s + (est.partes[t] ? est.partes[t].eventual : 0), 0);
  const total = sum(C.nucleoComunidad) + C.nucleoEstado(est);
  const PARTIDAS = [
    { id: "ases_min", txt: `Asesores de los ministerios (presupuesto ${ultimo.anyo})`, v: ultimo.gobierno_asesores, fuente: `Presupuestos Generales del Estado ${ultimo.anyo}` },
    { id: "ases_todos", txt: `Todos los asesores: Estado, comunidades y ayuntamientos (${datos.anyo})`, v: asesoresCCAA + asesoresLocal + asesoresEstado, fuente: `presupuestos y cuentas de cada administración y CONPREL, ${datos.anyo}` },
    { id: "ases_local", txt: `Asesores de ayuntamientos y diputaciones (${datos.anyo})`, v: asesoresLocal, fuente: `CONPREL (Ministerio de Hacienda), ${datos.anyo}` },
    { id: "altos_min", txt: `Altos cargos de los ministerios (presupuesto ${ultimo.anyo})`, v: ultimo.gobierno_altos, fuente: `Presupuestos Generales del Estado ${ultimo.anyo}` },
    { id: "todo", txt: `Todo el coste político de España (${datos.anyo})`, v: total, fuente: `todas las fuentes de la web, ${datos.anyo}` },
    { id: "propio", txt: "Otro importe…", v: null },
  ];
  const DESTINOS = [
    { id: "a2", txt: "Maestros o enfermeros", v: ref.funcionario_A2_22.anual, det: ref.funcionario_A2_22.texto },
    { id: "a1", txt: "Profesores de secundaria o médicos", v: ref.funcionario_A1_24.anual, det: ref.funcionario_A1_24.texto },
    { id: "c1", txt: "Administrativos o técnicos", v: ref.funcionario_C1_18.anual, det: ref.funcionario_C1_18.texto },
    { id: "smi", txt: "Empleos con el salario mínimo", v: 15120, det: "Salario mínimo interprofesional de 2023 (Real Decreto 99/2023): 1.080 € × 14 pagas" },
    { id: "otro", txt: "Otro sueldo…", v: null, det: "Sueldo bruto anual que has indicado" },
  ];

  const $ = (id) => document.getElementById(id);
  $("partida").innerHTML = PARTIDAS.map((p) => `<option value="${p.id}">${p.txt}${p.v ? " · " + C.millones(p.v) : ""}</option>`).join("");
  $("destino").innerHTML = DESTINOS.map((d) => `<option value="${d.id}">${d.txt}${d.v ? " · " + C.eur(d.v) + "/año" : ""}</option>`).join("");

  // Estado inicial desde la dirección (para compartir un cálculo concreto)
  const q = new URLSearchParams(location.hash.slice(1));
  if (q.get("p") && PARTIDAS.some((p) => p.id === q.get("p"))) $("partida").value = q.get("p");
  if (q.get("d") && DESTINOS.some((d) => d.id === q.get("d"))) $("destino").value = q.get("d");
  if (q.get("pct")) $("pct").value = q.get("pct");
  if (q.get("imp")) $("propio").value = q.get("imp");
  if (q.get("s")) $("sueldo").value = q.get("s");

  let texto = "";
  function calcular() {
    const p = PARTIDAS.find((x) => x.id === $("partida").value);
    const d = DESTINOS.find((x) => x.id === $("destino").value);
    $("campo-propio").hidden = p.id !== "propio";
    $("campo-sueldo").hidden = d.id !== "otro";
    const base = p.v ?? Math.max(0, +$("propio").value || 0);
    const sueldo = d.v ?? Math.max(1000, +$("sueldo").value || 1000);
    const pct = +$("pct").value / 100;
    $("pct-txt").textContent = C.pct(pct);
    const ahorro = base * pct;
    const n = Math.floor(ahorro / sueldo);
    $("res-ahorro").textContent = `Recortar el ${C.pct(pct)} de ${C.millones(base)} libera ${C.millones(ahorro)} al año, que equivalen a`;
    $("res-n").textContent = C.fmtEnt.format(n);
    $("res-txt").innerHTML = `<b>${d.txt.toLowerCase()}</b> a tiempo completo durante un año<br><span class="datos-linea">${d.det}: ${C.eur(sueldo)} brutos al año</span>`;
    // Pictograma: cada cuadro, un número redondo de personas
    const escala = [1, 10, 100, 1000, 10000].find((e) => n / e <= 400) || 10000;
    const cuadros = Math.min(400, Math.ceil(n / escala));
    $("iconos").innerHTML = "<i></i>".repeat(cuadros);
    $("res-escala").textContent = n ? `Cada cuadro = ${C.fmtEnt.format(escala)} ${escala === 1 ? "persona" : "personas"}.` : "";
    texto = `Recortar el ${C.pct(pct)} de ${p.txt.toLowerCase().replace(/ \(.*\)$/, "")} (${C.millones(base)}) daría para pagar a ${C.fmtEnt.format(n)} ${d.txt.toLowerCase()} durante un año (${C.eur(sueldo)} brutos anuales cada uno). ` +
      `Fuentes: ${p.fuente || "importe indicado"}; ${d.det}.`;
    history.replaceState(null, "", "#" + new URLSearchParams({ p: p.id, d: d.id, pct: $("pct").value,
      ...(p.id === "propio" ? { imp: base } : {}), ...(d.id === "otro" ? { s: sueldo } : {}) }));
  }
  ["partida", "destino", "pct", "propio", "sueldo"].forEach((id) => $(id).addEventListener("input", calcular));
  $("copiar").addEventListener("click", () => C.copiar($("copiar"), texto + " " + location.href));
  calcular();
  $("pie-fuentes").innerHTML = `Sueldos de referencia: <a href="${D.url}" target="_blank" rel="noopener">${D.ley}, de Presupuestos Generales del Estado para ${D.anyo}</a> (BOE). ${ref.nota}`;
})();
