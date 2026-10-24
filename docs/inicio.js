(async function () {
  "use strict";
  const [datos, hist] = await Promise.all([C.json("datos.json"), C.json("historico.json")]);

  // Cifra de portada: comunidades (gobierno, parlamento y política local) + Gobierno central y Cortes
  const comunidades = datos.comunidades.reduce((s, c) => s + C.nucleoComunidad(c), 0);
  const estado = C.nucleoEstado(datos.estado);
  const total = comunidades + estado;
  const pob = datos.poblacion.total;
  const porPersona = total / pob;
  const ref = hist.sueldos.detalle.referencias;
  const enfermeros = Math.round(total / ref.funcionario_A2_22.anual);

  document.getElementById("cifra").textContent = C.eur2(porPersona);
  document.getElementById("explica").innerHTML = `<b>${C.millones(total)}</b> en total en ${datos.anyo}`;
  document.getElementById("equivale").innerHTML =
    `Equivale al sueldo básico de unos <b>${C.fmtEnt.format(enfermeros)} maestros o enfermeros</b>.`;

  // Reparto entre los tres niveles y tarjetas de entrada a cada sección
  const sumaC = (f) => datos.comunidades.reduce((s, c) => s + f(c.partes), 0);
  const parte = (p, t) => (p[t] ? p[t].altos + p[t].eventual : 0);
  const autonomico = sumaC((p) => parte(p, "gobierno") + parte(p, "parlamento"));
  const local = sumaC((p) => (p.local ? p.local.electos + p.local.diputaciones + p.local.eventual : 0));
  const NIVELES = [
    { href: "comunidades.html", icono: "comunidades", titulo: "Comunidades autónomas", txt: "Gobiernos y parlamentos autonómicos", v: autonomico, col: "--c-1" },
    { href: "ayuntamientos.html", icono: "ayuntamientos", titulo: "Municipios", txt: "Alcaldes, concejales y diputaciones", v: local, col: "--c-4" },
    { href: "gobierno.html", icono: "gobierno", titulo: "Gobierno central", txt: "Ministerios, Congreso y Senado", v: estado, col: "--c-7" },
  ];
  document.getElementById("reparto").innerHTML = NIVELES.map((n) => `<span style="flex:${n.v};background:var(${n.col})" title="${n.titulo}"></span>`).join("");
  document.getElementById("niveles").innerHTML = NIVELES.map((n) => `
    <a class="nivel" href="${n.href}">
      <span class="icono-caja" style="color:var(${n.col})">${C.icono(n.icono)}</span>
      <span class="nivel-txt"><b>${n.titulo}</b><span>${n.txt}</span></span>
      <span class="nivel-v"><b>${C.eur2(n.v / pob)}</b><span>${C.pct(n.v / total)} del total</span></span>
    </a>`).join("");

  // Lo que ha cambiado con el Gobierno actual (detalle en gobierno.html#este)
  document.getElementById("alertas").innerHTML = C.alertasGobierno(C.comparaGobiernos(hist.estado));
  document.getElementById("calc-icono").innerHTML = C.icono("calculadora");

  document.getElementById("pie").innerHTML = `Datos oficiales de ${datos.anyo}, actualizados el ${datos.generado} · ${C.masInfo("leer", "Qué se cuenta y de dónde sale")}`;
})();
