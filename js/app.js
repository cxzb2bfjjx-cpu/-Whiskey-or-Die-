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
          (mv.basis === "secondary" ? ' <small>2nd</small>' : "") +
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
      stat(mv.basis === "secondary" ? "Secondary value" : "Street price",
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
      (mv.basis === "secondary" ? " (secondary)" : "") + " · quality " + b.quality + "/100</div>";
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
          (mv.basis === "secondary" ? "2nd" : "retail") + "</span></span>" +
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
      source: $("#log-source").value,
      note: $("#log-note").value.trim(),
      ts: Date.now()
    });
    saveLog(log);
    $("#log-price").value = ""; $("#log-note").value = ""; $("#log-search").value = ""; logBottle = null;
    renderLog();
  });

  $("#log-clear").addEventListener("click", function () {
    if (confirm("Clear your entire price log? This can't be undone.")) { saveLog([]); renderLog(); }
  });

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

    // group stats by bottle
    const groups = {};
    log.forEach(function (e) { (groups[e.name] = groups[e.name] || []).push(e.price); });
    const statBits = Object.keys(groups).filter(function (k) { return groups[k].length > 1; }).map(function (k) {
      const arr = groups[k];
      const avg = arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
      return "<b>" + esc(k) + "</b>: avg " + VE.money(avg) + " across " + arr.length + " (" + VE.money(Math.min.apply(null, arr)) + "–" + VE.money(Math.max.apply(null, arr)) + ")";
    });
    if (statBits.length) wrap.innerHTML = '<div class="log-stat">' + statBits.join("<br>") + "</div>";

    log.forEach(function (e, idx) {
      const div = document.createElement("div");
      div.className = "log-entry";
      let compare = "";
      if (e.id && byId[e.id]) {
        const mv = VE.marketValue(byId[e.id]).value;
        const d = e.price - mv;
        compare = " · vs market " + (d >= 0 ? "+" : "−") + VE.money(Math.abs(d));
      }
      div.innerHTML =
        '<div class="le-top"><span class="le-name">' + esc(e.name) + '</span>' +
        '<span><span class="le-price">' + VE.money(e.price) + '</span> <span class="le-x" data-idx="' + idx + '">×</span></span></div>' +
        '<div class="le-meta">' + esc(e.source) + " · " + new Date(e.ts).toLocaleDateString() + compare +
        (e.note ? " · " + esc(e.note) : "") + "</div>";
      div.querySelector(".le-x").addEventListener("click", function () {
        const l = loadLog(); l.splice(idx, 1); saveLog(l); renderLog();
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

  /* ===================== BOOT ===================== */
  $("#data-meta").textContent = DATA.length + " bottles across " + presentCats.length + " categories · bourbon & Scotch core · Texas pricing";
  renderList();
  renderLog();
})();
