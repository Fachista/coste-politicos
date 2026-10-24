// Utilidades compartidas por todas las páginas: formatos, menú, descargas y citas
(function () {
  "use strict";

  const fmtEur = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtEnt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" });
  const fmtM = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: "always" });
  const fmtPct = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });

  const C = {
    fmtEur, fmtEnt, fmtM, fmtPct,
    eur: (v) => fmtEnt.format(Math.round(v)) + " €",
    eur2: (v) => fmtEur.format(v) + " €",
    millones: (v) => (Math.abs(v) >= 1e6 ? fmtM.format(v / 1e6) + " M€" : fmtEnt.format(Math.round(v / 1000)) + " mil €"),
    pct: (v) => fmtPct.format(v * 100) + " %",
    css: (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim(),
    esc: (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
    json: (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url + ": " + r.status); return r.json(); }),
  };

  // Coste "núcleo" de una comunidad (lo que la web suma por defecto): gobierno, parlamento y política local
  C.nucleoComunidad = function (c) {
    const p = c.partes, s = (t) => (p[t] ? p[t].altos + p[t].eventual : 0);
    const l = p.local || { electos: 0, diputaciones: 0, eventual: 0 };
    return s("gobierno") + s("parlamento") + l.electos + l.diputaciones + l.eventual;
  };
  // Gobierno central y Cortes (sin organismos ni órganos constitucionales)
  C.nucleoEstado = function (est) {
    const s = (t) => (est.partes[t] ? est.partes[t].altos + est.partes[t].eventual : 0);
    return s("gobierno") + s("congreso") + s("senado");
  };

  // Gobierno actual frente al anterior, con los presupuestos que elaboró cada uno (sin años prorrogados)
  // e importes en euros sin inflación. Lo usan la portada y la pestaña «Este Gobierno».
  C.comparaGobiernos = function (serie) {
    const real = (r, k) => (k === "nucleo" ? r.gobierno_altos + r.gobierno_asesores + r.congreso + r.senado : r[k]) * r.factor_ipc;
    const media = (rs, f) => rs.reduce((s, r) => s + f(r), 0) / rs.length;
    const propios = (autor) => serie.filter((r) => r.autor === autor && !r.prorrogado && r.factor_ipc);
    const autores = [...new Set(serie.map((r) => r.autor))];
    const actual = serie[serie.length - 1].gobierna;
    const anterior = autores[autores.indexOf(actual) - 1];
    const A = propios(anterior), B = propios(actual);
    const ultA = A[A.length - 1], ultB = B[B.length - 1];
    const moncloa = (r) => (r.por_ministerio.find((m) => /^Presidencia/.test(m.nombre)) || { asesores: 0 }).asesores * r.factor_ipc;
    const prorrogados = serie.filter((r) => r.prorrogado);
    const prorrogadosB = prorrogados.filter((r) => r.gobierna === actual);
    const mediaReal = (rs, k) => media(rs, (r) => real(r, k));
    return {
      real, media, propios, autores, actual, anterior, A, B, ultA, ultB, prorrogados, prorrogadosB,
      anyosB: serie.filter((r) => r.gobierna === actual).length,
      apellido: (p) => (p.includes("Zapatero") ? "Zapatero" : p.split(" ").slice(-1)[0]),
      rango: (rs) => (rs.length > 1 ? `${rs[0].anyo}-${rs[rs.length - 1].anyo}` : `${rs[0].anyo}`),
      compara: [
        { t: "Ministerios", a: ultA.ministerios, b: ultB.ministerios, f: (v) => v,
          nota: Math.max(...serie.map((r) => r.ministerios)) === ultB.ministerios ? "El máximo desde 2007" : "" },
        { t: "Secretarías de Estado", a: ultA.secretarias_estado, b: ultB.secretarias_estado, f: (v) => v },
        { t: "Asesores de los ministerios, al año", a: mediaReal(A, "gobierno_asesores"), b: mediaReal(B, "gobierno_asesores"), f: C.millones },
        { t: "Asesores de Moncloa, al año", a: moncloa(ultA), b: moncloa(ultB), f: C.millones },
        { t: "Altos cargos de los ministerios, al año", a: mediaReal(A, "gobierno_altos"), b: mediaReal(B, "gobierno_altos"), f: C.millones },
      ],
      extra: mediaReal(B, "nucleo") - mediaReal(A, "nucleo"),
    };
  };
  C.pctCambio = (a, b) => (b >= a ? "+" : "−") + C.pct(Math.abs(b / a - 1));
  // Tres tarjetas de aviso que llevan a «Este Gobierno»
  C.alertasGobierno = function (g) {
    const k = (val, txt) => `<a class="alerta-tarjeta" href="gobierno.html#este"><b>${val}</b><span>${txt}</span><i aria-hidden="true">›</i></a>`;
    return k(`${g.compara[0].a} → ${g.compara[0].b}`, "ministerios") +
      k(C.pctCambio(g.compara[2].a, g.compara[2].b), "gasto en asesores de los ministerios") +
      k(`${g.prorrogadosB.length} de ${g.anyosB}`, "años sin presupuesto nuevo");
  };

  // Descarga de un CSV generado en el navegador (separador ;, decimales con coma: abre bien en Excel en español)
  C.descargarCSV = function (nombre, cabecera, filas) {
    const celda = (v) => {
      if (typeof v === "number") return String(v).replace(".", ",");
      const t = String(v ?? "");
      return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    };
    const texto = "﻿" + [cabecera, ...filas].map((f) => f.map(celda).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  };

  // Botón «copiar»: copia el texto y confirma en el propio botón
  C.copiar = async function (boton, texto) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch (e) {
      const t = document.createElement("textarea");
      t.value = texto;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    const antes = boton.textContent;
    boton.textContent = "Copiado ✓";
    setTimeout(() => (boton.textContent = antes), 1500);
  };

  // Tooltip compartido
  let tip;
  C.tip = function (ev, html) {
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "tip";
      tip.setAttribute("role", "tooltip");
      document.body.appendChild(tip);
    }
    tip.innerHTML = html;
    tip.hidden = false;
    const x = Math.min(ev.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    const y = Math.min(ev.clientY + 14, window.innerHeight - tip.offsetHeight - 8);
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top = Math.max(8, y) + "px";
  };
  C.ocultarTip = () => tip && (tip.hidden = true);

  // Iconos de trazo (24×24) para la navegación
  const ICONO = {
    inicio: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    comunidades: '<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z"/><path d="M9 4v14M15 6v14"/>',
    ayuntamientos: '<path d="M4 20h16"/><path d="M6 20V9h12v11"/><path d="M12 4l7 5H5z"/><path d="M10 20v-5h4v5"/>',
    gobierno: '<path d="M3 20h18"/><path d="M4 9h16"/><path d="M12 3l8 4H4z"/><path d="M6 9v8M10 9v8M14 9v8M18 9v8"/><path d="M4 17h16"/>',
    calculadora: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>',
    fuentes: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 10h8M8 14h8M8 18h5"/>',
    info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor"/><path d="M12 11v6M12 7.5v.5"/>',
  };
  C.icono = (n) => `<svg class="icono" viewBox="0 0 24 24" aria-hidden="true">${ICONO[n]}</svg>`;
  // Enlace discreto a la explicación de cada dato en «Fuentes de datos»
  C.masInfo = (ancla, texto = "De dónde sale este dato") => `<a class="mas-info" href="fuentes.html#${ancla}">${C.icono("info")}${texto}</a>`;

  // Navegación: cinco destinos, arriba en escritorio y en una barra fija abajo en el móvil
  const SECCIONES = [
    ["index.html", "Inicio", "inicio", "Inicio"],
    ["comunidades.html", "Comunidades", "comunidades", "Comunidades"],
    ["ayuntamientos.html", "Municipios", "ayuntamientos", "Municipios"],
    ["gobierno.html", "Gobierno central", "gobierno", "Gobierno"],
    ["fuentes.html", "Fuentes de datos", "fuentes", "Fuentes"],
  ];
  // Páginas sin hueco propio en la barra: se marca la sección de la que cuelgan
  const PADRE = { "calculadora.html": "gobierno.html", "periodistas.html": "fuentes.html" };
  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.getElementById("menu");
    if (!nav) return;
    const pagina = location.pathname.split("/").pop() || "index.html";
    const actual = PADRE[pagina] || pagina;
    const enlace = (h, t, i) => `<a href="${h}"${h === actual ? ' aria-current="page"' : ""}>${C.icono(i)}<span>${t}</span></a>`;
    nav.innerHTML = `<a class="marca" href="index.html"><span class="marca-punto"></span>Coste de los políticos</a>
      <div class="menu-enlaces">${SECCIONES.map(([h, t, i]) => enlace(h, t, i)).join("")}</div>`;
    const barra = document.createElement("nav");
    barra.className = "barra-inferior";
    barra.setAttribute("aria-label", "Secciones");
    barra.innerHTML = SECCIONES.map(([h, , i, c]) => enlace(h, c, i)).join("");
    document.body.append(barra);
  });

  window.C = C;
})();
