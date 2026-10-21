/* Demo — demo guidata passo per passo. */
(function () {
  "use strict";
  const G = window.DEMO;
  const D = G.data;
  const I = G.icon;
  const $ = (s, r) => (r || document).querySelector(s);

  const DOMANDA_FINALE = "Quali commesse hanno perso più margine?";

  const STEPS = [
    {
      hash: "#/cruscotto",
      target: "#kpi-row",
      titolo: "Il cruscotto della direzione",
      testo: "Fatturato, margine operativo, EBIT e commesse attive, sempre confrontati con lo stesso periodo dell'anno prima. I dati arrivano ogni notte dal gestionale: niente più fogli Excel da consolidare a fine mese.",
    },
    {
      hash: "#/cruscotto",
      target: "#card-andamento",
      titolo: "L'andamento mese per mese",
      testo: "Il 2026 (linea continua) contro il 2025 (tratteggiata). Passa sul grafico per leggere i valori di ogni mese. Accanto, la piattaforma segnala da solo le commesse che stanno perdendo margine.",
    },
    {
      hash: "#/clienti",
      target: "#tabella-clienti",
      titolo: "Clienti e gruppi",
      testo: "Le commesse dello stesso gruppo sono aggregate automaticamente. Ordina per fatturato o margine, filtra per settore ed esporta in CSV con un clic.",
    },
    {
      hash: "#/clienti/ardenza",
      target: "#kpi-cliente",
      titolo: "Il dettaglio di un cliente",
      testo: "Gruppo Vetrerie Ardenza cresce nel fatturato, ma una delle sue tre commesse sta erodendo il margine. Vediamo quale.",
    },
    {
      hash: "#/clienti/ardenza/04122",
      target: "#drawer-panel",
      titolo: "Il conto economico di commessa",
      testo: "Ogni voce di costo confrontata con l'anno precedente e con la sua incidenza sui ricavi. La piattaforma evidenzia la voce che spiega il calo: qui il personale non si è adeguato alla riduzione dei volumi.",
      lato: "sinistra",
    },
    {
      hash: "#/appalto",
      target: "#simulazione-tariffa",
      titolo: "Simulare prima di negoziare",
      testo: "Per gli appalti a pezzo la piattaforma calcola ricavo, pezzi e canoni dei carrelli a noleggio. Abbiamo appena applicato l'adeguamento ISTAT: l'effetto sul periodo e su dodici mesi si ricalcola subito.",
      azione: () => G.setTariffa && G.setTariffa(D.TARIFFA_NUOVA_ISTAT),
    },
    {
      hash: "#/budget",
      target: "#tabella-budget",
      titolo: "Budget e previsionale",
      testo: "Budget, consuntivo di fine agosto e proiezione a fine anno, con la stagionalità. Il controller corregge il previsionale voce per voce e i totali si aggiornano subito.",
    },
    {
      hash: "#/cruscotto",
      target: "#assistant",
      titolo: "Chiedi all'assistente",
      testo: "L'assistente risponde in linguaggio naturale usando i dati della schermata aperta. Gli abbiamo appena chiesto quali commesse hanno perso più margine.",
      lato: "sinistra",
      azione: () => {
        G.assistant.reset();
        G.assistant.open();
        setTimeout(() => G.assistant.ask(DOMANDA_FINALE), 350);
      },
    },
  ];

  let idx = -1;
  let attivo = false;
  let raf = 0;

  function el(id) {
    return document.getElementById(id);
  }

  function aspetta(sel, ms) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      (function loop() {
        const e = $(sel);
        if (e && e.getBoundingClientRect().height > 0) return resolve(e);
        if (performance.now() - t0 > ms) return resolve(null);
        requestAnimationFrame(loop);
      })();
    });
  }

  function posiziona() {
    if (!attivo) return;
    const step = STEPS[idx];
    const target = $(step.target);
    const spot = el("tour-spot");
    const card = el("tour-card");
    if (!target) return;
    const r = target.getBoundingClientRect();
    const pad = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const top = Math.max(4, r.top - pad);
    const left = Math.max(4, r.left - pad);
    const w = Math.min(vw - 8, r.width + pad * 2);
    const h = Math.min(vh - top - 4, r.height + pad * 2);
    Object.assign(spot.style, { top: `${top}px`, left: `${left}px`, width: `${w}px`, height: `${h}px` });

    const mobile = vw < 700;
    card.classList.toggle("sheet", mobile);
    if (mobile) {
      Object.assign(card.style, { top: "", left: "", bottom: "" });
      return;
    }
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const gap = 14;
    let x;
    let y;
    if (step.lato === "sinistra" && left - cw - gap > 8) {
      x = left - cw - gap;
      y = Math.min(Math.max(8, top + 40), vh - ch - 8);
    } else if (top + h + gap + ch < vh - 8) {
      x = left;
      y = top + h + gap;
    } else if (top - gap - ch > 8) {
      x = left;
      y = top - gap - ch;
    } else {
      x = left + w - cw - 16;
      y = vh - ch - 16;
    }
    x = Math.min(Math.max(8, x), vw - cw - 8);
    Object.assign(card.style, { left: `${x}px`, top: `${y}px`, bottom: "" });
  }

  function loopPosizione() {
    cancelAnimationFrame(raf);
    let n = 0;
    (function tick() {
      posiziona();
      if (attivo && n++ < 40) raf = requestAnimationFrame(tick);
    })();
  }

  async function vai(i) {
    if (i < 0 || i >= STEPS.length) return;
    idx = i;
    const step = STEPS[i];
    const card = el("tour-card");
    card.classList.add("loading");
    if (i !== STEPS.length - 1 && G.assistant.isOpen()) G.assistant.close();
    if (location.hash !== step.hash) {
      location.hash = step.hash;
    }
    const target = await aspetta(step.target === "#assistant" ? "#cruscotto-pronto, #kpi-row" : step.target, 2500);
    if (idx !== i || !attivo) return;
    if (step.azione) step.azione();
    const t = step.target === "#assistant" ? await aspetta("#assistant.open", 1500) : target;
    if (idx !== i || !attivo) return;
    if (t && step.target !== "#drawer-panel" && step.target !== "#assistant") {
      const r = t.getBoundingClientRect();
      const mobile = window.innerWidth < 700;
      const spazioSotto = mobile ? window.innerHeight * 0.45 : 0;
      if (r.top < 70 || r.bottom > window.innerHeight - spazioSotto) {
        window.scrollTo({ top: window.scrollY + r.top - 80, behavior: "auto" });
      }
    }
    el("tour-step").textContent = `Passaggio ${i + 1} di ${STEPS.length}`;
    el("tour-title").textContent = step.titolo;
    el("tour-text").textContent = step.testo;
    el("tour-prev").disabled = i === 0;
    el("tour-next").innerHTML = i === STEPS.length - 1 ? `Fine ${I("check")}` : `Avanti ${I("freccia_dx")}`;
    el("tour-dots").innerHTML = STEPS.map((_, j) => `<span class="${j === i ? "on" : ""}"></span>`).join("");
    card.classList.remove("loading");
    loopPosizione();
    el("tour-next").focus({ preventScroll: true });
  }

  function start() {
    if (attivo) return;
    attivo = true;
    document.body.classList.add("touring");
    el("tour").hidden = false;
    vai(0);
  }

  function stop() {
    attivo = false;
    cancelAnimationFrame(raf);
    document.body.classList.remove("touring");
    el("tour").hidden = true;
    el("btn-tour").focus({ preventScroll: true });
  }

  G.tour = {
    init() {
      const btn = el("btn-tour");
      btn.innerHTML = `${I("play")}<span>Demo guidata</span>`;
      btn.addEventListener("click", start);
      el("tour-next").addEventListener("click", () => (idx >= STEPS.length - 1 ? stop() : vai(idx + 1)));
      el("tour-prev").addEventListener("click", () => vai(idx - 1));
      el("tour-close").addEventListener("click", stop);
      el("tour-close").innerHTML = I("chiudi");
      document.addEventListener("keydown", (e) => {
        if (!attivo) return;
        if (e.key === "Escape") {
          e.preventDefault();
          stop();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          idx >= STEPS.length - 1 ? stop() : vai(idx + 1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          vai(idx - 1);
        }
      });
      window.addEventListener("resize", () => attivo && loopPosizione());
      window.addEventListener("scroll", () => attivo && posiziona(), { passive: true });
      if (/[?&]tour=1\b/.test(location.search)) setTimeout(start, 400);
    },
    start,
    stop,
    attivo: () => attivo,
    passi: STEPS.length,
  };
})();
