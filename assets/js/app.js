/* Demo — applicazione: navigazione, schermate, ricerca, tema. */
(function () {
  "use strict";
  const G = window.DEMO;
  const D = G.data;
  const F = G.fmt;
  const I = G.icon;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ------------------------------------------------------------ stato locale
  const statoIniziale = () => ({
    tariffa: D.APPALTO.tariffaBase[2026],
    carrelli: D.CARRELLI.map((c) => ({ ...c })),
    previsionale: {},
    variabili: D.VARIABILI.map((v) => ({ ...v })),
  });
  let S = statoIniziale();
  G.stato = () => S;

  const sort = { clienti: { key: "ricavi", dir: -1 }, commesse: { key: "ricavi", dir: -1 } };
  const filtri = { clienti: { q: "", tipo: "tutti" }, commesse: { q: "", cliente: "", calo: false } };

  // ------------------------------------------------------------ componenti
  function delta(cur, prev, opt) {
    opt = opt || {};
    let v;
    let testo;
    if (opt.punti) {
      if (prev == null) return `<span class="delta neu">nuova</span>`;
      v = cur - prev;
      testo = F.punti(v);
    } else {
      v = F.delta(cur, prev);
      if (v == null) return `<span class="delta neu">nuova</span>`;
      testo = `${v >= 0 ? "+" : "−"}${F.pct(Math.abs(v))}`;
    }
    const soglia = opt.punti ? 0.001 : 0.0005;
    let tono = Math.abs(v) < soglia ? "neu" : v > 0 ? "pos" : "neg";
    if (opt.inverso && tono !== "neu") tono = tono === "pos" ? "neg" : "pos";
    const ic = Math.abs(v) < soglia ? "uguale" : v > 0 ? "freccia_su" : "freccia_giu";
    return `<span class="delta ${tono}">${I(ic)}${testo}</span>`;
  }

  function kpiCard(o) {
    return `<article class="kpi" ${o.id ? `id="${o.id}"` : ""}>
      <div class="kpi-top"><span class="kpi-label">${esc(o.label)}</span><span class="kpi-ico">${I(o.icon)}</span></div>
      <div class="kpi-mid"><div class="kpi-value">${o.value}</div>${o.spark ? `<div class="kpi-spark">${o.spark}</div>` : ""}</div>
      <div class="kpi-foot">${o.delta || ""}<span class="kpi-sub">${o.sub || ""}</span></div>
    </article>`;
  }

  function pageHead(titolo, sotto, azioni) {
    return `<header class="page-head"><div><h1>${titolo}</h1>${sotto ? `<p class="muted">${sotto}</p>` : ""}</div>${azioni ? `<div class="page-actions">${azioni}</div>` : ""}</header>`;
  }

  function periodoTesto() {
    const p = D.periodo();
    const prec = p.breve.replace("2026", "2025");
    return `${p.breve} confrontato con ${prec}`;
  }

  function th(key, label, cls, stato) {
    const attivo = stato.key === key;
    const dir = attivo ? (stato.dir < 0 ? "desc" : "asc") : "";
    return `<th class="${cls || ""} sortable" data-sort="${key}" aria-sort="${attivo ? (stato.dir < 0 ? "descending" : "ascending") : "none"}"><button type="button">${label}<span class="sort-ind ${dir}"></span></button></th>`;
  }

  function ordina(rows, stato) {
    const k = stato.key;
    return rows.slice().sort((a, b) => {
      const va = a[k];
      const vb = b[k];
      if (typeof va === "string") return va.localeCompare(vb, "it") * stato.dir;
      return ((va ?? -Infinity) - (vb ?? -Infinity)) * stato.dir;
    });
  }

  function csv(nome, intest, righe) {
    const sep = ";";
    const cell = (v) => {
      const s = typeof v === "number" ? String(Math.round(v * 100) / 100).replace(".", ",") : String(v ?? "");
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const txt = "﻿" + [intest, ...righe].map((r) => r.map(cell).join(sep)).join("\r\n");
    const blob = new Blob([txt], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
    toast(`Esportato ${nome}`);
  }

  function toast(msg, tipo) {
    const box = $("#toasts");
    const t = document.createElement("div");
    t.className = `toast ${tipo || ""}`;
    t.setAttribute("role", "status");
    t.innerHTML = `${I(tipo === "warn" ? "avviso" : "check")}<span>${esc(msg)}</span>`;
    box.appendChild(t);
    setTimeout(() => t.classList.add("out"), 2600);
    setTimeout(() => t.remove(), 3000);
  }

  function serieValori(codes, campo) {
    return D.serieMensile(codes, campo);
  }
  function sparkPeriodo(serie) {
    const p = D.periodo();
    const da = p.da === p.a ? Math.max(1, p.a - 5) : p.da;
    return G.charts.sparkline(serie.cur.slice(da - 1, p.a));
  }

  // ------------------------------------------------------------ schermate
  const VIEWS = {};

  // Cruscotto
  VIEWS.cruscotto = function () {
    const k = D.kpiGenerali();
    const tutti = D.tutteLeCommesse();
    const sRic = serieValori(tutti, "ricavi");
    const sMar = serieValori(tutti, "margine");
    const sEbit = serieValori(tutti, "ebit");
    const mPct = k.cur.margine / k.cur.ricavi;
    const mPctPrec = k.prev.margine / k.prev.ricavi;
    const soglia = 0.03;
    const allerta = D.righeCommesse()
      .filter((r) => r.marginePctPrec != null && r.marginePctPrec - r.marginePct >= soglia)
      .sort((a, b) => a.marginePct - a.marginePctPrec - (b.marginePct - b.marginePctPrec));
    const clienti = D.righeClienti().sort((a, b) => b.ricavi - a.ricavi);
    const top = clienti.slice(0, 7);
    const maxR = top[0].ricavi;

    const html = `
      ${pageHead("Cruscotto", `Andamento di ${esc(D.AZIENDA.nome)} · ${periodoTesto()}`, `<button class="btn ghost" data-action="esporta-cruscotto">${I("download")}<span>Esporta</span></button>`)}
      <section class="kpi-grid" id="kpi-row">
        ${kpiCard({ label: "Fatturato", icon: "euro", value: F.eur(k.cur.ricavi), delta: delta(k.cur.ricavi, k.prev.ricavi), sub: `vs ${F.compatto(k.prev.ricavi)}`, spark: sparkPeriodo(sRic) })}
        ${kpiCard({ label: "Margine operativo", icon: "trend", value: F.eur(k.cur.margine), delta: delta(mPct, mPctPrec, { punti: true }), sub: `${F.pct(mPct)} dei ricavi`, spark: sparkPeriodo(sMar) })}
        ${kpiCard({ label: "EBIT", icon: "portafoglio", value: F.eur(k.cur.ebit), delta: delta(k.cur.ebit, k.prev.ebit), sub: `vs ${F.compatto(k.prev.ebit)}`, spark: sparkPeriodo(sEbit) })}
        ${kpiCard({ label: "Commesse attive", icon: "commesse", value: F.num(k.commesseAttive), delta: delta(k.commesseAttive, k.commesseAttivePrec), sub: `su ${k.clientiAttivi} clienti` })}
      </section>
      <section class="grid-2-1">
        <article class="card" id="card-andamento">
          <div class="card-head"><h2>Fatturato mensile</h2><span class="muted small">2026 fino ad agosto · 2025 intero anno</span></div>
          <div id="chart-andamento"></div>
        </article>
        <article class="card" id="card-allerta">
          <div class="card-head"><h2>Commesse da attenzionare</h2><span class="pill warn">${I("avviso")}${allerta.length}</span></div>
          <p class="muted small">Margine operativo in calo di almeno ${F.num(soglia * 100)} punti rispetto al 2025.</p>
          <ul class="alert-list">
            ${allerta
              .map(
                (r) => `<li><a href="#/commesse/${r.code}" class="alert-item">
                  <span class="alert-main"><span class="mono muted">${r.code}</span> <strong>${esc(r.nome)}</strong><span class="muted small block">${esc(r.clienteNome)}</span></span>
                  <span class="alert-num"><strong>${F.pct(r.marginePct)}</strong><span class="muted small block">era ${F.pct(r.marginePctPrec)}</span></span>
                  ${I("chevron_dx", "chev")}
                </a></li>`,
              )
              .join("") || `<li class="muted">Nessuna commessa sotto soglia nel periodo.</li>`}
          </ul>
        </article>
      </section>
      <article class="card flush" id="card-top-clienti">
        <div class="card-head pad"><h2>Primi clienti per fatturato</h2><a class="link" href="#/clienti">Tutti i clienti ${I("freccia_dx")}</a></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Cliente</th><th class="num">Fatturato</th><th class="num hide-sm">vs 2025</th><th class="hide-md">Quota</th><th class="num">Margine</th><th class="num hide-sm">Var.</th></tr></thead>
          <tbody>${top
            .map(
              (r) => `<tr class="row-link" data-href="#/clienti/${r.id}" tabindex="0">
                <td><strong>${esc(r.nome)}</strong><span class="muted small block">${esc(r.settore)} · ${r.nCommesse} ${r.nCommesse === 1 ? "commessa" : "commesse"}</span></td>
                <td class="num">${F.eur(r.ricavi)}</td>
                <td class="num hide-sm">${delta(r.ricavi, r.ricaviPrec)}</td>
                <td class="hide-md"><div class="bar"><span style="width:${((r.ricavi / maxR) * 100).toFixed(1)}%"></span></div><span class="muted small">${F.pct(r.ricavi / k.cur.ricavi)}</span></td>
                <td class="num">${F.pct(r.marginePct)}</td>
                <td class="num hide-sm">${delta(r.marginePct, r.marginePctPrec, { punti: true })}</td>
              </tr>`,
            )
            .join("")}</tbody>
        </table></div>
      </article>`;

    return {
      titolo: "Cruscotto",
      html,
      mount(root) {
        G.charts.lineChart($("#chart-andamento", root), {
          titolo: "Fatturato mensile 2026 e 2025",
          labels: sRic.labels,
          labelsLunghe: D.MESI_LUNGHI.map((m) => m.charAt(0).toUpperCase() + m.slice(1)),
          series: [
            { nome: "2026", valori: sRic.cur, cls: "s1" },
            { nome: "2025", valori: sRic.prev, cls: "s2", tratteggio: true },
          ],
          format: F.eur,
          formatAsse: F.compattoAsse,
          extraTooltip: (i) => {
            const c = sRic.cur[i];
            const p = sRic.prev[i];
            return c != null && p ? `<div class="tt-foot">Variazione ${delta(c, p)}</div>` : "";
          },
        });
        $("[data-action=esporta-cruscotto]", root).addEventListener("click", () => {
          csv(
            "demo-clienti-cruscotto.csv",
            ["Cliente", "Settore", "Fatturato", "Fatturato anno prec.", "Margine %", "Margine % anno prec."],
            clienti.map((r) => [r.nome, r.settore, r.ricavi, r.ricaviPrec, (r.marginePct * 100).toFixed(1), (r.marginePctPrec * 100).toFixed(1)]),
          );
        });
      },
      contesto: () => ({
        periodo: periodoTesto(),
        kpi: {
          fatturato: Math.round(k.cur.ricavi), fatturatoAnnoPrec: Math.round(k.prev.ricavi),
          margineOperativo: Math.round(k.cur.margine), marginePct: +(mPct * 100).toFixed(1), marginePctAnnoPrec: +(mPctPrec * 100).toFixed(1),
          ebit: Math.round(k.cur.ebit), ebitAnnoPrec: Math.round(k.prev.ebit),
          commesseAttive: k.commesseAttive, commesseAttiveAnnoPrec: k.commesseAttivePrec,
        },
        commesseDaAttenzionare: allerta.map((r) => ({ codice: r.code, nome: r.nome, cliente: r.clienteNome, marginePct: +(r.marginePct * 100).toFixed(1), marginePctAnnoPrec: +(r.marginePctPrec * 100).toFixed(1), ebit: Math.round(r.ebit) })),
        clienti: clienti.map((r) => ({ nome: r.nome, fatturato: Math.round(r.ricavi), fatturatoAnnoPrec: Math.round(r.ricaviPrec), marginePct: +(r.marginePct * 100).toFixed(1), marginePctAnnoPrec: +(r.marginePctPrec * 100).toFixed(1) })),
        fatturatoMensile: sRic.labels.map((l, i) => ({ mese: l, anno2026: sRic.cur[i], anno2025: sRic.prev[i] })),
      }),
    };
  };

  // Clienti
  VIEWS.clienti = function () {
    const tot = D.kpiGenerali().cur.ricavi;
    const tutte = D.righeClienti();
    const f = filtri.clienti;
    const visibili = () =>
      ordina(
        tutte.filter((r) => (f.tipo === "tutti" || (f.tipo === "gruppi" ? r.gruppo : !r.gruppo)) && (!f.q || (r.nome + " " + r.settore).toLowerCase().includes(f.q.toLowerCase()))),
        sort.clienti,
      );
    const maxR = Math.max(...tutte.map((r) => r.ricavi));

    const tabella = () => {
      const rows = visibili();
      return `<table class="table">
        <thead><tr>${th("nome", "Cliente", "", sort.clienti)}${th("nCommesse", "Commesse", "num hide-sm", sort.clienti)}${th("ricavi", "Fatturato", "num", sort.clienti)}<th class="num hide-sm">vs 2025</th><th class="hide-md">Quota</th>${th("marginePct", "Margine", "num", sort.clienti)}<th class="num hide-sm">Var.</th>${th("ebit", "EBIT", "num hide-md", sort.clienti)}</tr></thead>
        <tbody>${
          rows
            .map(
              (r) => `<tr class="row-link" data-href="#/clienti/${r.id}" tabindex="0">
            <td><strong>${esc(r.nome)}</strong>${r.gruppo ? ' <span class="pill">Gruppo</span>' : ""}<span class="muted small block">${esc(r.settore)}</span></td>
            <td class="num hide-sm">${r.nCommesse}</td>
            <td class="num">${F.eur(r.ricavi)}</td>
            <td class="num hide-sm">${delta(r.ricavi, r.ricaviPrec)}</td>
            <td class="hide-md"><div class="bar"><span style="width:${((r.ricavi / maxR) * 100).toFixed(1)}%"></span></div><span class="muted small">${F.pct(r.ricavi / tot)}</span></td>
            <td class="num">${F.pct(r.marginePct)}</td>
            <td class="num hide-sm">${delta(r.marginePct, r.marginePctPrec, { punti: true })}</td>
            <td class="num hide-md">${F.eur(r.ebit)}</td>
          </tr>`,
            )
            .join("") || `<tr><td colspan="8" class="empty">Nessun cliente corrisponde ai filtri.</td></tr>`
        }</tbody></table>`;
    };

    const html = `
      ${pageHead("Clienti e gruppi", `${tutte.length} clienti · le commesse dello stesso gruppo sono aggregate · ${periodoTesto()}`, `<button class="btn ghost" data-action="esporta">${I("download")}<span>Esporta CSV</span></button>`)}
      <div class="toolbar">
        <label class="search-field">${I("cerca")}<input type="search" id="filtro-clienti" placeholder="Filtra per nome o settore" value="${esc(f.q)}" aria-label="Filtra clienti"></label>
        <div class="segmented" role="group" aria-label="Tipo di cliente">
          ${[["tutti", "Tutti"], ["gruppi", "Gruppi"], ["singoli", "Clienti singoli"]].map(([id, l]) => `<button type="button" data-tipo="${id}" class="${f.tipo === id ? "on" : ""}" aria-pressed="${f.tipo === id}">${l}</button>`).join("")}
        </div>
      </div>
      <article class="card flush" id="tabella-clienti"><div class="table-wrap">${tabella()}</div></article>`;

    return {
      titolo: "Clienti",
      html,
      mount(root) {
        const wrap = $("#tabella-clienti .table-wrap", root);
        const refresh = () => {
          wrap.innerHTML = tabella();
        };
        $("#filtro-clienti", root).addEventListener("input", (e) => {
          f.q = e.target.value;
          refresh();
        });
        $$("[data-tipo]", root).forEach((b) =>
          b.addEventListener("click", () => {
            f.tipo = b.dataset.tipo;
            $$("[data-tipo]", root).forEach((x) => {
              x.classList.toggle("on", x === b);
              x.setAttribute("aria-pressed", x === b);
            });
            refresh();
          }),
        );
        wrap.addEventListener("click", (e) => {
          const h = e.target.closest("th[data-sort]");
          if (!h) return;
          const key = h.dataset.sort;
          sort.clienti = { key, dir: sort.clienti.key === key ? -sort.clienti.dir : key === "nome" ? 1 : -1 };
          refresh();
        });
        $("[data-action=esporta]", root).addEventListener("click", () =>
          csv(
            "demo-clienti.csv",
            ["Cliente", "Settore", "Gruppo", "Commesse", "Fatturato", "Fatturato anno prec.", "Margine operativo", "Margine %", "EBIT"],
            visibili().map((r) => [r.nome, r.settore, r.gruppo ? "Sì" : "No", r.nCommesse, r.ricavi, r.ricaviPrec, r.margine, (r.marginePct * 100).toFixed(1), r.ebit]),
          ),
        );
      },
      contesto: () => ({
        periodo: periodoTesto(),
        fatturatoTotale: Math.round(tot),
        obiettivoMarginePct: 12,
        clienti: tutte.map((r) => ({ nome: r.nome, settore: r.settore, gruppo: r.gruppo, commesse: r.nCommesse, fatturato: Math.round(r.ricavi), fatturatoAnnoPrec: Math.round(r.ricaviPrec), marginePct: +(r.marginePct * 100).toFixed(1), marginePctAnnoPrec: +(r.marginePctPrec * 100).toFixed(1), ebit: Math.round(r.ebit) })),
      }),
    };
  };

  // Tabella commesse riutilizzabile
  function tabellaCommesse(rows, base, senzaCliente) {
    return `<table class="table">
      <thead><tr><th class="hide-sm">Codice</th><th>Commessa</th><th class="num">Fatturato</th><th class="num hide-sm">vs 2025</th><th class="num">Margine</th><th class="num hide-sm">Var.</th><th class="num hide-md">EBIT</th><th class="num hide-md">Ricavo/ora</th></tr></thead>
      <tbody>${rows
        .map(
          (r) => `<tr class="row-link" data-href="${base}/${r.code}" tabindex="0">
          <td class="mono muted hide-sm">${r.code}</td>
          <td><strong>${esc(r.nome)}</strong>${r.nuova ? ' <span class="pill ok">Nuova</span>' : ""}${senzaCliente ? "" : `<span class="muted small block">${esc(r.clienteNome)}</span>`}</td>
          <td class="num">${F.eur(r.ricavi)}</td>
          <td class="num hide-sm">${delta(r.ricavi, r.ricaviPrec)}</td>
          <td class="num">${F.pct(r.marginePct)}</td>
          <td class="num hide-sm">${delta(r.marginePct, r.marginePctPrec, { punti: true })}</td>
          <td class="num hide-md ${r.ebit < 0 ? "neg-text" : ""}">${F.eur(r.ebit)}</td>
          <td class="num hide-md">${r.ricavoOra ? F.eur2(r.ricavoOra) : "—"}</td>
        </tr>`,
        )
        .join("") || `<tr><td colspan="8" class="empty">Nessuna commessa corrisponde ai filtri.</td></tr>`}</tbody></table>`;
  }

  function ctxCommessa(r) {
    return { codice: r.code, nome: r.nome, cliente: r.clienteNome, nuova: r.nuova, fatturato: Math.round(r.ricavi), fatturatoAnnoPrec: Math.round(r.ricaviPrec), marginePct: +(r.marginePct * 100).toFixed(1), marginePctAnnoPrec: r.marginePctPrec == null ? null : +(r.marginePctPrec * 100).toFixed(1), ebit: Math.round(r.ebit), ore: r.ore, ricavoOra: +r.ricavoOra.toFixed(2) };
  }

  // Dettaglio cliente
  VIEWS.cliente = function (id) {
    const c = D.clienteById.get(id);
    if (!c) return VIEWS.nonTrovato();
    const { cur, prev } = D.confronto(c.commesse);
    const serie = serieValori(c.commesse, "ricavi");
    const rows = D.righeCommesse(c.commesse).sort((a, b) => b.ricavi - a.ricavi);
    const mPct = cur.ricavi ? cur.margine / cur.ricavi : 0;
    const mPctPrec = prev.ricavi ? prev.margine / prev.ricavi : 0;

    const html = `
      <a class="back" href="#/clienti">${I("freccia_sx")} Clienti</a>
      ${pageHead(`${esc(c.nome)} ${c.gruppo ? '<span class="pill">Gruppo</span>' : ""}`, `${esc(c.settore)} · referente ${esc(c.referente)} · ${periodoTesto()}`)}
      <section class="kpi-grid" id="kpi-cliente">
        ${kpiCard({ label: "Fatturato", icon: "euro", value: F.eur(cur.ricavi), delta: delta(cur.ricavi, prev.ricavi), sub: `vs ${F.compatto(prev.ricavi)}`, spark: sparkPeriodo(serie) })}
        ${kpiCard({ label: "Margine operativo", icon: "trend", value: F.eur(cur.margine), delta: delta(mPct, mPctPrec, { punti: true }), sub: `${F.pct(mPct)} dei ricavi` })}
        ${kpiCard({ label: "EBIT", icon: "portafoglio", value: F.eur(cur.ebit), delta: delta(cur.ebit, prev.ebit), sub: `vs ${F.compatto(prev.ebit)}` })}
        ${kpiCard({ label: "Ore lavorate", icon: "orologio", value: F.num(cur.ore), delta: delta(cur.ore, prev.ore), sub: `${F.eur2(cur.ricavi / (cur.ore || 1))} di ricavo per ora` })}
      </section>
      ${id === "corvina" ? `<a class="callout" href="#/appalto">${I("appalto")}<span><strong>Appalto a pezzo attivo.</strong> La commessa 04300 è pagata a tariffa per pezzo: simula l'effetto di una nuova tariffa e dei carrelli a noleggio.</span>${I("chevron_dx", "chev")}</a>` : ""}
      <article class="card flush" id="tabella-commesse-cliente">
        <div class="card-head pad"><h2>Commesse del cliente</h2><span class="muted small">Seleziona una commessa per aprirne il conto economico</span></div>
        <div class="table-wrap">${tabellaCommesse(rows, `#/clienti/${id}`, true)}</div>
      </article>
      <article class="card"><div class="card-head"><h2>Fatturato mensile</h2><span class="muted small">2026 fino ad agosto · 2025 intero anno</span></div><div id="chart-cliente"></div></article>`;

    return {
      titolo: c.nome,
      html,
      mount(root) {
        G.charts.lineChart($("#chart-cliente", root), {
          titolo: `Fatturato mensile ${c.nome}`,
          labels: serie.labels,
          series: [
            { nome: "2026", valori: serie.cur, cls: "s1" },
            { nome: "2025", valori: serie.prev, cls: "s2", tratteggio: true },
          ],
          format: F.eur,
          formatAsse: F.compattoAsse,
          altezza: 240,
        });
      },
      contesto: () => ({
        periodo: periodoTesto(),
        cliente: { nome: c.nome, settore: c.settore, gruppo: c.gruppo },
        kpi: { fatturato: Math.round(cur.ricavi), fatturatoAnnoPrec: Math.round(prev.ricavi), margineOperativo: Math.round(cur.margine), marginePct: +(mPct * 100).toFixed(1), marginePctAnnoPrec: +(mPctPrec * 100).toFixed(1), ebit: Math.round(cur.ebit), ebitAnnoPrec: Math.round(prev.ebit), ore: cur.ore, oreAnnoPrec: prev.ore },
        commesse: rows.map(ctxCommessa),
        vociCosto: D.VOCI_COSTO.map((v) => ({ voce: v.label, periodo: cur.voci[v.code], annoPrec: prev.voci[v.code] })),
      }),
    };
  };

  // Elenco commesse
  VIEWS.commesse = function () {
    const f = filtri.commesse;
    const tutte = D.righeCommesse();
    const visibili = () =>
      ordina(
        tutte.filter(
          (r) =>
            (!f.cliente || r.clienteId === f.cliente) &&
            (!f.calo || (r.marginePctPrec != null && r.marginePct < r.marginePctPrec)) &&
            (!f.q || `${r.code} ${r.nome} ${r.clienteNome}`.toLowerCase().includes(f.q.toLowerCase())),
        ),
        sort.commesse,
      );
    const html = `
      ${pageHead("Commesse", `${tutte.length} commesse · ${periodoTesto()}`, `<button class="btn ghost" data-action="esporta">${I("download")}<span>Esporta CSV</span></button>`)}
      <div class="toolbar">
        <label class="search-field">${I("cerca")}<input type="search" id="filtro-commesse" placeholder="Codice, commessa o cliente" value="${esc(f.q)}" aria-label="Filtra commesse"></label>
        <label class="select-field"><span class="sr-only">Cliente</span><select id="filtro-cliente"><option value="">Tutti i clienti</option>${D.clienti.map((c) => `<option value="${c.id}" ${f.cliente === c.id ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select>${I("chevron_giu")}</label>
        <label class="check"><input type="checkbox" id="filtro-calo" ${f.calo ? "checked" : ""}><span>Solo margine in calo</span></label>
        <label class="select-field"><span class="sr-only">Ordina per</span><select id="ordina-commesse">${[["ricavi", "Ordina per fatturato"], ["marginePct", "Ordina per margine"], ["ebit", "Ordina per EBIT"], ["ricavoOra", "Ordina per ricavo/ora"], ["code", "Ordina per codice"]].map(([k, l]) => `<option value="${k}" ${sort.commesse.key === k ? "selected" : ""}>${l}</option>`).join("")}</select>${I("chevron_giu")}</label>
      </div>
      <article class="card flush" id="tabella-commesse"><div class="table-wrap">${tabellaCommesse(visibili(), "#/commesse")}</div></article>`;
    return {
      titolo: "Commesse",
      html,
      mount(root) {
        const wrap = $("#tabella-commesse .table-wrap", root);
        const refresh = () => (wrap.innerHTML = tabellaCommesse(visibili(), "#/commesse"));
        $("#filtro-commesse", root).addEventListener("input", (e) => {
          f.q = e.target.value;
          refresh();
        });
        $("#filtro-cliente", root).addEventListener("change", (e) => {
          f.cliente = e.target.value;
          refresh();
        });
        $("#filtro-calo", root).addEventListener("change", (e) => {
          f.calo = e.target.checked;
          refresh();
        });
        $("#ordina-commesse", root).addEventListener("change", (e) => {
          const key = e.target.value;
          sort.commesse = { key, dir: key === "code" ? 1 : key === "marginePct" ? 1 : -1 };
          refresh();
        });
        $("[data-action=esporta]", root).addEventListener("click", () =>
          csv(
            "demo-commesse.csv",
            ["Codice", "Commessa", "Cliente", "Fatturato", "Fatturato anno prec.", "Margine %", "EBIT", "Ore", "Ricavo/ora"],
            visibili().map((r) => [r.code, r.nome, r.clienteNome, r.ricavi, r.ricaviPrec, (r.marginePct * 100).toFixed(1), r.ebit, r.ore, r.ricavoOra]),
          ),
        );
      },
      contesto: () => ({ periodo: periodoTesto(), commesse: tutte.map(ctxCommessa) }),
    };
  };

  // Pannello conto economico commessa
  function drawerCommessa(code, chiudiHref) {
    const c = D.commessaByCode.get(code);
    if (!c) return null;
    const { cur, prev } = D.confronto([code]);
    const mPct = cur.ricavi ? cur.margine / cur.ricavi : 0;
    const mPctPrec = prev.ricavi ? prev.margine / prev.ricavi : null;
    const riga = (label, a, b, opt) => {
      opt = opt || {};
      return `<tr class="${opt.cls || ""}"><td>${label}</td><td class="num">${F.eur(a)}</td><td class="num hide-xs">${prev.ricavi ? F.eur(b) : "—"}</td><td class="num">${prev.ricavi ? delta(a, b, { inverso: opt.costo }) : "—"}</td><td class="num hide-xs muted">${cur.ricavi ? F.pct(Math.abs(a) / cur.ricavi) : "—"}</td></tr>`;
    };
    // Voce di costo che spiega di più il cambio di margine.
    let driver = null;
    if (prev.ricavi) {
      D.VOCI_COSTO.forEach((v) => {
        const incCur = cur.voci[v.code] / cur.ricavi;
        const incPrev = prev.voci[v.code] / prev.ricavi;
        const d = incCur - incPrev;
        if (!driver || d > driver.d) driver = { v, d, incCur, incPrev };
      });
    }
    const insight =
      prev.ricavi && Math.abs(mPct - mPctPrec) >= 0.01
        ? `<p class="insight">${I("info")}<span>Margine ${mPct < mPctPrec ? "in calo" : "in crescita"} di <strong>${F.punti(mPct - mPctPrec).replace("+", "").replace("−", "")}</strong>. ${
            driver && driver.d > 0.004 && mPct < mPctPrec
              ? `Pesa soprattutto <strong>${esc(driver.v.label.toLowerCase())}</strong>, passato dal ${F.pct(driver.incPrev)} al ${F.pct(driver.incCur)} dei ricavi.`
              : `I ricavi sono ${cur.ricavi >= prev.ricavi ? "cresciuti" : "calati"} del ${F.pct(Math.abs(F.delta(cur.ricavi, prev.ricavi)))} a parità di struttura dei costi.`
          }</span></p>`
        : c.nuova
          ? `<p class="insight">${I("info")}<span>Commessa avviata a ${D.MESI_LUNGHI[Number(c.inizio.slice(5)) - 1]} 2026: non c'è un confronto con l'anno precedente.</span></p>`
          : "";

    const html = `
      <div class="drawer-head">
        <div><p class="eyebrow">Commessa ${code}</p><h2>${esc(c.nome)}</h2><a class="link small" href="#/clienti/${c.clienteId}">${esc(c.clienteNome)}</a></div>
        <a class="icon-btn" href="${chiudiHref}" aria-label="Chiudi">${I("chiudi")}</a>
      </div>
      <div class="drawer-body">
        <div class="stat-grid">
          <div class="stat"><span>Ricavi</span><strong>${F.eur(cur.ricavi)}</strong>${prev.ricavi ? delta(cur.ricavi, prev.ricavi) : ""}</div>
          <div class="stat"><span>Margine operativo</span><strong>${F.pct(mPct)}</strong>${delta(mPct, mPctPrec, { punti: true })}</div>
          <div class="stat"><span>EBIT</span><strong class="${cur.ebit < 0 ? "neg-text" : ""}">${F.eur(cur.ebit)}</strong>${prev.ricavi ? delta(cur.ebit, prev.ebit) : ""}</div>
          <div class="stat"><span>Ricavo per ora</span><strong>${cur.ore ? F.eur2(cur.ricavi / cur.ore) : "—"}</strong><span class="muted small">${F.num(cur.ore)} ore</span></div>
        </div>
        ${insight}
        <h3>Conto economico di commessa</h3>
        <div class="table-wrap"><table class="table compact" id="ce-commessa">
          <thead><tr><th>Voce</th><th class="num">2026</th><th class="num hide-xs">2025</th><th class="num">Var.</th><th class="num hide-xs">Inc.</th></tr></thead>
          <tbody>
            ${riga("Ricavi", cur.ricavi, prev.ricavi, { cls: "strong" })}
            ${D.VOCI_COSTO.map((v) => riga(esc(v.label), cur.voci[v.code], prev.voci[v.code], { costo: true, cls: driver && driver.v.code === v.code && driver.d > 0.004 && mPct < (mPctPrec ?? 0) ? "highlight" : "" })).join("")}
            ${riga("Margine operativo", cur.margine, prev.margine, { cls: "strong total" })}
            ${riga("Costi di struttura", cur.struttura, prev.struttura, { costo: true })}
            ${riga("EBIT", cur.ebit, prev.ebit, { cls: "strong total" })}
          </tbody>
        </table></div>
        <p class="muted small">${periodoTesto()}. Inc. = incidenza sui ricavi.</p>
      </div>`;

    return {
      html,
      contesto: {
        commessaAperta: {
          codice: code, nome: c.nome, cliente: c.clienteNome, nuova: c.nuova,
          ricavi: cur.ricavi, ricaviAnnoPrec: prev.ricavi, margineOperativo: cur.margine, margineOperativoAnnoPrec: prev.margine,
          marginePct: +(mPct * 100).toFixed(1), marginePctAnnoPrec: mPctPrec == null ? null : +(mPctPrec * 100).toFixed(1),
          ebit: cur.ebit, ebitAnnoPrec: prev.ebit, ore: cur.ore, oreAnnoPrec: prev.ore,
          vociCosto: D.VOCI_COSTO.map((v) => ({ voce: v.label, periodo: cur.voci[v.code], annoPrec: prev.voci[v.code], incidenzaPct: +((cur.voci[v.code] / (cur.ricavi || 1)) * 100).toFixed(1), incidenzaPctAnnoPrec: prev.ricavi ? +((prev.voci[v.code] / prev.ricavi) * 100).toFixed(1) : null })),
          costiStruttura: cur.struttura,
        },
      },
    };
  }

  // Appalto a pezzo
  function appaltoCalcoli() {
    const mesi = [];
    const flotta2025 = S.carrelli.filter((c) => c.matricola !== "RT14-5602" && c.matricola !== "CV-3012");
    const canone2025 = flotta2025.reduce((a, c) => a + c.canone, 0);
    const canoneAttuale = S.carrelli.filter((c) => c.attivo).reduce((a, c) => a + c.canone, 0);
    for (let m = 1; m <= D.ULTIMO_MESE; m++) {
      const k = `2026-${String(m).padStart(2, "0")}`;
      const kp = `2025-${String(m).padStart(2, "0")}`;
      const pz = D.pezzi[k];
      const tarAtt = D.APPALTO.tariffaBase[2026];
      const carr = m <= 2 ? canone2025 : canoneAttuale;
      mesi.push({
        mese: D.MESI[m - 1], meseLungo: D.MESI_LUNGHI[m - 1], pezzi: pz, pezziPrec: D.pezzi[kp],
        ricavo: pz * S.tariffa, ricavoAttuale: pz * tarAtt, ricavoPrec: D.pezzi[kp] * D.APPALTO.tariffaBase[2025],
        carrelli: carr, carrelliPrec: canone2025,
      });
    }
    const p = D.periodo();
    const nelPeriodo = mesi.slice(p.da - 1, p.a);
    const sum = (arr, k) => arr.reduce((a, r) => a + r[k], 0);
    return {
      mesi, nelPeriodo, canoneAttuale, canone2025,
      pezzi: sum(nelPeriodo, "pezzi"), pezziPrec: sum(nelPeriodo, "pezziPrec"),
      ricavo: sum(nelPeriodo, "ricavo"), ricavoAttuale: sum(nelPeriodo, "ricavoAttuale"), ricavoPrec: sum(nelPeriodo, "ricavoPrec"),
      carrelli: sum(nelPeriodo, "carrelli"), carrelliPrec: sum(nelPeriodo, "carrelliPrec"),
      pezziMediMese: sum(mesi, "pezzi") / mesi.length,
    };
  }

  VIEWS.appalto = function () {
    const tarAtt = D.APPALTO.tariffaBase[2026];
    const body = () => {
      const a = appaltoCalcoli();
      const diff = a.ricavo - a.ricavoAttuale;
      const annuo = (S.tariffa - tarAtt) * a.pezziMediMese * 12;
      const inc = a.carrelli / a.ricavo;
      const incPrec = a.carrelliPrec / a.ricavoPrec;
      return { a, diff, annuo, inc, incPrec };
    };
    const kpiHtml = (b) => `
      ${kpiCard({ label: "Pezzi lavorati", icon: "pezzi", value: F.num(b.a.pezzi), delta: delta(b.a.pezzi, b.a.pezziPrec), sub: "vs 2025" })}
      ${kpiCard({ label: "Ricavo appalto", icon: "euro", value: F.eur(b.a.ricavo), delta: delta(b.a.ricavo, b.a.ricavoPrec), sub: `a ${F.eur3(S.tariffa)} per pezzo` })}
      ${kpiCard({ label: "Canoni carrelli", icon: "carrello", value: F.eur(b.a.carrelli), delta: delta(b.a.carrelli, b.a.carrelliPrec, { inverso: true }), sub: `${S.carrelli.filter((c) => c.attivo).length} mezzi attivi` })}
      ${kpiCard({ label: "Incidenza carrelli", icon: "trend", value: F.pct(b.inc), delta: delta(b.inc, b.incPrec, { punti: true, inverso: true }), sub: "sul ricavo appalto" })}`;
    const tabellaMesi = (b) => `<table class="table compact">
      <thead><tr><th>Mese</th><th class="num">Pezzi</th><th class="num hide-sm">Tariffa</th><th class="num">Ricavo</th><th class="num">Carrelli</th><th class="num hide-sm">Incidenza</th></tr></thead>
      <tbody>${b.a.nelPeriodo
        .map((r) => `<tr><td>${r.mese} 2026</td><td class="num">${F.num(r.pezzi)}</td><td class="num hide-sm">${F.eur3(S.tariffa)}</td><td class="num">${F.eur(r.ricavo)}</td><td class="num">${F.eur(r.carrelli)}</td><td class="num hide-sm">${F.pct(r.carrelli / r.ricavo)}</td></tr>`)
        .join("")}
        <tr class="strong total"><td>Totale</td><td class="num">${F.num(b.a.pezzi)}</td><td class="num hide-sm"></td><td class="num">${F.eur(b.a.ricavo)}</td><td class="num">${F.eur(b.a.carrelli)}</td><td class="num hide-sm">${F.pct(b.inc)}</td></tr>
      </tbody></table>`;
    const simHtml = (b) => `
      <div class="sim-out">
        <div><span class="muted small">Effetto nel periodo</span><strong class="${b.diff > 0 ? "pos-text" : b.diff < 0 ? "neg-text" : ""}">${b.diff >= 0 ? "+" : "−"}${F.eur(Math.abs(b.diff))}</strong></div>
        <div><span class="muted small">Effetto su 12 mesi</span><strong class="${b.annuo > 0 ? "pos-text" : b.annuo < 0 ? "neg-text" : ""}">${b.annuo >= 0 ? "+" : "−"}${F.eur(Math.abs(b.annuo))}</strong></div>
      </div>`;
    const carrelliHtml = () => `<table class="table compact">
      <thead><tr><th>Mezzo</th><th class="hide-sm">Fornitore</th><th class="num">Canone/mese</th><th class="num">Attivo</th></tr></thead>
      <tbody>${S.carrelli
        .map(
          (c, i) => `<tr class="${c.attivo ? "" : "off"}"><td><strong>${esc(c.modello)}</strong><span class="muted small block mono">${esc(c.matricola)}${c.nota ? ` · ${esc(c.nota)}` : ""}</span></td><td class="hide-sm">${esc(c.fornitore)}</td><td class="num">${F.eur(c.canone)}</td>
          <td class="num"><label class="switch"><input type="checkbox" data-carrello="${i}" ${c.attivo ? "checked" : ""} aria-label="Carrello ${esc(c.matricola)} attivo"><span></span></label></td></tr>`,
        )
        .join("")}</tbody></table>`;

    const b0 = body();
    const html = `
      <a class="back" href="#/clienti/corvina">${I("freccia_sx")} Corvina Elettrodomestici</a>
      ${pageHead("Appalto a pezzo", `Commessa 04300 · Corvina Elettrodomestici paga ogni pezzo lavorato; i carrelli dedicati sono a noleggio · ${periodoTesto()}`)}
      <section class="kpi-grid" id="kpi-appalto">${kpiHtml(b0)}</section>
      <section class="grid-1-2">
        <article class="card" id="simulazione-tariffa">
          <div class="card-head"><h2>Simula una nuova tariffa</h2><span class="pill">Simulazione</span></div>
          <p class="muted small">Tariffa in vigore: ${F.eur3(tarAtt)} per pezzo. Sposta il cursore per vedere l'effetto sul ricavo.</p>
          <div class="sim-control">
            <input type="range" id="tariffa-range" min="0.290" max="0.340" step="0.001" value="${S.tariffa}" aria-label="Tariffa per pezzo">
            <label class="num-field"><input type="number" id="tariffa-num" min="0.200" max="0.500" step="0.001" value="${S.tariffa.toFixed(3)}" aria-label="Tariffa per pezzo in euro"><span>€/pz</span></label>
          </div>
          <div id="sim-out">${simHtml(b0)}</div>
          <div class="btn-row">
            <button class="btn" data-action="istat">Applica adeguamento ISTAT (${F.eur3(D.TARIFFA_NUOVA_ISTAT)})</button>
            <button class="btn ghost" data-action="ripristina">${I("reset")}<span>Ripristina</span></button>
          </div>
        </article>
        <article class="card"><div class="card-head"><h2>Ricavo mensile 2026</h2><span class="muted small">Tariffa simulata e tariffa in vigore</span></div><div id="chart-appalto"></div></article>
      </section>
      <section class="grid-1-1">
        <article class="card flush" id="tabella-appalto"><div class="card-head pad"><h2>Dettaglio mensile</h2></div><div class="table-wrap">${tabellaMesi(b0)}</div></article>
        <article class="card flush" id="tabella-carrelli"><div class="card-head pad"><h2>Carrelli a noleggio</h2><span class="muted small">Disattiva un mezzo per simularne la restituzione</span></div><div class="table-wrap">${carrelliHtml()}</div></article>
      </section>`;

    let root;
    function aggiorna(soloNumeri) {
      const b = body();
      $("#kpi-appalto", root).innerHTML = kpiHtml(b);
      $("#sim-out", root).innerHTML = simHtml(b);
      $("#tabella-appalto .table-wrap", root).innerHTML = tabellaMesi(b);
      if (!soloNumeri) $("#tabella-carrelli .table-wrap", root).innerHTML = carrelliHtml();
      $("#tariffa-range", root).value = S.tariffa;
      if (document.activeElement !== $("#tariffa-num", root)) $("#tariffa-num", root).value = S.tariffa.toFixed(3);
      grafico(b);
    }
    function grafico(b) {
      G.charts.lineChart($("#chart-appalto", root), {
        titolo: "Ricavo mensile appalto 2026",
        labels: b.a.mesi.map((r) => r.mese),
        labelsLunghe: b.a.mesi.map((r) => `${r.meseLungo.charAt(0).toUpperCase() + r.meseLungo.slice(1)} 2026`),
        series: [
          { nome: `Tariffa simulata (${F.eur3(S.tariffa)})`, valori: b.a.mesi.map((r) => r.ricavo), cls: "s1" },
          { nome: `Tariffa in vigore (${F.eur3(tarAtt)})`, valori: b.a.mesi.map((r) => r.ricavoAttuale), cls: "s2", tratteggio: true },
        ],
        format: F.eur,
        formatAsse: F.compattoAsse,
        altezza: 240,
        extraTooltip: (i) => `<div class="tt-foot">${F.num(b.a.mesi[i].pezzi)} pezzi</div>`,
      });
    }
    G.setTariffa = function (v) {
      S.tariffa = Math.round(Math.min(0.5, Math.max(0.2, v)) * 1000) / 1000;
      if (root && root.isConnected && $("#kpi-appalto", root)) aggiorna(true);
    };
    return {
      titolo: "Appalto a pezzo",
      html,
      mount(r) {
        root = r;
        grafico(b0);
        $("#tariffa-range", root).addEventListener("input", (e) => G.setTariffa(Number(e.target.value)));
        $("#tariffa-num", root).addEventListener("change", (e) => {
          const v = Number(e.target.value);
          if (isFinite(v) && v > 0) G.setTariffa(v);
        });
        $("[data-action=istat]", root).addEventListener("click", () => {
          G.setTariffa(D.TARIFFA_NUOVA_ISTAT);
          toast("Simulata la tariffa con adeguamento ISTAT");
        });
        $("[data-action=ripristina]", root).addEventListener("click", () => {
          G.setTariffa(tarAtt);
          S.carrelli = D.CARRELLI.map((c) => ({ ...c }));
          aggiorna();
        });
        $("#tabella-carrelli", root).addEventListener("change", (e) => {
          const i = e.target.dataset.carrello;
          if (i == null) return;
          S.carrelli[i].attivo = e.target.checked;
          aggiorna();
          toast(`${S.carrelli[i].matricola} ${e.target.checked ? "riattivato" : "escluso dalla simulazione"}`);
        });
      },
      contesto: () => {
        const b = body();
        return {
          periodo: periodoTesto(),
          commessa: "04300 Appalto conto lavoro a pezzo — Corvina Elettrodomestici",
          tariffaInVigore: tarAtt, tariffaSimulata: S.tariffa, tariffaAdeguamentoIstat: D.TARIFFA_NUOVA_ISTAT,
          pezzi: b.a.pezzi, pezziAnnoPrec: b.a.pezziPrec, pezziMediMese: Math.round(b.a.pezziMediMese),
          ricavoConTariffaSimulata: Math.round(b.a.ricavo), ricavoConTariffaInVigore: Math.round(b.a.ricavoAttuale), ricavoAnnoPrec: Math.round(b.a.ricavoPrec),
          effettoNelPeriodo: Math.round(b.diff), effettoSu12Mesi: Math.round(b.annuo),
          canoniCarrelliPeriodo: Math.round(b.a.carrelli), canoniCarrelliAnnoPrec: Math.round(b.a.carrelliPrec), canoneMensileFlottaAttuale: b.a.canoneAttuale, canoneMensileFlotta2025: b.a.canone2025,
          incidenzaCarrelliPct: +(b.inc * 100).toFixed(1), incidenzaCarrelliPctAnnoPrec: +(b.incPrec * 100).toFixed(1),
          carrelli: S.carrelli.map((c) => ({ modello: c.modello, matricola: c.matricola, fornitore: c.fornitore, canone: c.canone, attivo: c.attivo, nota: c.nota })),
        };
      },
    };
  };

  // Budget
  function budgetCalcoli() {
    const rows = D.budgetRighe().map((r) => ({ ...r, previsionale: S.previsionale[r.code] ?? r.proiezione }));
    const get = (code) => rows.find((r) => r.code === code);
    const costiOp = rows.filter((r) => r.tipo === "costo" && r.code !== "struttura");
    const tot = (k) => get("ricavi")[k] - costiOp.reduce((a, r) => a + r[k], 0);
    const mo = { code: "mo", label: "Margine operativo", tipo: "totale", budget: tot("budget"), consuntivo: tot("consuntivo"), proiezione: tot("proiezione"), previsionale: tot("previsionale") };
    const s = get("struttura");
    const ebit = { code: "ebit", label: "EBIT", tipo: "totale", budget: mo.budget - s.budget, consuntivo: mo.consuntivo - s.consuntivo, proiezione: mo.proiezione - s.proiezione, previsionale: mo.previsionale - s.previsionale };
    return { rows, mo, ebit };
  }

  VIEWS.budget = function () {
    const tabella = () => {
      const { rows, mo, ebit } = budgetCalcoli();
      const riga = (r) => {
        const editabile = r.tipo !== "totale";
        const scost = F.delta(r.previsionale, r.budget);
        const modificata = S.previsionale[r.code] != null;
        return `<tr class="${r.tipo === "totale" ? "strong total" : ""}">
          <td>${esc(r.label)}</td>
          <td class="num">${F.eur(r.budget)}</td>
          <td class="num hide-sm">${F.eur(r.consuntivo)}</td>
          <td class="num hide-md">${F.eur(r.proiezione)}</td>
          <td class="num">${
            editabile
              ? `<span class="edit-cell${modificata ? " changed" : ""}"><input type="text" inputmode="numeric" data-prev="${r.code}" value="${F.num(r.previsionale)}" aria-label="Previsionale ${esc(r.label)}">${modificata ? `<button type="button" class="icon-btn xs" data-reset="${r.code}" aria-label="Ripristina proiezione">${I("reset")}</button>` : ""}</span>`
              : F.eur(r.previsionale)
          }</td>
          <td class="num">${scost == null ? "—" : delta(r.previsionale, r.budget, { inverso: r.tipo === "costo" })}</td>
        </tr>`;
      };
      const ricavi = rows[0];
      const costi = rows.slice(1, -1);
      const struttura = rows[rows.length - 1];
      return `<table class="table">
        <thead><tr><th>Voce</th><th class="num">Budget 2026</th><th class="num hide-sm">Consuntivo Gen–Ago</th><th class="num hide-md">Proiezione</th><th class="num">Previsionale</th><th class="num">vs budget</th></tr></thead>
        <tbody>${riga(ricavi)}${costi.map(riga).join("")}${riga(mo)}${riga(struttura)}${riga(ebit)}</tbody></table>`;
    };
    const sintesi = () => {
      const { rows, ebit, mo } = budgetCalcoli();
      const ric = rows[0];
      return `
        ${kpiCard({ label: "Ricavi previsti 2026", icon: "euro", value: F.eur(ric.previsionale), delta: delta(ric.previsionale, ric.budget), sub: `budget ${F.compatto(ric.budget)}` })}
        ${kpiCard({ label: "Margine operativo previsto", icon: "trend", value: F.pct(mo.previsionale / ric.previsionale), delta: delta(mo.previsionale / ric.previsionale, mo.budget / ric.budget, { punti: true }), sub: `budget ${F.pct(mo.budget / ric.budget)}` })}
        ${kpiCard({ label: "EBIT previsto 2026", icon: "portafoglio", value: F.eur(ebit.previsionale), delta: delta(ebit.previsionale, ebit.budget), sub: `budget ${F.compatto(ebit.budget)}` })}`;
    };
    const html = `
      ${pageHead("Budget e previsionale 2026", "Budget approvato a dicembre 2025, consuntivo a fine agosto e previsionale di fine anno. La proiezione tiene conto della stagionalità di settembre–dicembre.", `<button class="btn ghost" data-action="reset-budget">${I("reset")}<span>Ripristina proiezioni</span></button>`)}
      <section class="kpi-grid three" id="kpi-budget">${sintesi()}</section>
      <article class="card flush" id="tabella-budget">
        <div class="card-head pad"><h2>Conto economico previsionale</h2><span class="muted small">Modifica i valori della colonna Previsionale: totali e scostamenti si aggiornano subito</span></div>
        <div class="table-wrap">${tabella()}</div>
      </article>`;
    let root;
    const refresh = (focusCode) => {
      $("#tabella-budget .table-wrap", root).innerHTML = tabella();
      $("#kpi-budget", root).innerHTML = sintesi();
      if (focusCode) {
        const inp = $(`[data-prev="${focusCode}"]`, root);
        if (inp) inp.focus();
      }
    };
    G.setPrevisionale = (code, v) => {
      S.previsionale[code] = v;
      if (root && root.isConnected) refresh();
    };
    return {
      titolo: "Budget",
      html,
      mount(r) {
        root = r;
        const wrap = $("#tabella-budget", root);
        wrap.addEventListener("change", (e) => {
          const code = e.target.dataset.prev;
          if (!code) return;
          const v = Number(String(e.target.value).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
          const rif = D.budgetRighe().find((r) => r.code === code);
          if (!isFinite(v) || v < 0 || (rif && v > rif.budget * 5)) {
            toast("Inserisci un importo valido, in euro", "warn");
            refresh();
            return;
          }
          S.previsionale[code] = Math.round(v);
          refresh();
        });
        wrap.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && e.target.dataset.prev) e.target.blur();
        });
        wrap.addEventListener("focusin", (e) => {
          if (e.target.dataset.prev) e.target.select();
        });
        wrap.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-reset]");
          if (!btn) return;
          delete S.previsionale[btn.dataset.reset];
          refresh();
        });
        $("[data-action=reset-budget]", root).addEventListener("click", () => {
          S.previsionale = {};
          refresh();
          toast("Previsionale riportato alle proiezioni");
        });
      },
      contesto: () => {
        const { rows, mo, ebit } = budgetCalcoli();
        const r = (x) => ({ voce: x.label, budget: Math.round(x.budget), consuntivoGenAgo: Math.round(x.consuntivo), proiezione: Math.round(x.proiezione), previsionale: Math.round(x.previsionale), modificataDallUtente: S.previsionale[x.code] != null });
        return { anno: 2026, nota: "Consuntivo a fine agosto; previsionale = proiezione a fine anno salvo modifiche dell'utente.", righe: rows.map(r), margineOperativo: r(mo), ebit: r(ebit) };
      },
    };
  };

  // Impostazioni
  VIEWS.impostazioni = function () {
    const tema = temaSalvato() || "sistema";
    const html = `
      ${pageHead("Impostazioni", "Profilo, aspetto, parametri di calcolo e collegamenti.")}
      <section class="grid-1-1">
        <article class="card">
          <div class="card-head"><h2>Profilo</h2></div>
          <div class="profile"><span class="avatar lg">${D.AZIENDA.utente.iniziali}</span><div><strong>${esc(D.AZIENDA.utente.nome)}</strong><span class="muted small block">${esc(D.AZIENDA.utente.ruolo)} · ${esc(D.AZIENDA.nome)}</span></div></div>
          <div class="card-head mt"><h2>Aspetto</h2></div>
          <div class="segmented" role="group" aria-label="Tema">
            ${[["light", "Chiaro"], ["dark", "Scuro"], ["sistema", "Come il sistema"]].map(([id, l]) => `<button type="button" data-tema="${id}" class="${tema === id ? "on" : ""}" aria-pressed="${tema === id}">${l}</button>`).join("")}
          </div>
        </article>
        <article class="card" id="card-collegamenti">
          <div class="card-head"><h2>Collegamenti</h2></div>
          <ul class="links-list">
            <li>${I("database")}<div><strong>Gestionale ERP</strong><span class="muted small block">Sincronizzazione notturna di contabilità analitica, ore e commesse · ultimo aggiornamento ${D.AZIENDA.aggiornamento}</span></div><span class="pill ok">Attivo</span></li>
            <li>${I("scintille")}<div><strong>Assistente</strong><span class="muted small block" id="stato-assistente-desc">${G.assistant && G.assistant.live() ? "Risponde Claude dal vivo sui dati della schermata" : "Modalità demo: risposte preimpostate alle domande suggerite"}</span></div><span class="pill ${G.assistant && G.assistant.live() ? "ok" : ""}">${G.assistant && G.assistant.live() ? "Dal vivo" : "Demo"}</span></li>
          </ul>
        </article>
      </section>
      <article class="card flush" id="tabella-variabili">
        <div class="card-head pad"><h2>Variabili di calcolo</h2><span class="muted small">Usate per ore, margini obiettivo e ribaltamento dei costi di sede</span></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Variabile</th><th class="num">Valore</th><th class="hide-sm">Unità</th><th class="hide-sm">Tipo</th></tr></thead>
          <tbody>${S.variabili.map((v, i) => `<tr><td>${esc(v.nome)}</td><td class="num"><span class="edit-cell"><input type="text" data-var="${i}" value="${esc(v.valore)}" aria-label="${esc(v.nome)}"></span></td><td class="hide-sm muted">${esc(v.unita)}</td><td class="hide-sm"><span class="pill">${v.tipo}</span></td></tr>`).join("")}</tbody>
        </table></div>
      </article>
      <div class="btn-row"><button class="btn ghost" data-action="reset-demo">${I("reset")}<span>Ripristina tutti i dati della demo</span></button></div>`;
    return {
      titolo: "Impostazioni",
      html,
      mount(root) {
        $$("[data-tema]", root).forEach((b) =>
          b.addEventListener("click", () => {
            impostaTema(b.dataset.tema === "sistema" ? null : b.dataset.tema);
            $$("[data-tema]", root).forEach((x) => {
              x.classList.toggle("on", x === b);
              x.setAttribute("aria-pressed", x === b);
            });
          }),
        );
        $("#tabella-variabili", root).addEventListener("change", (e) => {
          const i = e.target.dataset.var;
          if (i == null) return;
          S.variabili[i].valore = e.target.value;
          toast(`Salvata: ${S.variabili[i].nome}`);
        });
        $("[data-action=reset-demo]", root).addEventListener("click", () => {
          S = statoIniziale();
          G.assistant && G.assistant.reset();
          render();
          toast("Dati della demo ripristinati");
        });
      },
      contesto: () => ({ variabili: S.variabili.map((v) => ({ nome: v.nome, valore: v.valore, unita: v.unita, tipo: v.tipo })) }),
    };
  };

  VIEWS.nonTrovato = function () {
    return { titolo: "Pagina non trovata", html: `${pageHead("Pagina non trovata", "L'indirizzo non corrisponde a nessuna sezione.")}<a class="btn" href="#/cruscotto">Torna al cruscotto</a>`, mount() {}, contesto: () => ({}) };
  };

  // ------------------------------------------------------------ router
  const NAV = [
    { id: "cruscotto", label: "Cruscotto", icon: "cruscotto", href: "#/cruscotto" },
    { id: "clienti", label: "Clienti", icon: "clienti", href: "#/clienti" },
    { id: "commesse", label: "Commesse", icon: "commesse", href: "#/commesse" },
    { id: "appalto", label: "Appalto a pezzo", icon: "appalto", href: "#/appalto" },
    { id: "budget", label: "Budget", icon: "budget", href: "#/budget" },
    { id: "impostazioni", label: "Impostazioni", icon: "impostazioni", href: "#/impostazioni" },
  ];

  function parse(hash) {
    const path = (hash || "").replace(/^#/, "") || "/cruscotto";
    let m;
    if (path === "/" || path === "/cruscotto") return { sezione: "cruscotto", base: "/cruscotto", view: () => VIEWS.cruscotto() };
    if (path === "/clienti") return { sezione: "clienti", base: path, view: () => VIEWS.clienti() };
    if ((m = path.match(/^\/clienti\/([\w-]+)(?:\/(\d{5}))?$/))) return { sezione: "cliente", base: `/clienti/${m[1]}`, params: { id: m[1], commessa: m[2] }, view: () => VIEWS.cliente(m[1]), drawer: m[2] ? { code: m[2], chiudi: `#/clienti/${m[1]}` } : null };
    if ((m = path.match(/^\/commesse(?:\/(\d{5}))?$/))) return { sezione: "commesse", base: "/commesse", params: { commessa: m[1] }, view: () => VIEWS.commesse(), drawer: m[1] ? { code: m[1], chiudi: "#/commesse" } : null };
    if (path === "/appalto") return { sezione: "appalto", base: path, view: () => VIEWS.appalto() };
    if (path === "/budget") return { sezione: "budget", base: path, view: () => VIEWS.budget() };
    if (path === "/impostazioni") return { sezione: "impostazioni", base: path, view: () => VIEWS.impostazioni() };
    return { sezione: "nonTrovato", base: path, view: () => VIEWS.nonTrovato() };
  }

  let corrente = null;
  let vistaCorrente = null;
  let drawerCorrente = null;

  function render(opts) {
    opts = opts || {};
    const r = parse(location.hash);
    const cambioBase = !corrente || corrente.base !== r.base;
    const main = $("#main");
    if (cambioBase || !opts.soloDrawer) {
      vistaCorrente = r.view();
      main.innerHTML = `<div class="page">${vistaCorrente.html}</div>`;
      vistaCorrente.mount(main);
      if (cambioBase) {
        window.scrollTo(0, 0);
        main.focus({ preventScroll: true });
      }
    }
    corrente = r;
    // navigazione attiva
    const navId = r.sezione === "cliente" ? "clienti" : r.sezione;
    $$(".nav a").forEach((a) => {
      const on = a.dataset.nav === navId;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    $("#topbar-title").textContent = vistaCorrente.titolo;
    document.title = `${vistaCorrente.titolo} · Demo`;
    // pannello commessa
    drawerCorrente = r.drawer ? drawerCommessa(r.drawer.code, r.drawer.chiudi) : null;
    const dr = $("#drawer");
    if (drawerCorrente) {
      $("#drawer-panel").innerHTML = drawerCorrente.html;
      dr.hidden = false;
      requestAnimationFrame(() => dr.classList.add("open"));
      $("#drawer-panel").scrollTop = 0;
      document.body.classList.add("no-scroll");
    } else {
      dr.classList.remove("open");
      dr.hidden = true;
      document.body.classList.remove("no-scroll");
    }
    chiudiMenu();
    document.dispatchEvent(new CustomEvent("demo:route", { detail: { sezione: r.sezione, params: r.params || {} } }));
  }

  function naviga(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  // ------------------------------------------------------------ tema
  function temaSalvato() {
    try {
      return localStorage.getItem("demo-demo-tema");
    } catch (e) {
      return null;
    }
  }
  function temaEffettivo() {
    const t = document.documentElement.dataset.theme;
    if (t) return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function impostaTema(t) {
    if (t) document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    try {
      if (t) localStorage.setItem("demo-demo-tema", t);
      else localStorage.removeItem("demo-demo-tema");
    } catch (e) { /* ignora */ }
    aggiornaIconaTema();
  }
  function aggiornaIconaTema() {
    const scuro = temaEffettivo() === "dark";
    const b = $("#btn-tema");
    b.innerHTML = I(scuro ? "sole" : "luna");
    b.setAttribute("aria-label", scuro ? "Passa al tema chiaro" : "Passa al tema scuro");
    b.title = b.getAttribute("aria-label");
  }
  function alternaTema() {
    impostaTema(temaEffettivo() === "dark" ? "light" : "dark");
  }

  // ------------------------------------------------------------ menu mobile
  function apriMenu() {
    document.body.classList.add("menu-open");
    $("#btn-menu").setAttribute("aria-expanded", "true");
  }
  function chiudiMenu() {
    document.body.classList.remove("menu-open");
    const b = $("#btn-menu");
    if (b) b.setAttribute("aria-expanded", "false");
  }

  // ------------------------------------------------------------ ricerca rapida
  function vociRicerca() {
    const out = [];
    NAV.forEach((n) => out.push({ gruppo: "Sezioni", label: n.label, icon: n.icon, run: () => naviga(n.href) }));
    D.clienti.forEach((c) => out.push({ gruppo: "Clienti", label: c.nome, sub: c.settore, icon: "clienti", run: () => naviga(`#/clienti/${c.id}`) }));
    D.commesse.forEach((c) => out.push({ gruppo: "Commesse", label: `${c.code} · ${c.nome}`, sub: c.clienteNome, icon: "commesse", run: () => naviga(`#/commesse/${c.code}`) }));
    out.push({ gruppo: "Azioni", label: "Avvia la demo guidata", icon: "play", run: () => G.tour.start() });
    out.push({ gruppo: "Azioni", label: "Chiedi all'assistente", icon: "scintille", run: () => G.assistant.open() });
    out.push({ gruppo: "Azioni", label: "Cambia tema chiaro/scuro", icon: "luna", run: alternaTema });
    D.PERIODI.forEach((p) => out.push({ gruppo: "Periodo", label: `Periodo: ${p.label}`, sub: p.breve, icon: "calendario", run: () => cambiaPeriodo(p.id) }));
    return out;
  }
  let risultati = [];
  let sel = 0;
  let focusPrima = null;
  function apriRicerca() {
    focusPrima = document.activeElement;
    const m = $("#palette");
    m.hidden = false;
    const inp = $("#palette-input");
    inp.value = "";
    filtraRicerca("");
    setTimeout(() => inp.focus(), 10);
  }
  function chiudiRicerca() {
    $("#palette").hidden = true;
    if (focusPrima && focusPrima.focus) focusPrima.focus();
  }
  function filtraRicerca(q) {
    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const parole = norm(q).split(/\s+/).filter(Boolean);
    const tutte = vociRicerca();
    risultati = parole.length ? tutte.filter((v) => parole.every((p) => norm(`${v.label} ${v.sub || ""} ${v.gruppo}`).includes(p))) : tutte.filter((v) => v.gruppo !== "Commesse" && v.gruppo !== "Periodo");
    risultati = risultati.slice(0, 40);
    sel = 0;
    disegnaRicerca();
  }
  function disegnaRicerca() {
    const list = $("#palette-list");
    if (!risultati.length) {
      list.innerHTML = `<li class="palette-empty">Nessun risultato</li>`;
      return;
    }
    let html = "";
    let gruppo = "";
    risultati.forEach((v, i) => {
      if (v.gruppo !== gruppo) {
        gruppo = v.gruppo;
        html += `<li class="palette-group" role="presentation">${esc(gruppo)}</li>`;
      }
      html += `<li role="option" id="pal-${i}" data-i="${i}" class="palette-item${i === sel ? " sel" : ""}" aria-selected="${i === sel}">${I(v.icon)}<span>${esc(v.label)}${v.sub ? `<span class="muted small"> · ${esc(v.sub)}</span>` : ""}</span></li>`;
    });
    list.innerHTML = html;
    $("#palette-input").setAttribute("aria-activedescendant", `pal-${sel}`);
    const el = $(`#pal-${sel}`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }
  function eseguiRicerca(i) {
    const v = risultati[i];
    if (!v) return;
    $("#palette").hidden = true;
    v.run();
  }

  function cambiaPeriodo(id) {
    D.setPeriodo(id);
    $("#periodo").value = id;
    render();
    toast(`Periodo: ${D.periodo().label} (${D.periodo().breve})`);
  }

  // ------------------------------------------------------------ avvio
  function initShell() {
    $("#nav").innerHTML = NAV.map((n) => `<a href="${n.href}" data-nav="${n.id}">${I(n.icon)}<span>${n.label}</span></a>`).join("");
    $("#tenant-name").textContent = D.AZIENDA.nome;
    $("#user-name").textContent = D.AZIENDA.utente.nome;
    $("#user-role").textContent = D.AZIENDA.utente.ruolo;
    $("#user-avatar").textContent = D.AZIENDA.utente.iniziali;
    $("#sync-info").textContent = `Dati aggiornati al ${D.AZIENDA.aggiornamento}`;
    $$("[data-icon]").forEach((el) => (el.innerHTML = I(el.dataset.icon) + el.innerHTML));

    const per = $("#periodo");
    per.innerHTML = D.PERIODI.map((p) => `<option value="${p.id}">${p.label} · ${p.breve}</option>`).join("");
    per.value = D.periodo().id;
    per.addEventListener("change", () => cambiaPeriodo(per.value));

    $("#btn-tema").addEventListener("click", alternaTema);
    $("#btn-menu").addEventListener("click", () => (document.body.classList.contains("menu-open") ? chiudiMenu() : apriMenu()));
    $("#scrim").addEventListener("click", chiudiMenu);
    $("#btn-cerca").addEventListener("click", apriRicerca);
    $("#drawer-scrim").addEventListener("click", () => {
      if (corrente && corrente.drawer) naviga(corrente.drawer.chiudi);
    });

    // Tabelle: riga cliccabile e attivabile da tastiera
    document.addEventListener("click", (e) => {
      const tr = e.target.closest("tr.row-link");
      if (tr && !e.target.closest("a,button,input,select,label")) naviga(tr.dataset.href);
    });
    document.addEventListener("keydown", (e) => {
      const tr = e.target.closest && e.target.closest("tr.row-link");
      if (tr && e.key === "Enter") naviga(tr.dataset.href);
    });

    // Ricerca rapida
    const inp = $("#palette-input");
    inp.addEventListener("input", () => filtraRicerca(inp.value));
    inp.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        sel = Math.min(risultati.length - 1, sel + 1);
        disegnaRicerca();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        sel = Math.max(0, sel - 1);
        disegnaRicerca();
      } else if (e.key === "Enter") {
        e.preventDefault();
        eseguiRicerca(sel);
      }
    });
    $("#palette-list").addEventListener("click", (e) => {
      const li = e.target.closest("[data-i]");
      if (li) eseguiRicerca(Number(li.dataset.i));
    });
    $("#palette").addEventListener("mousedown", (e) => {
      if (e.target.id === "palette") chiudiRicerca();
    });

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if ($("#palette").hidden) apriRicerca();
        else chiudiRicerca();
        return;
      }
      if (e.key === "Escape") {
        if (!$("#palette").hidden) return chiudiRicerca();
        if (G.tour && G.tour.attivo()) return;
        if (G.assistant && G.assistant.isOpen()) return G.assistant.close();
        if (corrente && corrente.drawer) return naviga(corrente.drawer.chiudi);
        if (document.body.classList.contains("menu-open")) return chiudiMenu();
      }
    });

    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", aggiornaIconaTema);
    }
    aggiornaIconaTema();
    window.addEventListener("hashchange", () => {
      const r = parse(location.hash);
      render({ soloDrawer: corrente && corrente.base === r.base });
    });
  }

  G.app = {
    naviga,
    toast,
    corrente: () => corrente,
    contesto() {
      const base = vistaCorrente ? vistaCorrente.contesto() : {};
      const ctx = { schermata: vistaCorrente ? vistaCorrente.titolo : "", azienda: D.AZIENDA.nome, ...base };
      if (drawerCorrente) Object.assign(ctx, drawerCorrente.contesto);
      return ctx;
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    initShell();
    if (!location.hash || location.hash === "#" || location.hash === "#/") history.replaceState(null, "", "#/cruscotto");
    render();
    G.assistant && G.assistant.init();
    G.tour && G.tour.init();
    document.body.classList.add("ready");
  });
})();
