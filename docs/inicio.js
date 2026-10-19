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

  document.getElementById("cifra").innerHTML = `${C.eur2(porPersona)} <small>por persona y año</small>`;
  document.getElementById("explica").innerHTML =
    `En ${datos.anyo}, los sueldos de los cargos políticos y de sus asesores costaron <b>${C.millones(total)}</b>: ` +
    `${C.millones(comunidades)} en comunidades autónomas y ayuntamientos y ${C.millones(estado)} en el Gobierno central, el Congreso y el Senado.`;
  document.getElementById("equivale").innerHTML =
    `Con ese dinero se pagaría la retribución básica estatal de unos <b>${C.fmtEnt.format(enfermeros)} enfermeros o maestros</b> durante un año. ` +
    `<a href="calculadora.html">Haz tus propias cuentas</a>.`;

  // Frases clave, cada una con su fuente
  const claves = [];
  const filas = datos.comunidades.map((c) => ({ c, v: C.nucleoComunidad(c) / c.poblacion })).sort((a, b) => b.v - a.v);
  const max = filas[0], min = filas[filas.length - 1];
  claves.push({
    frase: `${max.c.nombre} es la comunidad donde los políticos cuestan más por habitante (${C.eur2(max.v)} al año) y ${min.c.nombre}, donde menos (${C.eur2(min.v)}).`,
    fuente: `Presupuestos y cuentas de cada comunidad, ISPA y CONPREL (Ministerio de Hacienda), ${datos.anyo}`, enlace: "comunidades.html",
  });
  const e = hist.estado, porAnyo = (a) => e.find((x) => x.anyo === a);
  const a18 = porAnyo(2018), a23 = porAnyo(2023);
  claves.push({
    frase: `El presupuesto para asesores de los ministerios pasó de ${C.millones(a18.gobierno_asesores)} en 2018 a ${C.millones(a23.gobierno_asesores)} en 2023 (+${C.pct(a23.gobierno_asesores / a18.gobierno_asesores - 1)}). En ese tiempo el número de ministerios pasó de ${a18.ministerios} a ${a23.ministerios}.`,
    fuente: "Presupuestos Generales del Estado 2018 y 2023 (créditos iniciales)", enlace: "estado.html",
  });
  const cargos = hist.sueldos.detalle.cargos;
  const presi = cargos.find((c) => c.cargo === "Presidente del Gobierno");
  const masQuePresi = cargos.filter((c) => c.anual > presi.anual);
  claves.push({
    frase: `${masQuePresi.length} cargos del Estado tienen fijado por ley un sueldo mayor que el del presidente del Gobierno (${C.eur(presi.anual)} brutos al año en ${hist.sueldos.detalle.anyo}). El que más, el ${masQuePresi[0].cargo.charAt(0).toLowerCase() + masQuePresi[0].cargo.slice(1)}, con ${C.eur(masQuePresi[0].anual)}.`,
    fuente: `${hist.sueldos.detalle.ley}, de Presupuestos Generales del Estado (BOE)`, enlace: "sueldos.html",
  });
  const ini = e[0], fin = [...e].reverse().find((x) => x.factor_ipc && !x.prorrogado);
  const realIni = ini.total * ini.factor_ipc, realFin = fin.total * fin.factor_ipc;
  const real = (r) => r.total * r.factor_ipc;
  const minimo = e.filter((r) => r.factor_ipc).reduce((a, b) => (real(b) < real(a) ? b : a));
  const cambio = realFin / realIni - 1;
  claves.push({
    frase: `Descontada la inflación, el Gobierno central presupuesta para altos cargos, asesores y Cortes ${Math.abs(cambio) < 0.015 ? "casi lo mismo que" : (cambio > 0 ? "un " + C.pct(cambio) + " más que" : "un " + C.pct(-cambio) + " menos que")} en ${ini.anyo} (${C.millones(realIni)} entonces, ${C.millones(realFin)} en ${fin.anyo}, en euros de ${hist.base_ipc}). ` +
      `Entre medias bajó hasta ${C.millones(real(minimo))} en ${minimo.anyo}.`,
    fuente: "Presupuestos Generales del Estado (vía Fundación Civio) e IPC del INE (vía Banco Mundial)", enlace: "estado.html",
  });

  const ul = document.getElementById("claves");
  ul.innerHTML = claves.map((k, i) => `<li><div class="frase">${k.frase}</div>
    <div class="fuente-frase">Fuente: ${k.fuente} · <a href="${k.enlace}">ver detalle</a>
    <button class="boton" data-i="${i}">Copiar con fuente</button></div></li>`).join("");
  ul.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    const k = claves[+b.dataset.i];
    C.copiar(b, `${k.frase} (Fuente: ${k.fuente}.)`);
  }));

  document.getElementById("pie").innerHTML = `Datos de ${datos.anyo} actualizados el ${datos.generado}. Población: ${datos.poblacion.fuente}.`;
})();
