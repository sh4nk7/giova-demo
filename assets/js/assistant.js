/* Demo — assistente "Chiedi all'assistente".
 * Con il server locale e ANTHROPIC_API_KEY risponde Claude dal vivo (api/chat).
 * Altrimenti usa risposte preimpostate, calcolate sui dati della schermata. */
(function () {
  "use strict";
  const G = window.DEMO;
  const D = G.data;
  const F = G.fmt;
  const I = G.icon;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  let live = false;
  let open = false;
  let busy = false;
  let history = []; // {role, content}
  let route = { sezione: "cruscotto", params: {} };

  // ------------------------------------------------------------ utilità testo
  const pct1 = (v) => F.pct(v);
  const pt = (a, b) => F.punti(a - b);
  const segno = (v) => (v >= 0 ? "+" : "−");
  const deltaTxt = (cur, prev) => {
    const d = F.delta(cur, prev);
    return d == null ? "n.d." : `${segno(d)}${F.pct(Math.abs(d))}`;
  };
  const periodo = () => D.periodo().breve;
  const periodoPrec = () => D.periodo().breve.replace("2026", "2025");

  function analisiCommessa(code) {
    const { cur, prev } = D.confronto([code]);
    const c = D.commessaByCode.get(code);
    const m = cur.ricavi ? cur.margine / cur.ricavi : 0;
    const mp = prev.ricavi ? prev.margine / prev.ricavi : null;
    const voci = D.VOCI_COSTO.map((v) => ({
      v,
      inc: cur.voci[v.code] / (cur.ricavi || 1),
      incPrev: prev.ricavi ? prev.voci[v.code] / prev.ricavi : null,
      var: F.delta(cur.voci[v.code], prev.voci[v.code]),
    }));
    const peggiori = voci.filter((x) => x.incPrev != null).sort((a, b) => b.inc - b.incPrev - (a.inc - a.incPrev));
    return { c, cur, prev, m, mp, voci, peggiori };
  }

  // ------------------------------------------------------------ risposte preimpostate
  const R = {};

  R.andamento = () => {
    const k = D.kpiGenerali();
    const m = k.cur.margine / k.cur.ricavi;
    const mp = k.prev.margine / k.prev.ricavi;
    const nuove = D.commesse.filter((c) => c.nuova).map((c) => `${c.nome} (${c.clienteNome})`);
    return `Nel periodo **${periodo()}** il fatturato è di **${F.eur(k.cur.ricavi)}**, ${deltaTxt(k.cur.ricavi, k.prev.ricavi)} rispetto a ${periodoPrec()}.

- Il margine operativo è di ${F.eur(k.cur.margine)}, pari al **${pct1(m)}** dei ricavi (${pt(m, mp)} rispetto al ${pct1(mp)} dell'anno scorso): i costi crescono un po' più dei ricavi.
- L'EBIT è di ${F.eur(k.cur.ebit)}, ${deltaTxt(k.cur.ebit, k.prev.ebit)}.
- Le commesse attive sono ${k.commesseAttive} contro ${k.commesseAttivePrec}${nuove.length ? `: si è aggiunta ${nuove.join(", ")}` : ""}.

**Azione consigliata:** la crescita c'è, ma la marginalità si sta erodendo su poche commesse. Parti dall'elenco "Commesse da attenzionare" del cruscotto.`;
  };

  R.calo = () => {
    const rows = D.righeCommesse()
      .filter((r) => r.marginePctPrec != null && r.marginePct < r.marginePctPrec)
      .sort((a, b) => a.marginePct - a.marginePctPrec - (b.marginePct - b.marginePctPrec))
      .slice(0, 4);
    const top = rows[0];
    const an = analisiCommessa(top.code);
    const drv = an.peggiori[0];
    return `Queste sono le commesse con il calo di margine più forte in ${periodo()}:

${rows.map((r) => `- **${r.code} ${r.nome}** (${r.clienteNome}): margine dal ${pct1(r.marginePctPrec)} al **${pct1(r.marginePct)}** (${pt(r.marginePct, r.marginePctPrec)}), EBIT ${F.eur(r.ebit)}`).join("\n")}

Il caso più serio è **${top.nome}**: i ricavi sono ${deltaTxt(an.cur.ricavi, an.prev.ricavi)} ma la voce "${drv.v.label.toLowerCase()}" è salita dal ${pct1(drv.incPrev)} al ${pct1(drv.inc)} dei ricavi. I costi non si sono adeguati al calo dei volumi.

**Azione consigliata:** apri la commessa ${top.code} e verifica con il responsabile di sito il dimensionamento delle squadre.`;
  };

  R.concentrazione = () => {
    const rows = D.righeClienti().sort((a, b) => b.ricavi - a.ricavi);
    const tot = rows.reduce((a, r) => a + r.ricavi, 0);
    const top3 = rows.slice(0, 3);
    const quota3 = top3.reduce((a, r) => a + r.ricavi, 0) / tot;
    return `Il fatturato di ${periodo()} (${F.eur(tot)}) è abbastanza concentrato:

${top3.map((r) => `- **${r.nome}**: ${F.eur(r.ricavi)}, il ${pct1(r.ricavi / tot)} del totale (margine ${pct1(r.marginePct)})`).join("\n")}

I primi tre clienti valgono il **${pct1(quota3)}** del fatturato. Gli altri ${rows.length - 3} clienti si dividono il resto, e nessuno supera il ${pct1(rows[3].ricavi / tot)}.

**Azione consigliata:** tieni d'occhio i rinnovi contrattuali di questi tre gruppi. Una variazione di tariffa su uno di loro sposta più del resto del portafoglio.`;
  };

  R.crescita = () => {
    const rows = D.righeClienti().map((r) => ({ ...r, d: F.delta(r.ricavi, r.ricaviPrec) })).sort((a, b) => b.d - a.d);
    const up = rows.slice(0, 3);
    const down = rows.filter((r) => r.d < 0).sort((a, b) => a.d - b.d).slice(0, 2);
    return `Confrontando ${periodo()} con ${periodoPrec()}:

${up.map((r) => `- **${r.nome}**: ${deltaTxt(r.ricavi, r.ricaviPrec)} (${F.eur(r.ricavi)}), margine ${pct1(r.marginePct)}`).join("\n")}

In calo invece ${down.map((r) => `**${r.nome}** (${deltaTxt(r.ricavi, r.ricaviPrec)})`).join(" e ")}.

**Azione consigliata:** ${up[0].nome} cresce con un margine ${up[0].marginePct >= up[0].marginePctPrec ? "in miglioramento" : "in calo"}: è il cliente su cui proporre nuovi servizi.`;
  };

  R.sottoObiettivo = () => {
    const obiettivo = 0.12;
    const rows = D.righeClienti().filter((r) => r.marginePct < obiettivo).sort((a, b) => a.marginePct - b.marginePct);
    return `L'obiettivo di margine operativo impostato nella piattaforma è il **12%**. In ${periodo()} sono sotto soglia ${rows.length} clienti su ${D.clienti.length}:

${rows.slice(0, 5).map((r) => `- **${r.nome}**: ${pct1(r.marginePct)} (${pt(r.marginePct, r.marginePctPrec)} sul 2025)`).join("\n")}${rows.length > 5 ? `\n- e altri ${rows.length - 5} con scarti più contenuti` : ""}

**Azione consigliata:** apri i primi due e guarda quale commessa trascina giù la media: spesso il problema è concentrato su una sola attività.`;
  };

  R.dipendenza = () => {
    const rows = D.righeClienti().sort((a, b) => b.ricavi - a.ricavi);
    const tot = rows.reduce((a, r) => ({ ric: a.ric + r.ricavi, mar: a.mar + r.margine, ebit: a.ebit + r.ebit }), { ric: 0, mar: 0, ebit: 0 });
    const top3 = rows.slice(0, 3);
    const t3 = top3.reduce((a, r) => ({ ric: a.ric + r.ricavi, mar: a.mar + r.margine }), { ric: 0, mar: 0 });
    const primo = rows[0];
    return `I primi tre clienti (${top3.map((r) => r.nome).join(", ")}) valgono:

- il **${pct1(t3.ric / tot.ric)}** del fatturato di ${periodo()};
- il **${pct1(t3.mar / tot.mar)}** del margine operativo complessivo.

Il primo cliente, **${primo.nome}**, porta da solo ${F.eur(primo.margine)} di margine operativo. Se venisse a mancare, i costi di sede resterebbero: l'EBIT del periodo scenderebbe da ${F.eur(tot.ebit)} a circa **${F.eur(tot.ebit - primo.margine)}**.

**Azione consigliata:** la dipendenza è moderata ma da presidiare. Punta sui clienti medi che crescono, come ${rows.slice(3).sort((a, b) => F.delta(b.ricavi, b.ricaviPrec) - F.delta(a.ricavi, a.ricaviPrec))[0].nome}.`;
  };

  R.clienteSintesi = () => {
    const c = D.clienteById.get(route.params.id);
    if (!c) return R.andamento();
    const { cur, prev } = D.confronto(c.commesse);
    const rows = D.righeCommesse(c.commesse).sort((a, b) => b.ricavi - a.ricavi);
    const m = cur.margine / cur.ricavi;
    const mp = prev.ricavi ? prev.margine / prev.ricavi : 0;
    const peggiore = rows.slice().sort((a, b) => a.marginePct - b.marginePct)[0];
    return `**${c.nome}** in ${periodo()}: fatturato di ${F.eur(cur.ricavi)} (${deltaTxt(cur.ricavi, prev.ricavi)}) su ${c.commesse.length} ${c.commesse.length === 1 ? "commessa" : "commesse"}.

- Margine operativo al **${pct1(m)}** (${pt(m, mp)} sul 2025), EBIT di ${F.eur(cur.ebit)}.
- Ore lavorate ${F.num(cur.ore)} (${deltaTxt(cur.ore, prev.ore)}), con ${F.eur2(cur.ricavi / cur.ore)} di ricavo per ora.
- La commessa più grande è ${rows[0].nome} (${F.eur(rows[0].ricavi)}).${rows.length > 1 ? `\n- La meno redditizia è ${peggiore.nome}, al ${pct1(peggiore.marginePct)}.` : ""}

**Azione consigliata:** ${m < 0.12 ? "il cliente è sotto l'obiettivo del 12%: prepara un'analisi da discutere con il referente " + c.referente + "." : "la marginalità è in linea con l'obiettivo: è un buon momento per proporre un rinnovo pluriennale."}`;
  };

  R.clientePeggiore = () => {
    const c = D.clienteById.get(route.params.id);
    if (!c) return R.calo();
    const rows = D.righeCommesse(c.commesse).sort((a, b) => a.marginePct - b.marginePct);
    const w = rows[0];
    const an = analisiCommessa(w.code);
    const drv = an.peggiori[0];
    return `Tra le commesse di ${c.nome} rende meno **${w.code} ${w.nome}**, con un margine del **${pct1(w.marginePct)}**${w.marginePctPrec != null ? ` (era ${pct1(w.marginePctPrec)} nel 2025)` : ""} ed EBIT di ${F.eur(w.ebit)}.
${drv ? `\nLa voce che pesa di più è "${drv.v.label.toLowerCase()}", passata dal ${pct1(drv.incPrev)} al ${pct1(drv.inc)} dei ricavi.` : ""}
${rows.length > 1 ? `\nPer confronto, la commessa migliore del cliente è ${rows[rows.length - 1].nome} al ${pct1(rows[rows.length - 1].marginePct)}.` : ""}

**Azione consigliata:** apri la commessa dalla tabella per vedere il conto economico voce per voce.`;
  };

  R.clienteCosti = () => {
    const c = D.clienteById.get(route.params.id);
    if (!c) return R.andamento();
    const { cur, prev } = D.confronto(c.commesse);
    const voci = D.VOCI_COSTO.map((v) => ({ v, d: F.delta(cur.voci[v.code], prev.voci[v.code]), cur: cur.voci[v.code] })).sort((a, b) => b.d - a.d);
    return `Per ${c.nome} i ricavi sono ${deltaTxt(cur.ricavi, prev.ricavi)}. Le voci di costo cresciute di più sono:

${voci.slice(0, 3).map((x) => `- **${x.v.label}**: ${F.eur(x.cur)} (${segno(x.d)}${F.pct(Math.abs(x.d))})`).join("\n")}

Il costo del personale resta la voce principale: ${pct1(cur.voci["30"] / cur.ricavi)} dei ricavi, contro il ${pct1(prev.voci["30"] / prev.ricavi)} del 2025.

**Azione consigliata:** confronta le ore lavorate con i volumi del cliente per capire se la crescita del personale è giustificata.`;
  };

  R.commessaPerche = () => {
    const code = route.params.commessa;
    if (!code) return R.calo();
    const an = analisiCommessa(code);
    if (an.mp == null) {
      return `**${an.c.nome}** è una commessa nuova, avviata nel 2026: non c'è un confronto con l'anno precedente. In ${periodo()} ha un margine del **${pct1(an.m)}** su ${F.eur(an.cur.ricavi)} di ricavi, ancora in fase di avviamento.

**Azione consigliata:** ricontrolla il margine a fine trimestre, quando i volumi saranno a regime.`;
    }
    const d = an.peggiori.slice(0, 2);
    const migliora = an.m >= an.mp;
    return `Il margine di **${an.c.code} ${an.c.nome}** è passato dal ${pct1(an.mp)} al **${pct1(an.m)}** (${pt(an.m, an.mp)}).

- I ricavi sono ${deltaTxt(an.cur.ricavi, an.prev.ricavi)} (${F.eur(an.cur.ricavi)}).
${d.map((x) => `- ${x.v.label}: dal ${pct1(x.incPrev)} al ${pct1(x.inc)} dei ricavi (${x.var == null ? "n.d." : segno(x.var) + F.pct(Math.abs(x.var))} in valore)`).join("\n")}
- Ore lavorate ${F.num(an.cur.ore)} (${deltaTxt(an.cur.ore, an.prev.ore)}), ricavo per ora ${F.eur2(an.cur.ricavi / an.cur.ore)}.

${migliora ? "Il miglioramento viene da ricavi cresciuti più dei costi." : "In sintesi: i volumi sono scesi, ma squadre e costi fissi di sito sono rimasti quasi invariati."}`;
  };

  R.commessaRecupero = () => {
    const code = route.params.commessa;
    if (!code) return R.calo();
    const an = analisiCommessa(code);
    const drv = an.peggiori[0];
    const azioni = {
      "30": "rivedere turni e dimensionamento delle squadre sui volumi reali",
      "21": "ridurre il ricorso al lavoro temporaneo nei picchi, usando personale di altri siti",
      "19": "verificare l'utilizzo dei mezzi a noleggio e restituire quelli sottoutilizzati",
      "01": "rinegoziare i materiali di consumo o riaddebitarli al cliente",
      "11": "passare a un contratto di manutenzione a canone",
      "06": "rivedere la ripartizione delle utenze di sito",
      "16": "ottimizzare i giri degli automezzi",
      "26": "rivedere la convenzione mensa",
    };
    const gap = (an.mp ?? 0.12) - an.m;
    const recupero = Math.max(0, gap) * an.cur.ricavi;
    return `Per **${an.c.nome}** vedo tre leve, in ordine di impatto:

- **${drv.v.label}**: ${azioni[drv.v.code]}. Riportare l'incidenza al ${pct1(drv.incPrev)} vale circa ${F.eur((drv.inc - drv.incPrev) * an.cur.ricavi)} nel periodo.
- **Tariffa**: con volumi in calo conviene chiedere al cliente una revisione del prezzo o un minimo garantito di volumi.
- **Ricavo per ora**: oggi è ${F.eur2(an.cur.ricavi / an.cur.ore)}${an.prev.ore ? ` contro ${F.eur2(an.prev.ricavi / an.prev.ore)} nel 2025` : ""}. Va monitorato ogni mese.

${recupero > 0 ? `Tornare al margine del 2025 vorrebbe dire recuperare circa **${F.eur(recupero)}** nel periodo.` : ""}`;
  };

  R.perdita = () => {
    const rows = D.righeCommesse().filter((r) => r.ebit < 0).sort((a, b) => a.ebit - b.ebit);
    if (!rows.length) return `In ${periodo()} nessuna commessa è in perdita a livello EBIT.`;
    const tot = rows.reduce((a, r) => a + r.ebit, 0);
    return `In ${periodo()} sono in perdita a livello EBIT (dopo i costi di struttura) ${rows.length} commesse:

${rows.map((r) => `- **${r.code} ${r.nome}** (${r.clienteNome}): EBIT ${F.eur(r.ebit)}, margine operativo ${pct1(r.marginePct)}`).join("\n")}

Insieme valgono ${F.eur(tot)}. Coprono i costi diretti ma non la loro quota di costi di sede (5,5% dei ricavi).

**Azione consigliata:** attiva il filtro "Solo margine in calo" e apri le commesse una per una.`;
  };

  R.ricavoOra = () => {
    const rows = D.righeCommesse().filter((r) => r.ore > 0).sort((a, b) => b.ricavoOra - a.ricavoOra);
    const tot = rows.reduce((a, r) => ({ ric: a.ric + r.ricavi, ore: a.ore + r.ore }), { ric: 0, ore: 0 });
    return `Il ricavo medio per ora lavorata in ${periodo()} è di **${F.eur2(tot.ric / tot.ore)}**.

Le commesse che rendono di più per ora:
${rows.slice(0, 3).map((r) => `- ${r.nome} (${r.clienteNome}): ${F.eur2(r.ricavoOra)}`).join("\n")}

Quelle che rendono meno:
${rows.slice(-2).map((r) => `- ${r.nome} (${r.clienteNome}): ${F.eur2(r.ricavoOra)}`).join("\n")}

**Azione consigliata:** usa il ricavo per ora come soglia minima nelle nuove offerte.`;
  };

  R.nuove = () => {
    const rows = D.commesse.filter((c) => c.nuova);
    return `Nel 2026 è partita ${rows.length === 1 ? "una nuova commessa" : rows.length + " nuove commesse"}:

${rows
  .map((c) => {
    const r = D.righeCommesse([c.code])[0];
    return `- **${c.code} ${c.nome}** per ${c.clienteNome}, avviata a ${D.MESI_LUNGHI[Number(c.inizio.slice(5)) - 1]}: ${F.eur(r.ricavi)} di ricavi in ${periodo()}, margine ${pct1(r.marginePct)}`;
  })
  .join("\n")}

Il margine è ancora sotto la media del cliente, com'è normale nei primi mesi di avviamento.`;
  };

  function appaltoNumeri(tariffa) {
    const st = G.stato();
    const pz = [];
    for (let m = 1; m <= D.ULTIMO_MESE; m++) pz.push(D.pezzi[`2026-${String(m).padStart(2, "0")}`]);
    const medi = pz.reduce((a, b) => a + b, 0) / pz.length;
    const canone = st.carrelli.filter((c) => c.attivo).reduce((a, c) => a + c.canone, 0);
    return { medi, canone, ricavoMese: medi * tariffa, inc: canone / (medi * tariffa) };
  }

  R.istat = () => {
    const tar = D.APPALTO.tariffaBase[2026];
    const n0 = appaltoNumeri(tar);
    const n1 = appaltoNumeri(D.TARIFFA_NUOVA_ISTAT);
    const annuo = (D.TARIFFA_NUOVA_ISTAT - tar) * n0.medi * 12;
    const r = D.righeCommesse(["04300"])[0];
    const p = (D.TARIFFA_NUOVA_ISTAT - tar) / tar;
    const recuperoPt = (p * (1 - r.marginePct)) / (1 + p);
    return `Sì, conviene chiederlo. Con la tariffa di **${F.eur3(tar)}** per pezzo e una media di ${F.num(n0.medi)} pezzi al mese:

- l'adeguamento ISTAT a **${F.eur3(D.TARIFFA_NUOVA_ISTAT)}** (+${F.pct((D.TARIFFA_NUOVA_ISTAT - tar) / tar)}) vale circa **${F.eur(annuo)} in più all'anno**;
- l'incidenza dei carrelli sul ricavo scende dal ${pct1(n0.inc)} al ${pct1(n1.inc)};
- il margine della commessa, oggi al ${pct1(r.marginePct)} e il più basso tra quelle di Corvina, salirebbe di circa ${F.punti(recuperoPt).replace("+", "")}, a parità di costi.

**Azione consigliata:** presenta al cliente la simulazione di questa schermata insieme ai volumi del 2026, che sono in crescita.`;
  };

  R.carrelli = () => {
    const st = G.stato();
    const n = appaltoNumeri(st.tariffa);
    const attivi = st.carrelli.filter((c) => c.attivo);
    const fornitori = {};
    attivi.forEach((c) => (fornitori[c.fornitore] = (fornitori[c.fornitore] || 0) + c.canone));
    return `Oggi hai **${attivi.length} mezzi a noleggio** sulla commessa 04300, per **${F.eur(n.canone)} al mese**. È il **${pct1(n.inc)}** del ricavo medio mensile dell'appalto (${F.eur(n.ricavoMese)} alla tariffa di ${F.eur3(st.tariffa)}).

${Object.entries(fornitori)
  .sort((a, b) => b[1] - a[1])
  .map(([f, v]) => `- ${f}: ${F.eur(v)} al mese`)
  .join("\n")}

Rispetto al 2025 la flotta costa di più: a marzo è arrivato il retrattile RT14-5602 e il commissionatore CV-3012 ha sostituito un mezzo più economico.

**Azione consigliata:** verifica con il capo turno se il retrattile aggiunto a marzo è davvero utilizzato a pieno.`;
  };

  R.restituzione = () => {
    const st = G.stato();
    const n0 = appaltoNumeri(st.tariffa);
    const cand = st.carrelli.find((c) => c.matricola === "RT14-5602" && c.attivo) || st.carrelli.filter((c) => c.attivo).sort((a, b) => b.canone - a.canone)[0];
    const canone1 = n0.canone - cand.canone;
    const inc1 = canone1 / n0.ricavoMese;
    return `Se restituisci il **${cand.modello} ${cand.matricola}** (${cand.fornitore}):

- risparmi **${F.eur(cand.canone)} al mese**, cioè ${F.eur(cand.canone * 12)} all'anno;
- l'incidenza dei carrelli sul ricavo scende dal ${pct1(n0.inc)} al **${pct1(inc1)}**;
- la flotta scende a ${st.carrelli.filter((c) => c.attivo).length - 1} mezzi.

Puoi provarlo subito: spegni l'interruttore del mezzo nella tabella "Carrelli a noleggio" e i totali si ricalcolano.

**Attenzione:** prima di restituirlo verifica i picchi di settembre e ottobre, quando i volumi salgono.`;
  };

  function budgetDati() {
    const st = G.stato();
    const rows = D.budgetRighe().map((r) => ({ ...r, prev: st.previsionale[r.code] ?? r.proiezione }));
    const ric = rows[0];
    const costiOp = rows.filter((r) => r.tipo === "costo" && r.code !== "struttura");
    const s = rows[rows.length - 1];
    const mo = (k) => ric[k] - costiOp.reduce((a, r) => a + r[k], 0);
    return { rows, ric, costiOp, s, ebitB: mo("budget") - s.budget, ebitP: mo("prev") - s.prev, moB: mo("budget"), moP: mo("prev") };
  }

  R.budgetLinea = () => {
    const b = budgetDati();
    return `Con il consuntivo di fine agosto e la proiezione a fine anno:

- **Ricavi** previsti ${F.eur(b.ric.prev)} contro un budget di ${F.eur(b.ric.budget)} (${deltaTxt(b.ric.prev, b.ric.budget)}).
- **Margine operativo** previsto ${F.eur(b.moP)} (${pct1(b.moP / b.ric.prev)}) contro ${F.eur(b.moB)} di budget (${pct1(b.moB / b.ric.budget)}).
- **EBIT** previsto ${F.eur(b.ebitP)} contro ${F.eur(b.ebitB)} (${deltaTxt(b.ebitP, b.ebitB)}).

Siamo ${Math.abs(F.delta(b.ric.prev, b.ric.budget)) < 0.02 ? "sostanzialmente in linea sui ricavi" : "lontani dal budget sui ricavi"}. Lo scostamento vero è sulla marginalità, perché alcuni costi corrono più del previsto.

**Azione consigliata:** guarda la colonna "vs budget" delle voci di costo per capire dove intervenire nell'ultimo quadrimestre.`;
  };

  R.budgetSfori = () => {
    const b = budgetDati();
    const sfori = b.rows
      .filter((r) => r.tipo === "costo")
      .map((r) => ({ ...r, d: F.delta(r.prev, r.budget) }))
      .filter((r) => r.d > 0)
      .sort((a, b2) => b2.prev - b2.budget - (a.prev - a.budget));
    if (!sfori.length) return "Nessuna voce di costo supera il budget con il previsionale attuale.";
    return `Con il previsionale attuale superano il budget ${sfori.length} voci di costo:

${sfori.slice(0, 4).map((r) => `- **${r.label}**: ${F.eur(r.prev)} contro ${F.eur(r.budget)} (+${F.pct(r.d)}, ${F.eur(r.prev - r.budget)} in più)`).join("\n")}

**Azione consigliata:** la voce più rilevante in valore è "${sfori[0].label.toLowerCase()}". Prova a correggere il previsionale nella tabella per vedere quanto EBIT recupereresti.`;
  };

  R.budgetEbit = () => {
    const b = budgetDati();
    return `Con il previsionale di questa schermata l'**EBIT 2026** chiuderebbe a **${F.eur(b.ebitP)}**, il ${pct1(b.ebitP / b.ric.prev)} dei ricavi. Il budget era di ${F.eur(b.ebitB)} (${deltaTxt(b.ebitP, b.ebitB)}).

Il previsionale parte dal consuntivo gen–ago e aggiunge settembre–dicembre con la stagionalità del 2025. Le voci che hai modificato a mano sono evidenziate in tabella.

**Azione consigliata:** prova a ridurre del 5% il lavoro temporaneo e guarda come cambia l'EBIT.`;
  };

  R.variabili = () => `Le **variabili di calcolo** sono i parametri che la piattaforma usa per trasformare i dati contabili in indicatori:

- il **costo orario** del personale e del lavoro temporaneo serve a stimare le ore lavorate e il ricavo per ora;
- l'**obiettivo di margine** (12%) decide quali clienti e commesse vanno segnalati;
- la **quota dei costi di struttura** (5,5%) ribalta i costi di sede sulle commesse per calcolare l'EBIT;
- la **soglia di allerta** (3 punti) alimenta l'elenco "Commesse da attenzionare" del cruscotto.

Le variabili "dinamiche" possono cambiare nel corso dell'anno. Quelle "fisse" si aggiornano di solito una volta l'anno.`;

  R.fonti = () => `La piattaforma legge i dati dal **gestionale ERP** dell'azienda con una sincronizzazione notturna:

- **contabilità analitica per commessa**: ricavi e costi per voce, lo stesso schema del conto economico di commessa;
- **ore lavorate** dal sistema presenze;
- **anagrafica commesse e clienti**, con il raggruppamento per gruppo societario;
- **dati operativi degli appalti a pezzo**: pezzi lavorati e canoni dei mezzi a noleggio.

In questa demo tutti i dati sono di esempio e inventati.`;

  const SUGGERIMENTI = {
    cruscotto: [
      ["Come sta andando il 2026 rispetto al 2025?", R.andamento],
      ["Quali commesse hanno perso più margine?", R.calo],
      ["Dove si concentra il fatturato?", R.concentrazione],
    ],
    clienti: [
      ["Quale cliente cresce di più?", R.crescita],
      ["Quali clienti sono sotto l'obiettivo di margine del 12%?", R.sottoObiettivo],
      ["Quanto dipendiamo dai primi tre clienti?", R.dipendenza],
    ],
    cliente: [
      ["Riassumi l'andamento di questo cliente", R.clienteSintesi],
      ["Quale commessa di questo cliente rende meno?", R.clientePeggiore],
      ["Quali costi sono cresciuti di più?", R.clienteCosti],
    ],
    commessa: [
      ["Perché è cambiato il margine di questa commessa?", R.commessaPerche],
      ["Come posso recuperare margine su questa commessa?", R.commessaRecupero],
    ],
    commesse: [
      ["Quali commesse sono in perdita a livello EBIT?", R.perdita],
      ["Quali commesse rendono di più per ora lavorata?", R.ricavoOra],
      ["Quali commesse sono nuove quest'anno?", R.nuove],
    ],
    appalto: [
      ["Conviene chiedere l'adeguamento ISTAT della tariffa?", R.istat],
      ["Quanto pesano i carrelli sul ricavo dell'appalto?", R.carrelli],
      ["Cosa succede se restituisco un carrello?", R.restituzione],
    ],
    budget: [
      ["Siamo in linea con il budget?", R.budgetLinea],
      ["Quali voci di costo sforano il budget?", R.budgetSfori],
      ["Che EBIT chiudiamo a fine anno?", R.budgetEbit],
    ],
    impostazioni: [
      ["A cosa servono le variabili di calcolo?", R.variabili],
      ["Da dove arrivano i dati della piattaforma?", R.fonti],
    ],
    nonTrovato: [["Come sta andando il 2026 rispetto al 2025?", R.andamento]],
  };

  function suggerimentiCorrenti() {
    if (route.params && route.params.commessa) return SUGGERIMENTI.commessa;
    return SUGGERIMENTI[route.sezione] || SUGGERIMENTI.cruscotto;
  }

  function rispostaPreimpostata(testo) {
    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ");
    const stop = new Set(["di", "a", "da", "in", "con", "su", "per", "tra", "fra", "il", "lo", "la", "i", "gli", "le", "un", "una", "che", "e", "quali", "quale", "come", "cosa", "sono", "del", "della", "dei", "delle", "al", "alla", "piu", "questo", "questa", "si", "se", "ci", "mi", "c", "l"]);
    const parole = (s) => norm(s).split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));
    const q = parole(testo);
    const qn = norm(testo).trim();
    const pool = [...suggerimentiCorrenti(), ...Object.values(SUGGERIMENTI).flat()];
    let best = null;
    let score = 0;
    pool.forEach(([dom, fn]) => {
      if (norm(dom).trim() === qn) {
        best = fn;
        score = 99;
        return;
      }
      const w = parole(dom);
      const s = q.filter((x) => w.some((y) => y.startsWith(x.slice(0, 5)) || x.startsWith(y.slice(0, 5)))).length;
      if (s > score) {
        score = s;
        best = fn;
      }
    });
    if (best && score >= 2) return best();
    return `In **Modalità demo** rispondo solo alle domande suggerite per questa schermata, con risposte preparate sui dati di esempio.

Avviando la demo in locale con una chiave API, a questa domanda risponderebbe Claude dal vivo, usando i dati della schermata aperta.`;
  }

  // ------------------------------------------------------------ rendering
  function md(text) {
    const blocks = esc(text).split(/\n{2,}/);
    return blocks
      .map((b) => {
        const lines = b.split("\n").filter((l) => l.trim() !== "");
        const bold = (s) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        if (lines.length && lines.every((l) => /^\s*[-•]\s+/.test(l))) {
          return `<ul>${lines.map((l) => `<li>${bold(l.replace(/^\s*[-•]\s+/, ""))}</li>`).join("")}</ul>`;
        }
        let out = "";
        let list = [];
        lines.forEach((l) => {
          if (/^\s*[-•]\s+/.test(l)) list.push(`<li>${bold(l.replace(/^\s*[-•]\s+/, ""))}</li>`);
          else {
            if (list.length) {
              out += `<ul>${list.join("")}</ul>`;
              list = [];
            }
            out += `<p>${bold(l)}</p>`;
          }
        });
        if (list.length) out += `<ul>${list.join("")}</ul>`;
        return out;
      })
      .join("");
  }

  function aggiungi(role, html) {
    const box = $("#chat-log");
    const el = document.createElement("div");
    el.className = `msg ${role === "assistant" ? "msg-bot" : "msg-user"}`;
    el.innerHTML = role === "assistant" ? `<span class="msg-ico">${I("scintille")}</span><div class="msg-body">${html}</div>` : `<div class="msg-body">${html}</div>`;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    return el.querySelector(".msg-body");
  }

  function disegnaSuggerimenti() {
    const box = $("#chat-suggest");
    box.innerHTML = suggerimentiCorrenti()
      .map(([q], i) => `<button type="button" class="chip" data-q="${i}">${esc(q)}</button>`)
      .join("");
  }

  function disegnaStato() {
    const b = $("#chat-mode");
    b.className = `pill ${live ? "ok" : ""}`;
    b.textContent = live ? "Claude dal vivo" : "Modalità demo";
    $("#chat-mode-note").textContent = live
      ? "Le risposte sono generate da Claude sui dati della schermata aperta."
      : "Risposte preimpostate alle domande suggerite. In locale, con una chiave API, risponde Claude dal vivo.";
  }

  function intro() {
    const log = $("#chat-log");
    log.innerHTML = "";
    aggiungi(
      "assistant",
      md(`Ciao ${D.AZIENDA.utente.nome.split(" ")[0]}, sono l'assistente della piattaforma. Rispondo sui dati della schermata che hai aperto: scegli una domanda qui sotto o scrivine una tua.`),
    );
  }

  // ------------------------------------------------------------ invio
  async function typewriter(target, text) {
    const parole = text.split(/(\s+)/);
    let acc = "";
    const box = $("#chat-log");
    for (let i = 0; i < parole.length; i++) {
      acc += parole[i];
      if (i % 3 === 0 || i === parole.length - 1) {
        target.innerHTML = md(acc);
        box.scrollTop = box.scrollHeight;
        await new Promise((r) => setTimeout(r, 14));
      }
    }
  }

  async function chiediLive(target) {
    const res = await fetch("api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, contesto: G.app.contesto() }),
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let testo = "";
    const box = $("#chat-log");
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 2);
        if (!line.startsWith("data:")) continue;
        const ev = JSON.parse(line.slice(5));
        if (ev.testo) {
          testo += ev.testo;
          target.innerHTML = md(testo);
          box.scrollTop = box.scrollHeight;
        }
        if (ev.errore) throw new Error(ev.errore);
      }
    }
    if (!testo.trim()) throw new Error("Risposta vuota");
    return testo;
  }

  async function ask(domanda, fn) {
    domanda = String(domanda || "").trim();
    if (!domanda || busy) return;
    busy = true;
    $("#chat-send").disabled = true;
    aggiungi("user", esc(domanda));
    history.push({ role: "user", content: domanda });
    const target = aggiungi("assistant", `<span class="typing" aria-label="Sto scrivendo"><i></i><i></i><i></i></span>`);
    let risposta;
    try {
      if (live) {
        try {
          risposta = await chiediLive(target);
        } catch (err) {
          risposta = fn ? fn() : rispostaPreimpostata(domanda);
          await typewriter(target, risposta);
          target.insertAdjacentHTML("beforeend", `<p class="muted small">Claude non è raggiungibile (${esc(err.message)}): ti ho dato la risposta preimpostata.</p>`);
        }
      } else {
        await new Promise((r) => setTimeout(r, 450));
        risposta = fn ? fn() : rispostaPreimpostata(domanda);
        await typewriter(target, risposta);
      }
      history.push({ role: "assistant", content: risposta });
      history = history.slice(-16);
    } catch (err) {
      target.innerHTML = `<p>Si è verificato un problema: ${esc(err.message)}</p>`;
      history.pop();
    } finally {
      busy = false;
      $("#chat-send").disabled = false;
    }
  }

  function apri() {
    open = true;
    document.body.classList.add("assistant-open");
    const p = $("#assistant");
    p.hidden = false;
    requestAnimationFrame(() => p.classList.add("open"));
    $("#btn-assistente").setAttribute("aria-expanded", "true");
    disegnaSuggerimenti();
    if (window.matchMedia("(min-width: 900px)").matches) setTimeout(() => $("#chat-input").focus(), 50);
  }
  function chiudi() {
    open = false;
    document.body.classList.remove("assistant-open");
    const p = $("#assistant");
    p.classList.remove("open");
    $("#btn-assistente").setAttribute("aria-expanded", "false");
    setTimeout(() => {
      if (!open) p.hidden = true;
    }, 220);
  }

  async function verificaStato() {
    // Sul sito statico (file locale o GitHub Pages) non c'è il server: Modalità demo.
    if (location.protocol === "file:" || /\.github\.io$/i.test(location.hostname)) return;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch("api/stato", { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(t);
      if (r.ok && (r.headers.get("content-type") || "").includes("json")) {
        const j = await r.json();
        live = Boolean(j.claude);
      }
    } catch (e) {
      live = false;
    }
    disegnaStato();
  }

  G.assistant = {
    init() {
      $("#btn-assistente").addEventListener("click", () => (open ? chiudi() : apri()));
      $("#chat-close").addEventListener("click", chiudi);
      $("#chat-new").addEventListener("click", () => {
        history = [];
        intro();
      });
      $("#chat-suggest").addEventListener("click", (e) => {
        const b = e.target.closest("[data-q]");
        if (!b) return;
        const [q, fn] = suggerimentiCorrenti()[Number(b.dataset.q)];
        ask(q, fn);
      });
      const form = $("#chat-form");
      const input = $("#chat-input");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const v = input.value;
        input.value = "";
        input.style.height = "";
        ask(v);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          form.requestSubmit();
        }
      });
      input.addEventListener("input", () => {
        input.style.height = "";
        input.style.height = Math.min(140, input.scrollHeight) + "px";
      });
      document.addEventListener("demo:route", (e) => {
        route = e.detail;
        if (open) disegnaSuggerimenti();
      });
      intro();
      disegnaStato();
      verificaStato();
    },
    open: apri,
    close: chiudi,
    isOpen: () => open,
    live: () => live,
    ask,
    suggerimenti: suggerimentiCorrenti,
    reset() {
      history = [];
      intro();
    },
  };
})();
