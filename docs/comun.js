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

  // Iconos de trazo (24×24) para la navegación
  const ICONO = {
    inicio: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    comunidades: '<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z"/><path d="M9 4v14M15 6v14"/>',
    ayuntamientos: '<path d="M4 20h16"/><path d="M6 20V9h12v11"/><path d="M12 4l7 5H5z"/><path d="M10 20v-5h4v5"/>',
    gobierno: '<path d="M3 20h18"/><path d="M4 9h16"/><path d="M12 3l8 4H4z"/><path d="M6 9v8M10 9v8M14 9v8M18 9v8"/><path d="M4 17h16"/>',
    mas: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    calculadora: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>',
    periodistas: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 10h8M8 14h8M8 18h5"/>',
  };
  C.icono = (n) => `<svg class="icono" viewBox="0 0 24 24" aria-hidden="true">${ICONO[n]}</svg>`;

  // Navegación común: arriba en escritorio; en el móvil, barra inferior con iconos y «Más» en una hoja
  const PRINCIPALES = [
    ["index.html", "Inicio", "inicio"],
    ["comunidades.html", "Comunidades", "comunidades"],
    ["ayuntamientos.html", "Ayuntamientos", "ayuntamientos", "Municipios"],
    ["gobierno.html", "Gobierno central", "gobierno", "Gobierno"],
  ];
  const SECUNDARIAS = [
    ["calculadora.html", "¿Qué se podría pagar?", "calculadora"],
    ["periodistas.html", "Periodistas y datos", "periodistas"],
  ];
  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.getElementById("menu");
    if (!nav) return;
    const actual = location.pathname.split("/").pop() || "index.html";
    const enlace = ([h, t, i]) => `<a href="${h}"${h === actual ? ' aria-current="page"' : ""}>${C.icono(i)}<span>${t}</span></a>`;
    const enlaceCorto = ([h, t, i, c]) => enlace([h, c || t, i]);
    const enMas = SECUNDARIAS.some(([h]) => h === actual);
    nav.innerHTML = `<a class="marca" href="index.html">Coste de los políticos</a>
      <div class="menu-enlaces">${[...PRINCIPALES, ...SECUNDARIAS].map((x) => enlace(x)).join("")}</div>`;
    const barra = document.createElement("nav");
    barra.className = "barra-inferior";
    barra.setAttribute("aria-label", "Secciones");
    barra.innerHTML = PRINCIPALES.map(enlaceCorto).join("") +
      `<button class="mas"${enMas ? ' aria-current="page"' : ""} aria-expanded="false" aria-controls="hoja-mas">${C.icono("mas")}<span>Más</span></button>`;
    const hoja = document.createElement("div");
    hoja.className = "hoja";
    hoja.id = "hoja-mas";
    hoja.hidden = true;
    hoja.innerHTML = `<div class="hoja-panel" role="dialog" aria-label="Más secciones">${SECUNDARIAS.map((x) => enlace(x)).join("")}</div>`;
    document.body.append(barra, hoja);
    const mas = barra.querySelector(".mas");
    const cerrar = () => { hoja.hidden = true; mas.setAttribute("aria-expanded", "false"); };
    mas.addEventListener("click", () => { hoja.hidden = !hoja.hidden; mas.setAttribute("aria-expanded", String(!hoja.hidden)); });
    hoja.addEventListener("click", (e) => { if (e.target === hoja) cerrar(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar(); });
  });

  window.C = C;
})();
