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

  // Compartir: hoja nativa del móvil si existe (WhatsApp, Telegram…); si no, copia texto y enlace
  C.compartir = async function (boton, texto, url) {
    const enlace = url || location.href;
    if (navigator.share) {
      try { await navigator.share({ title: document.title, text: texto, url: enlace }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    C.copiar(boton, texto + " " + enlace);
  };

  // Menú común. Pocas entradas y con nombres llanos; la sección de periodistas va aparte, como enlace secundario.
  // Los nombres de archivo no cambian: los enlaces de fuera siguen funcionando.
  const PAGINAS = [
    ["comunidades.html", "Tu comunidad"],
    ["ayuntamientos.html", "Tu ayuntamiento"],
    ["estado.html", "Gobierno de España"],
    ["sueldos.html", "Cuánto cobran"],
    ["calculadora.html", "Qué se podría pagar"],
  ];
  const SECUNDARIA = ["periodistas.html", "Periodistas y datos", "Cifras para citar, descargas y método"];
  const LOGO = `<svg viewBox="0 0 24 24" aria-hidden="true" class="marca-logo"><rect x="3" y="12" width="4" height="9" rx="1.5"/><rect x="10" y="7" width="4" height="14" rx="1.5"/><rect x="17" y="3" width="4" height="18" rx="1.5"/></svg>`;
  const ICONO_MENU = `<svg viewBox="0 0 24 24" aria-hidden="true" class="ico-abrir"><path d="M4 7h16M4 12h16M4 17h16"/></svg><svg viewBox="0 0 24 24" aria-hidden="true" class="ico-cerrar"><path d="M6 6l12 12M18 6 6 18"/></svg>`;

  document.addEventListener("DOMContentLoaded", () => {
    const nav = document.getElementById("menu");
    if (!nav) return;
    const actual = location.pathname.split("/").pop() || "index.html";
    const enlace = ([h, t]) => `<a href="${h}"${h === actual ? ' aria-current="page"' : ""}>${t}</a>`;
    nav.innerHTML = `<a class="marca" href="index.html"${actual === "index.html" ? ' aria-current="page"' : ""}>${LOGO}<span>Coste de los políticos</span></a>
      <button class="menu-boton" type="button" aria-expanded="false" aria-controls="menu-enlaces">${ICONO_MENU}<span>Menú</span></button>
      <div class="menu-enlaces" id="menu-enlaces">
        <a class="solo-movil" href="index.html"${actual === "index.html" ? ' aria-current="page"' : ""}>Inicio</a>
        ${PAGINAS.map(enlace).join("")}
        <a class="menu-secundario" href="${SECUNDARIA[0]}"${SECUNDARIA[0] === actual ? ' aria-current="page"' : ""}>${SECUNDARIA[1]}<small>${SECUNDARIA[2]}</small></a>
      </div>`;
    const boton = nav.querySelector(".menu-boton");
    const abrir = (si) => {
      nav.classList.toggle("abierto", si);
      boton.setAttribute("aria-expanded", String(si));
      boton.querySelector("span").textContent = si ? "Cerrar" : "Menú";
    };
    boton.addEventListener("click", () => abrir(!nav.classList.contains("abierto")));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("abierto")) { abrir(false); boton.focus(); }
    });
    document.addEventListener("click", (e) => { if (nav.classList.contains("abierto") && !nav.contains(e.target)) abrir(false); });

    // Alto de la cabecera fija: lo usan los anclajes (scroll-margin) y las barras fijas
    const medir = () => document.documentElement.style.setProperty("--alto-cab", nav.offsetHeight + "px");
    medir();
    if ("ResizeObserver" in window) new ResizeObserver(medir).observe(nav);
    else window.addEventListener("resize", medir);
  });

  window.C = C;
})();
