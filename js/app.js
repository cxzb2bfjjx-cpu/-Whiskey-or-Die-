/* ============================================================
   Whiskey or Die — App UI
   ============================================================ */
(function () {
  "use strict";

  const VE = window.ValueEngine;
  VE.init();
  const DATA = VE.data;
  DATA.sort(function (a, b) { return a.name.localeCompare(b.name); });

  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const byId = {};
  DATA.forEach(function (b) { byId[b.id] = b; });

  /* ---------- Category ordering (bourbon-first) ---------- */
  const CAT_ORDER = [
    "Bourbon", "Rye Whiskey", "Tennessee Whiskey", "American Whiskey",
    "Scotch", "Irish Whiskey", "Japanese Whisky", "Canadian Whisky", "World Whisky",
    "Tequila", "Mezcal", "Rum", "Gin", "Vodka", "Cognac", "Brandy", "Liqueur", "Wine"
  ];
  function catRank(c) { const i = CAT_ORDER.indexOf(c); return i === -1 ? 999 : i; }

  const presentCats = Array.from(new Set(DATA.map(function (b) { return b.category; })))
    .sort(function (a, b) { return catRank(a) - catRank(b) || a.localeCompare(b); });

  /* ===================== TABS ===================== */
  $$(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      $$(".tab").forEach(function (x) { x.classList.remove("active"); });
      t.classList.add("active");
      $$(".view").forEach(function (v) { v.classList.remove("active"); });
      $("#view-" + t.dataset.tab).classList.add("active");
      if (t.dataset.tab !== "scan") stopBarcode();
      window.scrollTo(0, 0);
    });
  });

  /* ===================== BROWSE ===================== */
  const state = { q: "", cat: "All", sort: "value", daily: false, allocated: false };

  // category chips
  const chipWrap = $("#category-chips");
  ["All"].concat(presentCats).forEach(function (c) {
    const el = document.createElement("button");
    el.className = "chip" + (c === "All" ? " active" : "");
    el.textContent = c === "All" ? "All" : c + " (" + DATA.filter(function (b) { return b.category === c; }).length + ")";
    el.dataset.cat = c;
    el.addEventListener("click", function () {
      state.cat = c;
      $$(".chip", chipWrap).forEach(function (x) { x.classList.remove("active"); });
      el.classList.add("active");
      renderList();
    });
    chipWrap.appendChild(el);
  });

  $("#search").addEventListener("input", function (e) { state.q = e.target.value.toLowerCase().trim(); renderList(); });
  $("#sort").addEventListener("change", function (e) { state.sort = e.target.value; renderList(); });
  $("#filter-daily").addEventListener("change", function (e) { state.daily = e.target.checked; renderList(); });
  $("#filter-allocated").addEventListener("change", function (e) { state.allocated = e.target.checked; renderList(); });

  function matches(b) {
    if (state.cat !== "All" && b.category !== state.cat) return false;
    if (state.daily && !b.dailyDrinker) return false;
    if (state.allocated && !b.allocated) return false;
    if (state.q) {
      const hay = (b.name + " " + b.brand + " " + b.producer + " " + b.type + " " + b.category).toLowerCase();
      return state.q.split(/\s+/).every(function (term) { return hay.indexOf(term) !== -1; });
    }
    return true;
  }

  function sortFn(a, b) {
    switch (state.sort) {
      case "quality": return b.quality - a.quality;
      case "price-low": return VE.marketValue(a).value - VE.marketValue(b).value;
      case "price-high": return VE.marketValue(b).value - VE.marketValue(a).value;
      case "name": return a.name.localeCompare(b.name);
      case "value":
      default: return VE.valueScore(b) - VE.valueScore(a);
    }
  }

  function bottleCard(b) {
    const mv = VE.marketValue(b);
    const verdict = VE.valueVerdict(b);
    const card = document.createElement("div");
    card.className = "bottle-card";
    const tags = [];
    if (b.allocated) tags.push('<span class="tag allocated">Allocated</span>');
    if (b.dailyDrinker) tags.push('<span class="tag daily">Daily</span>');
    tags.push('<span class="tag">' + b.category + "</span>");

    card.innerHTML =
      '<div class="bc-main">' +
        '<div class="bc-name">' + esc(b.name) + "</div>" +
        '<div class="bc-sub">' + esc(b.type) + (b.age && b.age !== "NAS" ? " · " + esc(b.age) : "") + (b.proof ? " · " + b.proof + "°" : "") + "</div>" +
        '<div class="bc-tags">' + tags.join("") + "</div>" +
      "</div>" +
      '<div class="bc-right">' +
        '<div class="vbadge ' + verdict.cls + '">' + verdict.label + "</div>" +
        '<div class="bc-price">' + VE.money(mv.value) +
          (mv.basis === "secondary" ? ' <small>2nd</small>' : mv.basis === "observed" ? ' <small>est</small>' : "") +
        "</div>" +
        '<div class="qmeter"><span class="qnum" style="color:' + qColor(b.quality) + '">' + b.quality + "</span><span style=\"font-size:10px;color:var(--muted)\">/100</span></div>" +
      "</div>";
    card.addEventListener("click", function () { openModal(b); });
    return card;
  }

  function renderList() {
    const list = $("#bottle-list");
    const items = DATA.filter(matches).sort(sortFn);
    $("#result-count").textContent = items.length + " bottle" + (items.length === 1 ? "" : "s");
    list.innerHTML = "";
    if (!items.length) { list.innerHTML = '<div class="empty">No bottles match. Try a different search or filter.</div>'; return; }
    const frag = document.createDocumentFragment();
    items.forEach(function (b) { frag.appendChild(bottleCard(b)); });
    list.appendChild(frag);
  }

  /* ===================== DETAIL MODAL ===================== */
  function openModal(b) {
    const mv = VE.marketValue(b);
    const verdict = VE.valueVerdict(b);
    const score = VE.valueScore(b);
    const sec = VE.secondaryMid(b);

    const stats = [
      stat("Quality", '<span style="color:' + qColor(b.quality) + '">' + b.quality + "</span><span style='font-size:12px;color:var(--muted)'>/100</span>"),
      stat("Value score", score + '<span style="font-size:12px;color:var(--muted)">/100</span>'),
      stat("MSRP", VE.money(b.msrp)),
      stat(mv.basis === "secondary" ? "Secondary value" : mv.basis === "observed" ? "Market value (live)" : "Street price",
           VE.money(mv.value) + (mv.low != null && mv.high != null && mv.low !== mv.high
             ? '<div style="font-size:11px;color:var(--muted);font-weight:500">' + VE.money(mv.low) + "–" + VE.money(mv.high) + "</div>" : ""))
    ].join("");

    let secBlock = "";
    if (sec != null) {
      const flip = b.msrp ? sec - b.msrp : null;
      secBlock =
        '<div class="m-section-title">Aftermarket</div>' +
        '<div class="m-notes">Trades around <b>' + VE.money(sec) + "</b>" +
        (b.secondaryLow != null ? " (" + VE.money(b.secondaryLow) + "–" + VE.money(b.secondaryHigh) + ")" : "") + "." +
        (flip != null && flip > 0 ? " That's <b>" + VE.money(flip) + "</b> over the " + VE.money(b.msrp) + " MSRP — the flip premium if you can land one at retail." : "") +
        "</div>";
    }
    if (mv.basis === "observed") {
      secBlock +=
        '<div class="m-section-title">Your logged data</div>' +
        '<div class="m-notes">Blended with <b>' + mv.observedCount + "</b> price" + (mv.observedCount > 1 ? "s" : "") +
        " you've logged (est. sale median <b>" + VE.money(mv.observedMid) + "</b> vs curated " + VE.money(mv.curated) +
        ") → working market value <b>" + VE.money(mv.value) + "</b>.</div>";
    }

    const m = $("#modal");
    m.innerHTML =
      '<span class="modal-close" id="modal-close">×</span>' +
      '<div class="m-name">' + esc(b.name) + "</div>" +
      '<div class="m-sub">' + esc(b.producer) + " · " + esc(b.region) + " · " + esc(b.type) +
        (b.age && b.age !== "NAS" ? " · " + esc(b.age) : "") + (b.proof ? " · " + b.proof + "° (" + b.abv + "% ABV)" : "") + "</div>" +

      '<div class="m-verdict ' + verdict.cls.replace("v-", "verdict-") + '">' + verdict.label + " · value " + score + "/100</div>" +

      '<div class="m-grid">' + stats + "</div>" +

      '<div class="m-section-title">Quality</div>' +
      '<div class="qbar"><div class="qbar-fill" style="width:' + b.quality + "%;background:" + qColor(b.quality) + '"></div></div>' +
      '<div class="m-notes" style="margin-top:6px">' + VE.qualityWord(b.quality).replace(/^./, function (c) { return c.toUpperCase(); }) +
        (b.expertScore ? " · " + esc(String(b.expertScore)) : "") +
        (b.communityScore ? " · community " + b.communityScore + "/5" : "") + "</div>" +

      '<div class="m-section-title">Tasting profile</div>' +
      '<div class="m-profile">' + esc(b.profile) + "</div>" +

      secBlock +

      '<div class="m-section-title">The verdict</div>' +
      '<div class="m-notes">' + esc(b.notes) + "</div>" +

      '<div class="m-actions">' +
        '<button class="btn-primary" id="m-deal">Check a price</button>' +
        '<button class="btn-ghost" id="m-trade">Add to trade</button>' +
      "</div>";

    $("#modal-close").addEventListener("click", closeModal);
    $("#m-deal").addEventListener("click", function () {
      closeModal(); switchTab("deal"); selectDealBottle(b); $("#deal-price").focus();
    });
    $("#m-trade").addEventListener("click", function () {
      closeModal(); switchTab("trade"); addTradeItem("them", b.id);
    });
    $("#modal-backdrop").classList.add("open");
  }
  function closeModal() { $("#modal-backdrop").classList.remove("open"); }
  $("#modal-backdrop").addEventListener("click", function (e) { if (e.target === this) closeModal(); });

  function stat(lbl, val) { return '<div class="m-stat"><div class="lbl">' + lbl + '</div><div class="val">' + val + "</div></div>"; }

  function switchTab(name) {
    const t = $('.tab[data-tab="' + name + '"]'); if (t) t.click();
  }

  /* ===================== AUTOCOMPLETE (shared) ===================== */
  function attachAutocomplete(input, dropdown, onPick) {
    function close() { dropdown.classList.remove("open"); dropdown.innerHTML = ""; }
    input.addEventListener("input", function () {
      const q = input.value.toLowerCase().trim();
      if (q.length < 2) { close(); return; }
      const terms = q.split(/\s+/);
      const hits = DATA.filter(function (b) {
        const hay = (b.name + " " + b.brand + " " + b.category).toLowerCase();
        return terms.every(function (t) { return hay.indexOf(t) !== -1; });
      }).slice(0, 12);
      if (!hits.length) { close(); return; }
      dropdown.innerHTML = "";
      hits.forEach(function (b) {
        const it = document.createElement("div");
        it.className = "ac-item";
        it.innerHTML = esc(b.name) + "<small>" + esc(b.category) + " · " + VE.money(VE.marketValue(b).value) + "</small>";
        it.addEventListener("click", function () { onPick(b); close(); });
        dropdown.appendChild(it);
      });
      dropdown.classList.add("open");
    });
    document.addEventListener("click", function (e) {
      if (e.target !== input && !dropdown.contains(e.target)) close();
    });
  }

  /* ===================== DEAL CHECK ===================== */
  let dealBottle = null;
  attachAutocomplete($("#deal-search"), $("#deal-autocomplete"), function (b) { selectDealBottle(b); });

  function selectDealBottle(b) {
    dealBottle = b;
    $("#deal-search").value = b.name;
    const mv = VE.marketValue(b);
    $("#deal-selected").innerHTML =
      '<div class="deal-selected-card"><b>' + esc(b.name) + "</b> · " + esc(b.category) +
      "<br>MSRP " + VE.money(b.msrp) + " · market " + VE.money(mv.value) +
      (mv.basis === "secondary" ? " (secondary)" : mv.basis === "observed" ? " (your data)" : "") + " · quality " + b.quality + "/100</div>";
  }

  $("#deal-go").addEventListener("click", runDeal);
  $("#deal-price").addEventListener("keydown", function (e) { if (e.key === "Enter") runDeal(); });

  function runDeal() {
    if (!dealBottle) { flash($("#deal-result"), "Pick a bottle first."); return; }
    const price = parseFloat($("#deal-price").value);
    if (!price || price <= 0) { flash($("#deal-result"), "Enter the shelf price."); return; }
    const r = VE.dealCheck(dealBottle, price);
    $("#deal-result").innerHTML =
      '<div class="verdict-card big verdict-' + r.key + '">' + r.label +
      '<div class="verdict-line">' + r.lines.join("<br>") + "</div></div>";
  }

  /* ===================== TRADE BALANCER ===================== */
  const trade = { them: [], you: [] };

  $$(".trade-search").forEach(function (inp) {
    const side = inp.dataset.side;
    const dd = $('.autocomplete[data-side="' + side + '"]');
    attachAutocomplete(inp, dd, function (b) { addTradeItem(side, b.id); inp.value = ""; });
  });

  function addTradeItem(side, id) {
    trade[side].push(id);
    renderTrade();
    switchTab("trade");
  }
  function removeTradeItem(side, idx) { trade[side].splice(idx, 1); renderTrade(); }

  function renderTrade() {
    ["them", "you"].forEach(function (side) {
      const wrap = $('.trade-items[data-side="' + side + '"]');
      wrap.innerHTML = "";
      trade[side].forEach(function (id, idx) {
        const b = byId[id];
        const mv = VE.marketValue(b);
        const row = document.createElement("div");
        row.className = "trade-item";
        row.innerHTML = "<span>" + esc(b.name) + ' <span style="color:var(--muted);font-size:11px">' +
          (mv.basis === "secondary" ? "2nd" : mv.basis === "observed" ? "your data" : "retail") + "</span></span>" +
          '<span><span class="ti-val">' + VE.money(mv.value) + '</span> <span class="ti-x">×</span></span>';
        row.querySelector(".ti-x").addEventListener("click", function () { removeTradeItem(side, idx); });
        wrap.appendChild(row);
      });
      const subtotal = VE.tradeValue(trade[side].map(function (id) { return byId[id]; }));
      $('.trade-subtotal[data-side="' + side + '"]').textContent = VE.money(subtotal);
    });
    renderTradeVerdict();
  }

  function renderTradeVerdict() {
    const themVal = VE.tradeValue(trade.them.map(function (id) { return byId[id]; }));
    const youVal = VE.tradeValue(trade.you.map(function (id) { return byId[id]; }));
    const box = $("#trade-verdict");
    if (!trade.them.length && !trade.you.length) { box.innerHTML = ""; return; }
    const diff = themVal - youVal; // positive = in your favor (you receive more value than you give)
    const big = Math.max(themVal, youVal, 1);
    const pct = Math.round(Math.abs(diff) / big * 100);

    let key, headline;
    if (Math.abs(diff) < big * 0.05) { key = "fair"; headline = "Even trade"; }
    else if (diff > 0) { key = (pct >= 20 ? "steal" : "great"); headline = "In your favor +" + VE.money(diff); }
    else { key = (pct >= 20 ? "bad" : "high"); headline = "Against you −" + VE.money(-diff); }

    const lines = [];
    lines.push("You receive <b>" + VE.money(themVal) + "</b>, you give <b>" + VE.money(youVal) + "</b>.");
    lines.push("Net swing: <b>" + (diff >= 0 ? "+" : "−") + VE.money(Math.abs(diff)) + "</b> (" + pct + "% " + (diff >= 0 ? "your way" : "their way") + ").");
    if (diff > big * 0.05) lines.push("👍 Take it — you're coming out ahead on market value.");
    else if (diff < -big * 0.05) lines.push("👎 You're overpaying. Ask them to add a bottle or sweeten it.");
    else lines.push("A wash on value — decide on what YOU actually want to drink.");
    lines.push('<span style="color:var(--muted);font-size:11px">Based on curated secondary/market values. Real offers vary — log actual prices in My Log to sharpen this.</span>');

    box.innerHTML = '<div class="verdict-card big verdict-' + key + '">' + headline +
      '<div class="verdict-line">' + lines.join("<br>") + "</div></div>";
  }

  $("#trade-reset").addEventListener("click", function () { trade.them = []; trade.you = []; renderTrade(); });

  /* ===================== MY LOG ===================== */
  const LOG_KEY = "wod_pricelog_v1";
  let logBottle = null;
  attachAutocomplete($("#log-search"), $("#log-autocomplete"), function (b) {
    logBottle = b; $("#log-search").value = b.name;
  });

  function loadLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || []; } catch (e) { return []; } }
  function saveLog(l) { localStorage.setItem(LOG_KEY, JSON.stringify(l)); }

  $("#log-add").addEventListener("click", function () {
    const price = parseFloat($("#log-price").value);
    const name = $("#log-search").value.trim();
    if (!name) { flash($("#log-entries"), "Enter a bottle name."); return; }
    if (!price || price <= 0) { flash($("#log-entries"), "Enter a price."); return; }
    const log = loadLog();
    log.unshift({
      id: logBottle ? logBottle.id : null,
      name: logBottle ? logBottle.name : name,
      price: price,
      est: VE.estimateSaleFromAsk(price),
      source: $("#log-source").value,
      note: $("#log-note").value.trim(),
      ts: Date.now()
    });
    saveLog(log);
    $("#log-price").value = ""; $("#log-note").value = ""; $("#log-search").value = ""; logBottle = null;
    refreshObserved();
  });

  $("#log-clear").addEventListener("click", function () {
    if (confirm("Clear your entire price log? This can't be undone.")) { saveLog([]); refreshObserved(); }
  });

  /* Rebuild the engine's observed-price overlay from every matched log entry,
     then re-render the views that depend on market value. */
  function gatherObserved() {
    const map = {};
    loadLog().forEach(function (e) {
      if (e.id && byId[e.id]) {
        const est = e.est != null ? e.est : VE.estimateSaleFromAsk(e.price);
        (map[e.id] = map[e.id] || []).push(est);
      }
    });
    return map;
  }
  function refreshObserved() {
    VE.setObserved(gatherObserved());
    renderList();
    renderLog();
  }

  $("#log-export").addEventListener("click", function () {
    const log = loadLog();
    if (!log.length) { flash($("#log-entries"), "Nothing to export yet."); return; }
    const rows = [["date", "bottle", "price", "source", "note"]].concat(log.map(function (e) {
      return [new Date(e.ts).toISOString().slice(0, 10), e.name, e.price, e.source, (e.note || "").replace(/"/g, "'")];
    }));
    const csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c) + '"'; }).join(","); }).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "whiskey-or-die-pricelog.csv"; a.click();
  });

  function renderLog() {
    const log = loadLog();
    const wrap = $("#log-entries");
    wrap.innerHTML = "";
    if (!log.length) { wrap.innerHTML = '<div class="empty">No prices logged yet. Spotted one in a FB group or at auction? Add it above.</div>'; return; }

    // per-bottle stats based on estimated SALE price (what it really trades at)
    const groups = {};
    log.forEach(function (e) {
      const est = e.est != null ? e.est : VE.estimateSaleFromAsk(e.price);
      (groups[e.name] = groups[e.name] || []).push(est);
    });
    const statBits = Object.keys(groups).filter(function (k) { return groups[k].length > 1; }).map(function (k) {
      const arr = groups[k];
      const med = VE.median(arr);
      return "<b>" + esc(k) + "</b>: ~" + VE.money(med) + " est. sale across " + arr.length +
        " asks (" + VE.money(Math.min.apply(null, arr)) + "–" + VE.money(Math.max.apply(null, arr)) + ")";
    });
    if (statBits.length) wrap.innerHTML = '<div class="log-stat">📈 Your market read (estimated sale prices):<br>' + statBits.join("<br>") + "</div>";

    log.forEach(function (e, idx) {
      const div = document.createElement("div");
      div.className = "log-entry";
      const est = e.est != null ? e.est : VE.estimateSaleFromAsk(e.price);
      const estTxt = est !== e.price ? ' <span style="color:var(--muted);font-size:11px">→ est. sale ~' + VE.money(est) + "</span>" : "";
      div.innerHTML =
        '<div class="le-top"><span class="le-name">' + esc(e.name) + '</span>' +
        '<span><span class="le-price">' + VE.money(e.price) + '</span>' + estTxt + ' <span class="le-x">×</span></span></div>' +
        '<div class="le-meta">' + esc(e.source) + " · " + new Date(e.ts).toLocaleDateString() +
        (e.id && byId[e.id] ? " · feeds market value ✓" : " · unmatched (not scoring)") +
        (e.note ? " · " + esc(e.note) : "") + "</div>";
      div.querySelector(".le-x").addEventListener("click", function () {
        const l = loadLog(); l.splice(idx, 1); saveLog(l); refreshObserved();
      });
      wrap.appendChild(div);
    });
  }

  /* ===================== UTILS ===================== */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function qColor(q) {
    if (q >= 92) return "#5cc26a";
    if (q >= 86) return "#9bd06a";
    if (q >= 80) return "#e7c84a";
    if (q >= 74) return "#e88a3c";
    return "#e0573f";
  }
  function flash(el, msg) {
    el.innerHTML = '<div class="verdict-card verdict-fair">' + esc(msg) + "</div>";
    setTimeout(function () { if (el.firstChild && el.textContent === msg) el.innerHTML = ""; }, 2500);
  }

  /* ===================== SCAN (label OCR + barcode) ===================== */
  const UPC_KEY = "wod_upcmap_v1";
  function loadUpcMap() { try { return JSON.parse(localStorage.getItem(UPC_KEY)) || {}; } catch (e) { return {}; } }
  function saveUpcMap(m) { localStorage.setItem(UPC_KEY, JSON.stringify(m)); }

  // generic label words to ignore when matching OCR text to a bottle
  const STOP = new Set(("the and for with aged year years old kentucky tennessee straight whiskey whisky " +
    "bourbon scotch single barrel small batch proof distillery distilled company co reserve label " +
    "estate vineyards winery tequila vodka gin rum cognac brandy liqueur wine bottled bond non chill " +
    "filtered cask strength original premium handcrafted product france mexico scotland ireland japan").split(/\s+/));

  function tokenize(s) {
    return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter(function (w) { return w.length >= 2 && !STOP.has(w); });
  }

  function fuzzyMatch(text, limit) {
    const t = " " + text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ") + " ";
    const words = new Set(tokenize(text));
    const scored = DATA.map(function (b) {
      const nameTokens = tokenize(b.name + " " + b.brand);
      let hit = 0;
      nameTokens.forEach(function (w) { if (words.has(w)) hit++; });
      let score = hit;
      if (b.brand && t.indexOf(" " + b.brand.toLowerCase() + " ") !== -1) score += 3; // strong brand signal
      return { b: b, score: score, frac: hit / Math.max(1, nameTokens.length) };
    }).filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score || b.frac - a.frac; });
    return scored.slice(0, limit || 6).map(function (x) { return x.b; });
  }

  const scanStatus = $("#scan-status");
  const scanResults = $("#scan-results");
  function clearScan() { scanStatus.innerHTML = ""; scanResults.innerHTML = ""; }
  function setStatus(html) { scanStatus.innerHTML = html ? '<div class="scan-progress">' + html + "</div>" : ""; }
  function setProgress(label, pct) {
    scanStatus.innerHTML = '<div class="scan-progress">' + esc(label) +
      '<div class="bar"><div style="width:' + pct + '%"></div></div></div>';
  }

  function showResults(bottles, ocrText) {
    scanResults.innerHTML = "";
    bottles.forEach(function (b) { scanResults.appendChild(bottleCard(b)); });
    if (ocrText) {
      const t = document.createElement("div");
      t.className = "scan-ocr-text";
      t.textContent = "Read from label: " + ocrText.replace(/\s+/g, " ").trim().slice(0, 120);
      scanResults.appendChild(t);
    }
    scanResults.appendChild(manualSearchBox("Not the right one? Search manually:", function (b) { showResults([b]); }));
  }

  function manualSearchBox(label, onPick) {
    const wrap = document.createElement("div");
    wrap.className = "field"; wrap.style.marginTop = "12px";
    wrap.innerHTML = "<span>" + esc(label) + '</span><input type="search" placeholder="Type a bottle name…" autocomplete="off"><div class="autocomplete"></div>';
    const input = wrap.querySelector("input"), dd = wrap.querySelector(".autocomplete");
    attachAutocomplete(input, dd, function (b) { onPick(b); });
    return wrap;
  }

  /* ---- Label photo OCR ---- */
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    return new Promise(function (res, rej) {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      s.onload = function () { window.Tesseract ? res(window.Tesseract) : rej(new Error("no tesseract")); };
      s.onerror = function () { rej(new Error("load failed")); };
      document.head.appendChild(s);
    });
  }

  async function handlePhoto(file) {
    if (!file) return;
    clearScan();
    setProgress("Loading the text-reader…", 5);
    let T;
    try { T = await loadTesseract(); }
    catch (e) {
      setStatus("Couldn't load the on-device text-reader (it needs internet the first time). Search instead:");
      scanResults.innerHTML = "";
      scanResults.appendChild(manualSearchBox("Find your bottle:", function (b) { showResults([b]); }));
      return;
    }
    try {
      const url = URL.createObjectURL(file);
      const result = await T.recognize(url, "eng", {
        logger: function (m) { if (m.status === "recognizing text") setProgress("Reading the label…", Math.round(m.progress * 100)); }
      });
      URL.revokeObjectURL(url);
      const text = (result && result.data && result.data.text) || "";
      const matches = fuzzyMatch(text, 6);
      if (matches.length) { setStatus("Best matches from the label 👇"); showResults(matches, text); }
      else {
        setStatus("Couldn't confidently match that label. Search instead:");
        scanResults.innerHTML = "";
        if (text.trim()) { const d = document.createElement("div"); d.className = "scan-ocr-text"; d.textContent = "Read: " + text.replace(/\s+/g, " ").trim().slice(0, 120); scanResults.appendChild(d); }
        scanResults.appendChild(manualSearchBox("Find your bottle:", function (b) { showResults([b]); }));
      }
    } catch (e) {
      setStatus("Couldn't read that image — try a clearer, well-lit shot of the front label. Or search:");
      scanResults.innerHTML = "";
      scanResults.appendChild(manualSearchBox("Find your bottle:", function (b) { showResults([b]); }));
    }
  }

  /* ---- Barcode scanning (native BarcodeDetector) ---- */
  let scanStream = null, scanRAF = null, detector = null;

  async function startBarcode() {
    clearScan();
    if (!("BarcodeDetector" in window)) {
      setStatus("Your browser can't scan barcodes directly (try Chrome on Android, or use Snap-the-label). Search instead:");
      scanResults.appendChild(manualSearchBox("Find your bottle:", function (b) { showResults([b]); }));
      return;
    }
    try { detector = new window.BarcodeDetector({ formats: ["upc_a", "upc_e", "ean_13", "ean_8", "code_128"] }); }
    catch (e) { detector = new window.BarcodeDetector(); }
    try { scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } }); }
    catch (e) {
      setStatus("Camera access was blocked. Allow camera in your browser settings, or search instead:");
      scanResults.appendChild(manualSearchBox("Find your bottle:", function (b) { showResults([b]); }));
      return;
    }
    const cam = $("#scan-camera"), video = $("#scan-video");
    cam.hidden = false; video.srcObject = scanStream;
    try { await video.play(); } catch (e) { /* autoplay quirks */ }
    const tick = async function () {
      if (!scanStream) return;
      try {
        const codes = await detector.detect(video);
        if (codes && codes.length) { handleUPC(codes[0].rawValue); return; }
      } catch (e) { /* transient detect errors are fine */ }
      scanRAF = requestAnimationFrame(tick);
    };
    scanRAF = requestAnimationFrame(tick);
  }

  function stopBarcode() {
    if (scanRAF) { cancelAnimationFrame(scanRAF); scanRAF = null; }
    if (scanStream) { scanStream.getTracks().forEach(function (t) { t.stop(); }); scanStream = null; }
    const cam = $("#scan-camera"); if (cam) cam.hidden = true;
  }

  function handleUPC(code) {
    stopBarcode();
    const map = loadUpcMap();
    if (map[code] && byId[map[code]]) {
      setStatus("Barcode matched ✓");
      showResults([byId[map[code]]]);
    } else {
      promptLinkUPC(code);
    }
  }

  function promptLinkUPC(code) {
    setStatus("");
    scanResults.innerHTML = "";
    const note = document.createElement("div");
    note.className = "scan-link-prompt";
    note.innerHTML = "New barcode <b>" + esc(code) + "</b> isn't linked yet. Tap the matching bottle once — I'll remember it next time.";
    scanResults.appendChild(note);
    scanResults.appendChild(manualSearchBox("Which bottle is this?", function (b) {
      const map = loadUpcMap(); map[code] = b.id; saveUpcMap(map);
      setStatus("Linked ✓ — future scans of this barcode open instantly.");
      showResults([b]);
    }));
  }

  $("#scan-photo-btn").addEventListener("click", function () { $("#scan-photo-input").click(); });
  $("#scan-photo-input").addEventListener("change", function (e) { handlePhoto(e.target.files && e.target.files[0]); e.target.value = ""; });
  $("#scan-barcode-btn").addEventListener("click", startBarcode);
  $("#scan-stop").addEventListener("click", stopBarcode);

  /* ===================== BULK PHOTO IMPORT ===================== */
  const VOLUMES = new Set(["50", "100", "200", "375", "700", "750", "1000", "1750"]);

  /* Pull plausible prices out of OCR'd listing text. Dollar-signed numbers
     win; otherwise bare numbers minus volumes/proof/age/abv noise. */
  function parsePrices(text) {
    const found = [];
    let m;
    const re = /\$\s?(\d{1,3}(?:,\d{3})+|\d{2,5})(?:\.\d{2})?/g;
    while ((m = re.exec(text))) {
      const n = parseInt(m[1].replace(/,/g, ""), 10);
      if (n >= 10 && n <= 20000) found.push(n);
    }
    if (!found.length) {
      const t = text.toLowerCase();
      const re2 = /(\d{1,3}(?:,\d{3})+|\d{2,5})(?:\.\d+)?/g;
      while ((m = re2.exec(t))) {
        const n = parseInt(m[1].replace(/,/g, ""), 10);
        const after = t.slice(m.index + m[0].length, m.index + m[0].length + 6);
        if (/^\s*(ml|l\b|proof|pf|yr|year|%|°)/.test(after)) continue;
        if (VOLUMES.has(String(n))) continue;
        if (n < 20 || n > 20000) continue;
        found.push(n);
      }
    }
    return found;
  }

  async function runImport(files) {
    if (!files || !files.length) return;
    const statusEl = $("#import-status"), reviewEl = $("#import-review");
    reviewEl.innerHTML = "";
    statusEl.innerHTML = '<div class="scan-progress">Loading the text-reader…<div class="bar"><div style="width:5%"></div></div></div>';
    let T;
    try { T = await loadTesseract(); }
    catch (e) { statusEl.innerHTML = '<div class="verdict-card verdict-fair">Couldn\'t load the on-device text-reader (it needs internet the first time). Try again on a connection.</div>'; return; }

    const items = [];
    for (let i = 0; i < files.length; i++) {
      statusEl.innerHTML = '<div class="scan-progress">Reading photo ' + (i + 1) + " of " + files.length +
        '…<div class="bar"><div style="width:' + Math.round((i / files.length) * 100) + '%"></div></div></div>';
      let text = "";
      let thumb = "";
      try {
        const url = URL.createObjectURL(files[i]);
        thumb = url;
        const result = await T.recognize(url, "eng");
        text = (result && result.data && result.data.text) || "";
      } catch (e) { /* skip unreadable image */ }
      const prices = parsePrices(text);
      const matches = fuzzyMatch(text, 1);
      items.push({
        bottle: matches[0] || null,
        ask: prices.length ? Math.max.apply(null, prices) : null,
        thumb: thumb,
        rawName: (matches[0] && matches[0].name) || text.replace(/\s+/g, " ").trim().slice(0, 40)
      });
    }
    statusEl.innerHTML = '<div class="scan-progress">Read ' + files.length + " photo" + (files.length > 1 ? "s" : "") +
      ". Review below — fix matches and prices, then save.</div>";
    renderReview(items);
  }

  function renderReview(items) {
    const wrap = $("#import-review");
    wrap.innerHTML = "";
    if (!items.length) return;

    items.forEach(function (it) {
      const row = document.createElement("div");
      row.className = "import-row" + (it.bottle ? "" : " ir-unmatched");

      const top = document.createElement("div");
      top.className = "ir-top";
      top.innerHTML = (it.thumb ? '<img class="ir-thumb" src="' + it.thumb + '">' : "") +
        '<span style="flex:1;font-size:12px;color:var(--muted)">' + (it.bottle ? "Matched" : "No match — pick the bottle") + "</span>" +
        '<span class="ir-x">×</span>';
      row.appendChild(top);

      // bottle picker (prefilled)
      const pick = document.createElement("div");
      pick.className = "field"; pick.style.marginBottom = "8px";
      pick.innerHTML = '<input type="search" autocomplete="off" placeholder="Bottle…"><div class="autocomplete"></div>';
      const pinput = pick.querySelector("input"), pdd = pick.querySelector(".autocomplete");
      if (it.bottle) pinput.value = it.bottle.name;
      attachAutocomplete(pinput, pdd, function (b) {
        it.bottle = b; pinput.value = b.name; row.classList.remove("ir-unmatched");
        top.querySelector("span").textContent = "Matched";
      });
      row.appendChild(pick);

      // price + estimate
      const prices = document.createElement("div");
      prices.className = "ir-prices";
      prices.innerHTML = '<label>Asking price ($)<input type="number" inputmode="decimal" value="' + (it.ask != null ? it.ask : "") + '"></label>' +
        '<span class="ir-est"></span>';
      const ainput = prices.querySelector("input"), estEl = prices.querySelector(".ir-est");
      function updateEst() {
        const v = parseFloat(ainput.value);
        it.ask = v > 0 ? v : null;
        estEl.textContent = it.ask ? "→ ~" + VE.money(VE.estimateSaleFromAsk(it.ask)) : "";
      }
      ainput.addEventListener("input", updateEst); updateEst();
      row.appendChild(prices);

      if (!it.bottle) { const f = document.createElement("div"); f.className = "ir-flag"; f.textContent = "Couldn't auto-match — won't save until you pick a bottle."; row.appendChild(f); }

      top.querySelector(".ir-x").addEventListener("click", function () {
        const i = items.indexOf(it); if (i > -1) items.splice(i, 1); renderReview(items);
      });
      wrap.appendChild(row);
    });

    const save = document.createElement("button");
    save.className = "btn-primary"; save.style.marginTop = "4px";
    save.textContent = "Save matched prices";
    save.addEventListener("click", function () { saveImport(items); });
    wrap.appendChild(save);
  }

  function saveImport(items) {
    const ready = items.filter(function (it) { return it.bottle && it.ask > 0; });
    if (!ready.length) { $("#import-status").innerHTML = '<div class="verdict-card verdict-fair">Nothing to save — match at least one bottle with a price.</div>'; return; }
    const log = loadLog();
    ready.forEach(function (it) {
      log.unshift({
        id: it.bottle.id, name: it.bottle.name, price: it.ask,
        est: VE.estimateSaleFromAsk(it.ask),
        source: "FB ask", note: "photo import", ts: Date.now()
      });
    });
    saveLog(log);
    $("#import-review").innerHTML = "";
    $("#import-status").innerHTML = '<div class="verdict-card verdict-great">Saved ' + ready.length +
      " price" + (ready.length > 1 ? "s" : "") + " ✓ — market values updated below.</div>";
    refreshObserved();
  }

  $("#import-photos-btn").addEventListener("click", function () { $("#import-input").click(); });
  $("#import-input").addEventListener("change", function (e) { runImport(Array.prototype.slice.call(e.target.files || [])); e.target.value = ""; });

  /* ===================== BOOT ===================== */
  $("#data-meta").textContent = DATA.length + " bottles across " + presentCats.length + " categories · bourbon & Scotch core · Texas pricing";
  refreshObserved(); // applies any previously-logged prices, then renders browse + log
})();
