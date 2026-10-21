/* Demo — dati di esempio.
 * Tutto è inventato: azienda, clienti, commesse, fornitori, persone e importi.
 * I numeri sono generati in modo deterministico (seed fisso), quindi ogni
 * apertura della demo mostra gli stessi valori. */
(function () {
  "use strict";
  const G = (window.DEMO = window.DEMO || {});

  // ---------------------------------------------------------------- utilità
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20260831);
  const jitter = (amp) => 1 + (rnd() * 2 - 1) * amp;

  const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
  const MESI_LUNGHI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const ANNO = 2026;
  const ANNO_PREC = 2025;
  const ULTIMO_MESE = 8; // dati consolidati fino ad agosto 2026

  // Stagionalità per settore (indice 0 = gennaio).
  const STAGIONI = {
    base: [0.95, 0.97, 1.03, 1.0, 1.02, 1.03, 1.01, 0.74, 1.05, 1.07, 1.06, 1.05],
    moda: [0.92, 1.08, 1.1, 0.96, 0.94, 1.02, 1.06, 0.7, 1.14, 1.12, 1.0, 0.96],
    bevande: [0.78, 0.8, 0.92, 1.02, 1.16, 1.3, 1.34, 1.02, 1.0, 0.9, 0.84, 0.92],
    regalo: [0.8, 0.82, 0.88, 0.86, 0.9, 0.9, 0.88, 0.66, 1.0, 1.18, 1.42, 1.5],
  };

  // Voci di costo operativo e quota tipica sui costi operativi.
  const VOCI_COSTO = [
    { code: "30", label: "Costo del personale", quota: 0.68 },
    { code: "21", label: "Prestazioni di terzi e lavoro temporaneo", quota: 0.1 },
    { code: "19", label: "Noleggio mezzi di movimentazione", quota: 0.07 },
    { code: "01", label: "Materiali di consumo e imballi", quota: 0.045 },
    { code: "11", label: "Manutenzioni e riparazioni", quota: 0.035 },
    { code: "06", label: "Utenze e servizi", quota: 0.035 },
    { code: "16", label: "Esercizio automezzi", quota: 0.02 },
    { code: "26", label: "Mensa e trasferte", quota: 0.015 },
  ];
  const QUOTA_STRUTTURA = 0.055; // costi di sede ribaltati sulle commesse
  const COSTO_ORA_PERSONALE = 23.4;
  const COSTO_ORA_TERZI = 26.8;

  // ------------------------------------------------------ anagrafica fittizia
  const AZIENDA = {
    nome: "Lunaria Servizi Logistici",
    sede: "Parma",
    utente: { nome: "Marta Ferri", ruolo: "Controller", iniziali: "MF" },
    aggiornamento: "31/08/2026",
  };

  // [codice, nome, ricavo medio mensile 2025, crescita 2026, margine 2025, margine 2026, opzioni]
  const CLIENTI_RAW = [
    {
      id: "vallestrella", nome: "Gruppo Moda Vallestrella", settore: "Abbigliamento", stagione: "moda", referente: "Paolo Guidi",
      commesse: [
        ["04010", "Magazzino capi appesi", 156000, 0.06, 0.142, 0.138],
        ["04011", "E-commerce e gestione resi", 98000, 0.19, 0.112, 0.131],
        ["04012", "Controllo qualità e stiro", 42000, -0.05, 0.091, 0.068],
        ["04013", "Spedizioni outlet", 27000, 0.02, 0.121, 0.118],
      ],
    },
    {
      id: "ardenza", nome: "Gruppo Vetrerie Ardenza", settore: "Vetro e packaging", stagione: "base", referente: "Elena Sarti",
      commesse: [
        ["04120", "Pallettizzazione linea forni", 118000, 0.03, 0.128, 0.146],
        ["04121", "Magazzino prodotto finito", 86000, 0.05, 0.119, 0.121],
        ["04122", "Scelta e reimballo", 34000, -0.13, 0.083, 0.012],
      ],
    },
    {
      id: "corvina", nome: "Corvina Elettrodomestici", settore: "Elettrodomestici", stagione: "base", referente: "Davide Morandi",
      commesse: [
        ["04300", "Appalto conto lavoro a pezzo", 132000, 0.09, 0.104, 0.071, { noleggio: 0.13 }],
        ["04301", "Asservimento linee di montaggio", 88000, 0.04, 0.122, 0.129],
        ["04302", "Magazzino ricambi", 31000, 0.11, 0.151, 0.158],
      ],
    },
    {
      id: "belvedere", nome: "Laboratori Farmaceutici Belvedere", settore: "Farmaceutico", stagione: "base", referente: "Chiara Bonetti",
      commesse: [
        ["04410", "Logistica a temperatura controllata", 96000, 0.14, 0.168, 0.176],
        ["04411", "Confezionamento secondario", 52000, 0.07, 0.132, 0.139],
        ["04412", "Hub campioni medicali", 23000, 0, 0, 0.104, { inizio: "2026-03" }],
      ],
    },
    {
      id: "aleardi", nome: "Termotecnica Aleardi", settore: "Termotecnica", stagione: "base", referente: "Luca Pellegrini",
      commesse: [
        ["04520", "Kitting componenti caldaie", 74000, -0.07, 0.113, 0.087],
        ["04521", "Magazzino spedizioni", 45000, 0.01, 0.102, 0.104],
        ["04522", "Picking ricambi assistenza", 22000, 0.05, 0.124, 0.127],
      ],
    },
    {
      id: "ginestra", nome: "Pelletterie Ginestra", settore: "Pelletteria", stagione: "moda", referente: "Silvia Rinaldi",
      commesse: [
        ["04610", "Controllo qualità borse", 38000, 0.22, 0.141, 0.163],
        ["04611", "Magazzino materie prime", 26000, 0.08, 0.118, 0.121],
      ],
    },
    {
      id: "poli", nome: "Poli logistici propri", settore: "Logistica conto terzi", stagione: "base", referente: "Interno",
      commesse: [
        ["04900", "Polo logistico Nord", 64000, 0.04, 0.093, 0.109],
        ["04901", "Polo logistico Sud", 41000, -0.09, 0.071, 0.018],
        ["04902", "Magazzino doganale", 18000, 0.1, 0.132, 0.141],
      ],
    },
    { id: "colle-alto", nome: "Salumificio Colle Alto", settore: "Alimentare", stagione: "base", referente: "Giorgio Neri", commesse: [["04700", "Confezionamento e etichettatura", 48000, 0.05, 0.102, 0.112]] },
    { id: "morello", nome: "Cartotecnica Morello", settore: "Carta e cartone", stagione: "base", referente: "Anna Castelli", commesse: [["04710", "Magazzino bobine", 29000, -0.03, 0.092, 0.081]] },
    { id: "sorgente-verde", nome: "Bevande Sorgente Verde", settore: "Bevande", stagione: "bevande", referente: "Matteo Villa", commesse: [["04720", "Carico automezzi", 36000, 0.16, 0.108, 0.123]] },
    { id: "lunardi", nome: "Ceramiche Lunardi", settore: "Ceramica", stagione: "base", referente: "Federica Galli", commesse: [["04730", "Movimentazione piazzale", 33000, -0.11, 0.101, 0.054]] },
    { id: "castellaro", nome: "Mobilificio Castellaro", settore: "Arredamento", stagione: "base", referente: "Roberto Conti", commesse: [["04740", "Imballo e spedizioni", 21000, 0.03, 0.084, 0.092]] },
    { id: "fontana", nome: "Ricambi Auto Fontana", settore: "Automotive", stagione: "base", referente: "Giulia Marchetti", commesse: [["04750", "Picking ricambi", 25000, 0.07, 0.119, 0.126]] },
    { id: "iris", nome: "Iris Profumerie Distribuzione", settore: "Cosmetica", stagione: "regalo", referente: "Valeria Testa", commesse: [["04760", "Confezioni regalo", 17000, 0.12, 0.148, 0.151]] },
  ];

  // ------------------------------------------------------------- generazione
  const mesiChiave = [];
  for (let m = 1; m <= 12; m++) mesiChiave.push(`${ANNO_PREC}-${String(m).padStart(2, "0")}`);
  for (let m = 1; m <= ULTIMO_MESE; m++) mesiChiave.push(`${ANNO}-${String(m).padStart(2, "0")}`);

  const commesse = [];
  const clienti = CLIENTI_RAW.map((c) => {
    const codes = [];
    c.commesse.forEach(([code, nome, base, crescita, m25, m26, opt]) => {
      opt = opt || {};
      const stag = STAGIONI[c.stagione];
      // Quote dei costi per anno: nel 2026 cambiano, e dove il margine cala
      // crescono soprattutto personale e lavoro temporaneo.
      const quote25 = VOCI_COSTO.map((v) => {
        let q = v.quota * jitter(0.18);
        if (v.code === "19" && opt.noleggio) q = opt.noleggio;
        return q;
      });
      const calo = m25 - m26 > 0.02;
      const quote26 = quote25.map((q, i) => {
        const code = VOCI_COSTO[i].code;
        let f = jitter(0.1);
        if (calo && code === "30") f *= 1.05;
        if (calo && code === "21") f *= 1.18;
        if (code === "19" && opt.noleggio) f = 1.06;
        return q * f;
      });
      const sommaQ = (arr) => arr.reduce((a, b) => a + b, 0);
      const mesi = {};
      mesiChiave.forEach((k) => {
        const [y, mm] = k.split("-").map(Number);
        const attiva = !opt.inizio || k >= opt.inizio;
        if (!attiva) {
          mesi[k] = null;
          return;
        }
        // crescita progressiva nel 2026 per rendere visibile il trend
        const trend = y === ANNO ? 1 + crescita * (0.55 + (mm / ULTIMO_MESE) * 0.9) : 1;
        const rampa = opt.inizio && y === ANNO ? Math.min(1, 0.45 + (mm - Number(opt.inizio.slice(5))) * 0.18) : 1;
        const ricavi = Math.round(base * stag[mm - 1] * trend * rampa * jitter(0.04));
        const marg = (y === ANNO ? m26 : m25) + (rnd() * 2 - 1) * 0.012;
        const mo = ricavi * marg;
        const costiOp = ricavi - mo;
        const quote = y === ANNO ? quote26 : quote25;
        const q = quote.map((x) => x * jitter(0.03));
        const tot = sommaQ(q);
        const voci = {};
        VOCI_COSTO.forEach((v, i) => {
          voci[v.code] = Math.round((costiOp * q[i]) / tot);
        });
        const margine = ricavi - Object.values(voci).reduce((a, b) => a + b, 0);
        const struttura = Math.round(ricavi * QUOTA_STRUTTURA);
        const ore = Math.round(voci["30"] / COSTO_ORA_PERSONALE + voci["21"] / COSTO_ORA_TERZI);
        mesi[k] = { ricavi, voci, margine, struttura, ebit: margine - struttura, ore };
      });
      const item = { code, nome, clienteId: c.id, clienteNome: c.nome, nuova: Boolean(opt.inizio), inizio: opt.inizio || null, mesi };
      commesse.push(item);
      codes.push(code);
    });
    return { id: c.id, nome: c.nome, settore: c.settore, referente: c.referente, gruppo: c.commesse.length > 1, commesse: codes };
  });

  const commessaByCode = new Map(commesse.map((c) => [c.code, c]));
  const clienteById = new Map(clienti.map((c) => [c.id, c]));

  // ------------------------------------------------------------------ periodi
  const PERIODI = [
    { id: "ytd", label: "Da inizio anno", breve: "Gen–Ago 2026", da: 1, a: ULTIMO_MESE },
    { id: "trimestre", label: "Ultimi 3 mesi", breve: "Giu–Ago 2026", da: 6, a: ULTIMO_MESE },
    { id: "mese", label: "Ultimo mese", breve: "Agosto 2026", da: ULTIMO_MESE, a: ULTIMO_MESE },
    { id: "semestre", label: "Primo semestre", breve: "Gen–Giu 2026", da: 1, a: 6 },
  ];
  let periodoId = "ytd";
  try {
    const saved = localStorage.getItem("demo-demo-periodo");
    if (PERIODI.some((p) => p.id === saved)) periodoId = saved;
  } catch (e) { /* storage non disponibile */ }

  function periodo() {
    return PERIODI.find((p) => p.id === periodoId);
  }
  function setPeriodo(id) {
    if (!PERIODI.some((p) => p.id === id)) return;
    periodoId = id;
    try { localStorage.setItem("demo-demo-periodo", id); } catch (e) { /* ignora */ }
  }
  function chiavi(anno, p) {
    p = p || periodo();
    const out = [];
    for (let m = p.da; m <= p.a; m++) out.push(`${anno}-${String(m).padStart(2, "0")}`);
    return out;
  }

  // --------------------------------------------------------------- aggregati
  function vuoto() {
    const voci = {};
    VOCI_COSTO.forEach((v) => (voci[v.code] = 0));
    return { ricavi: 0, voci, margine: 0, struttura: 0, ebit: 0, ore: 0, attiva: false };
  }
  function somma(codes, keys) {
    const tot = vuoto();
    codes.forEach((code) => {
      const c = commessaByCode.get(code);
      keys.forEach((k) => {
        const d = c.mesi[k];
        if (!d) return;
        tot.attiva = true;
        tot.ricavi += d.ricavi;
        tot.margine += d.margine;
        tot.struttura += d.struttura;
        tot.ebit += d.ebit;
        tot.ore += d.ore;
        VOCI_COSTO.forEach((v) => (tot.voci[v.code] += d.voci[v.code]));
      });
    });
    return tot;
  }
  function confronto(codes, p) {
    return { cur: somma(codes, chiavi(ANNO, p)), prev: somma(codes, chiavi(ANNO_PREC, p)) };
  }
  function serieMensile(codes, campo) {
    campo = campo || "ricavi";
    const labels = MESI.slice();
    const cur = [];
    const prev = [];
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      prev.push(somma(codes, [`${ANNO_PREC}-${mm}`])[campo]);
      cur.push(m <= ULTIMO_MESE ? somma(codes, [`${ANNO}-${mm}`])[campo] : null);
    }
    return { labels, cur, prev };
  }
  function tutteLeCommesse() {
    return commesse.map((c) => c.code);
  }

  function righeClienti(p) {
    return clienti.map((c) => {
      const { cur, prev } = confronto(c.commesse, p);
      return {
        id: c.id, nome: c.nome, settore: c.settore, gruppo: c.gruppo, nCommesse: c.commesse.length,
        ricavi: cur.ricavi, ricaviPrec: prev.ricavi, margine: cur.margine, marginePrec: prev.margine,
        marginePct: cur.ricavi ? cur.margine / cur.ricavi : 0,
        marginePctPrec: prev.ricavi ? prev.margine / prev.ricavi : 0,
        ebit: cur.ebit, ore: cur.ore,
      };
    });
  }
  function righeCommesse(codes, p) {
    return (codes || tutteLeCommesse()).map((code) => {
      const c = commessaByCode.get(code);
      const { cur, prev } = confronto([code], p);
      return {
        code, nome: c.nome, clienteId: c.clienteId, clienteNome: c.clienteNome, nuova: c.nuova,
        ricavi: cur.ricavi, ricaviPrec: prev.ricavi, margine: cur.margine, marginePrec: prev.margine,
        marginePct: cur.ricavi ? cur.margine / cur.ricavi : 0,
        marginePctPrec: prev.ricavi ? prev.margine / prev.ricavi : null,
        ebit: cur.ebit, ebitPrec: prev.ebit, ore: cur.ore, attiva: cur.attiva,
        ricavoOra: cur.ore ? cur.ricavi / cur.ore : 0,
      };
    });
  }
  function kpiGenerali(p) {
    const codes = tutteLeCommesse();
    const { cur, prev } = confronto(codes, p);
    const k = chiavi(ANNO, p);
    const kp = chiavi(ANNO_PREC, p);
    const attive = (keys) => commesse.filter((c) => keys.some((x) => c.mesi[x])).length;
    const clientiAttivi = (keys) => clienti.filter((cl) => cl.commesse.some((code) => keys.some((x) => commessaByCode.get(code).mesi[x]))).length;
    return {
      cur, prev,
      commesseAttive: attive(k), commesseAttivePrec: attive(kp),
      clientiAttivi: clientiAttivi(k), clientiAttiviPrec: clientiAttivi(kp),
    };
  }

  // ------------------------------------------------------ appalto a pezzo
  // Commessa 04300: Corvina Elettrodomestici paga una tariffa per pezzo lavorato;
  // i carrelli elevatori dedicati sono a noleggio e pesano sul margine.
  const APPALTO = { commessa: "04300", tariffaBase: { 2025: 0.305, 2026: 0.305 } };
  const pezzi = {};
  mesiChiave.forEach((k) => {
    const d = commessaByCode.get("04300").mesi[k];
    pezzi[k] = Math.round(d.ricavi / 0.305 / 10) * 10;
  });
  const CARRELLI = [
    ["Frontale elettrico 1,6 t", "EL16-20341", "Elevo Noleggi", 612, true, ""],
    ["Frontale elettrico 1,6 t", "EL16-20342", "Elevo Noleggi", 612, true, ""],
    ["Frontale elettrico 2,0 t", "EL20-11873", "Elevo Noleggi", 684, true, ""],
    ["Frontale elettrico 2,0 t", "EL20-11874", "Elevo Noleggi", 684, true, ""],
    ["Frontale elettrico 2,0 t", "EL20-11902", "Elevo Noleggi", 684, true, ""],
    ["Retrattile 1,4 t", "RT14-5520", "Movilift Service", 745, true, ""],
    ["Retrattile 1,4 t", "RT14-5521", "Movilift Service", 745, true, ""],
    ["Retrattile 1,4 t", "RT14-5602", "Movilift Service", 745, true, "Aggiunto a marzo 2026"],
    ["Transpallet elettrico", "TP-88410", "Elevo Noleggi", 238, true, ""],
    ["Transpallet elettrico", "TP-88411", "Elevo Noleggi", 238, true, ""],
    ["Transpallet elettrico", "TP-88412", "Elevo Noleggi", 238, true, ""],
    ["Transpallet elettrico", "TP-88455", "Elevo Noleggi", 238, true, ""],
    ["Commissionatore verticale", "CV-3012", "Movilift Service", 910, true, "Sostituisce CV-2977"],
    ["Commissionatore verticale", "CV-2977", "Movilift Service", 880, false, "Noleggio chiuso a febbraio 2026"],
    ["Trattore da traino", "TR-701", "Carrellistica Val d'Enza", 820, true, ""],
    ["Trattore da traino", "TR-702", "Carrellistica Val d'Enza", 820, true, ""],
  ].map(([modello, matricola, fornitore, canone, attivo, nota]) => ({ modello, matricola, fornitore, canone, attivo, nota }));

  const TARIFFA_NUOVA_ISTAT = 0.312;

  // ------------------------------------------------------------------ budget
  function budgetRighe() {
    // Budget 2026 approvato a dicembre 2025; consuntivo gen–ago; proiezione a fine anno.
    const codes = tutteLeCommesse();
    const cons = somma(codes, chiavi(ANNO, { da: 1, a: ULTIMO_MESE }));
    const prevAnno = somma(codes, chiavi(ANNO_PREC, { da: 1, a: 12 }));
    const prev8 = somma(codes, chiavi(ANNO_PREC, { da: 1, a: ULTIMO_MESE }));
    const fattoreResto = prevAnno.ricavi / prev8.ricavi; // stagionalità settembre–dicembre
    const budgetFatt = { ricavi: 1.075, "30": 1.06, "21": 1.02, "19": 1.03, "01": 1.05, "11": 1.02, "06": 1.08, "16": 1.03, "26": 1.04, struttura: 1.04 };
    const proj = (v) => Math.round((v * fattoreResto) / 1000) * 1000;
    const rows = [{ code: "ricavi", label: "Ricavi", tipo: "ricavo", budget: Math.round((prevAnno.ricavi * budgetFatt.ricavi) / 1000) * 1000, consuntivo: cons.ricavi, proiezione: proj(cons.ricavi) }];
    VOCI_COSTO.forEach((v) => {
      rows.push({ code: v.code, label: v.label, tipo: "costo", budget: Math.round((prevAnno.voci[v.code] * budgetFatt[v.code]) / 1000) * 1000, consuntivo: cons.voci[v.code], proiezione: proj(cons.voci[v.code]) });
    });
    rows.push({ code: "struttura", label: "Costi di struttura", tipo: "costo", budget: Math.round((prevAnno.struttura * budgetFatt.struttura) / 1000) * 1000, consuntivo: cons.struttura, proiezione: proj(cons.struttura) });
    return rows;
  }

  // ------------------------------------------------------------ impostazioni
  const VARIABILI = [
    { id: "costo-orario", nome: "Costo orario medio personale", valore: "23,40", unita: "€/ora", tipo: "Fissa" },
    { id: "costo-orario-terzi", nome: "Costo orario lavoro temporaneo", valore: "26,80", unita: "€/ora", tipo: "Fissa" },
    { id: "obiettivo-margine", nome: "Obiettivo margine operativo", valore: "12", unita: "%", tipo: "Dinamica" },
    { id: "quota-struttura", nome: "Quota costi di struttura sulle commesse", valore: "5,5", unita: "% ricavi", tipo: "Dinamica" },
    { id: "soglia-allerta", nome: "Soglia di allerta calo margine", valore: "3", unita: "punti %", tipo: "Dinamica" },
  ];

  // ------------------------------------------------------------ formattazione
  // Formato italiano con separatore delle migliaia anche a 4 cifre (8.346) e segno meno tipografico.
  function nf(dec) {
    return {
      format(v) {
        const neg = v < 0 && Math.abs(v) >= 0.5 * Math.pow(10, -dec);
        const [int, frac] = Math.abs(v).toFixed(dec).split(".");
        const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return `${neg ? "−" : ""}${grouped}${frac ? "," + frac : ""}`;
      },
    };
  }
  const nf0 = nf(0);
  const nf1 = nf(1);
  const nf2 = nf(2);
  const nf3 = nf(3);
  const fmt = {
    eur: (v) => `${nf0.format(Math.round(v))} €`,
    eur2: (v) => `${nf2.format(v)} €`,
    eur3: (v) => `${nf3.format(v)} €`,
    num: (v) => nf0.format(Math.round(v)),
    pct: (v, digits) => (v == null || !isFinite(v) ? "—" : `${(digits === 0 ? nf0 : nf1).format(v * 100)}%`),
    delta: (cur, prev) => (prev ? (cur - prev) / Math.abs(prev) : null),
    punti: (v) => (Math.abs(v) < 0.0005 ? "0,0 pt" : `${v >= 0 ? "+" : "−"}${nf1.format(Math.abs(v * 100))} pt`),
    compatto: (v) => {
      const a = Math.abs(v);
      if (a >= 1e6) return `${nf1.format(v / 1e6)} mln €`;
      if (a >= 1e3) return `${nf0.format(v / 1e3)} k€`;
      return `${nf0.format(v)} €`;
    },
    compattoAsse: (v) => {
      const a = Math.abs(v);
      if (a >= 1e6) return `${nf1.format(v / 1e6)} mln`;
      if (a >= 1e3) return `${nf0.format(v / 1e3)}k`;
      return nf0.format(v);
    },
  };

  G.data = {
    AZIENDA, MESI, MESI_LUNGHI, ANNO, ANNO_PREC, ULTIMO_MESE, VOCI_COSTO, PERIODI, APPALTO, CARRELLI, TARIFFA_NUOVA_ISTAT, VARIABILI, pezzi,
    clienti, commesse, commessaByCode, clienteById,
    periodo, setPeriodo, chiavi, somma, confronto, serieMensile, tutteLeCommesse,
    righeClienti, righeCommesse, kpiGenerali, budgetRighe,
  };
  G.fmt = fmt;
})();
