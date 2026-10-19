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

  // Menú común: se marca la página actual
  const PAGINAS = [
    ["index.html", "Inicio"],
    ["comunidades.html", "Tu comunidad"],
    ["ayuntamientos.html", "Tu ayuntamiento"],
    ["estado.html", "Gobierno de España"],
    ["sueldos.html", "Cuánto cobran"],
    ["calculadora.html", "¿Qué se podría pagar?"],
    ["periodistas.html", "Periodistas y datos"],
  ];
  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.getElementById("menu");
    if (!nav) return;
    const actual = location.pathname.split("/").pop() || "index.html";
    nav.innerHTML = `<a class="marca" href="index.html">Coste de los políticos</a>
      <button class="menu-boton" aria-expanded="false" aria-controls="menu-enlaces">Menú</button>
      <div class="menu-enlaces" id="menu-enlaces">${PAGINAS.map(([h, t]) =>
        `<a href="${h}"${h === actual ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</div>`;
    const boton = nav.querySelector(".menu-boton");
    boton.addEventListener("click", () => {
      const abierto = nav.classList.toggle("abierto");
      boton.setAttribute("aria-expanded", abierto);
    });
  });

  window.C = C;
})();
