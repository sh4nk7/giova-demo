/* Demo — grafici SVG leggeri (sparkline e linee con tooltip). */
(function () {
  "use strict";
  const G = (window.DEMO = window.DEMO || {});
  const NS = "http://www.w3.org/2000/svg";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    const exp = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / exp;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * exp;
  }

  // Sparkline: serie corrente, punto finale evidenziato.
  function sparkline(values, opts) {
    opts = opts || {};
    const w = opts.w || 120;
    const h = opts.h || 36;
    const pts = values.filter((v) => v != null);
    if (pts.length < 2) return "";
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const span = max - min || 1;
    const pad = 3;
    const xy = pts.map((v, i) => [pad + (i * (w - pad * 2)) / (pts.length - 1), h - pad - ((v - min) / span) * (h - pad * 2)]);
    const line = xy.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
    const area = `${line}L${xy[xy.length - 1][0].toFixed(1)},${h}L${xy[0][0].toFixed(1)},${h}Z`;
    const last = xy[xy.length - 1];
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path class="spark-area" d="${area}"/><path class="spark-line" d="${line}" vector-effect="non-scaling-stroke"/><circle class="spark-dot" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.6"/></svg>`;
  }

  // Grafico a linee con asse unico, legenda, crosshair e tooltip.
  function lineChart(el, cfg) {
    el.classList.add("chart");
    el.__cfg = cfg;
    if (!el.__ro && "ResizeObserver" in window) {
      let last = 0;
      el.__ro = new ResizeObserver(() => {
        const w = el.clientWidth;
        if (Math.abs(w - last) > 2) {
          last = w;
          draw(el);
        }
      });
      el.__ro.observe(el);
    }
    draw(el);
  }

  function draw(el) {
    const cfg = el.__cfg;
    if (!cfg) return;
    const width = Math.max(260, el.clientWidth || 600);
    const height = cfg.altezza || 280;
    const narrow = width < 480;
    const m = { t: 12, r: 12, b: 28, l: narrow ? 44 : 56 };
    const iw = width - m.l - m.r;
    const ih = height - m.t - m.b;
    const all = cfg.series.flatMap((s) => s.valori.filter((v) => v != null));
    const minData = Math.min(0, ...all);
    const yMax = niceMax(Math.max(...all) * 1.05);
    const yMin = minData < 0 ? -niceMax(-minData * 1.1) : 0;
    const n = cfg.labels.length;
    const x = (i) => m.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
    const y = (v) => m.t + ih - ((v - yMin) / (yMax - yMin)) * ih;
    const fa = cfg.formatAsse || ((v) => v);
    const ticks = 4;

    let svg = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(cfg.titolo || "Grafico")}">`;
    for (let i = 0; i <= ticks; i++) {
      const v = yMin + ((yMax - yMin) * i) / ticks;
      const yy = y(v).toFixed(1);
      svg += `<line class="grid${v === 0 ? " zero" : ""}" x1="${m.l}" x2="${width - m.r}" y1="${yy}" y2="${yy}"/>`;
      svg += `<text class="axis" x="${m.l - 8}" y="${yy}" text-anchor="end" dominant-baseline="middle">${esc(fa(v))}</text>`;
    }
    cfg.labels.forEach((lab, i) => {
      if (narrow && i % 2 === 1) return;
      svg += `<text class="axis" x="${x(i).toFixed(1)}" y="${height - 8}" text-anchor="middle">${esc(lab)}</text>`;
    });
    cfg.series.forEach((s) => {
      let d = "";
      let pen = false;
      s.valori.forEach((v, i) => {
        if (v == null) {
          pen = false;
          return;
        }
        d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        pen = true;
      });
      svg += `<path class="serie ${s.cls}${s.tratteggio ? " dash" : ""}" d="${d}"/>`;
    });
    svg += `<line class="crosshair" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/>`;
    cfg.series.forEach((s, si) => {
      svg += `<circle class="hover-dot ${s.cls}" data-s="${si}" r="4.5" visibility="hidden"/>`;
    });
    svg += `<rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/>`;
    svg += "</svg>";

    const legend = `<div class="legend">${cfg.series
      .map((s) => `<span class="legend-item"><span class="swatch ${s.cls}${s.tratteggio ? " dash" : ""}"></span>${esc(s.nome)}</span>`)
      .join("")}</div>`;
    el.innerHTML = `${legend}<div class="chart-plot">${svg}<div class="tooltip" hidden></div></div>`;

    const plot = el.querySelector(".chart-plot");
    const svgEl = plot.querySelector("svg");
    const tip = plot.querySelector(".tooltip");
    const cross = svgEl.querySelector(".crosshair");
    const dots = svgEl.querySelectorAll(".hover-dot");
    const fmt = cfg.format || ((v) => v);

    function show(clientX) {
      const r = svgEl.getBoundingClientRect();
      const px = ((clientX - r.left) / r.width) * width;
      let i = Math.round(((px - m.l) / iw) * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      const xx = x(i);
      cross.setAttribute("x1", xx);
      cross.setAttribute("x2", xx);
      cross.setAttribute("visibility", "visible");
      let rows = "";
      cfg.series.forEach((s, si) => {
        const v = s.valori[i];
        const dot = dots[si];
        if (v == null) {
          dot.setAttribute("visibility", "hidden");
          return;
        }
        dot.setAttribute("cx", xx);
        dot.setAttribute("cy", y(v));
        dot.setAttribute("visibility", "visible");
        rows += `<div class="tt-row"><span class="swatch ${s.cls}${s.tratteggio ? " dash" : ""}"></span><span>${esc(s.nome)}</span><strong>${esc(fmt(v))}</strong></div>`;
      });
      if (cfg.extraTooltip) rows += cfg.extraTooltip(i) || "";
      tip.innerHTML = `<div class="tt-title">${esc(cfg.labelsLunghe ? cfg.labelsLunghe[i] : cfg.labels[i])}</div>${rows}`;
      tip.hidden = false;
      const left = (xx / width) * r.width;
      const tw = tip.offsetWidth;
      tip.style.left = `${Math.min(Math.max(left - tw / 2, 0), r.width - tw)}px`;
      tip.style.top = "0px";
    }
    function hide() {
      tip.hidden = true;
      cross.setAttribute("visibility", "hidden");
      dots.forEach((d) => d.setAttribute("visibility", "hidden"));
    }
    const hit = svgEl.querySelector(".hit");
    hit.addEventListener("pointermove", (e) => show(e.clientX));
    hit.addEventListener("pointerdown", (e) => show(e.clientX));
    hit.addEventListener("pointerleave", hide);
  }

  G.charts = { sparkline, lineChart };
})();
