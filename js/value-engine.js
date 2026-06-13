/* ============================================================
   Whiskey or Die — Value Engine
   The brain: turns raw bottle data into market value, a 0-100
   value score, and a plain-English "good deal or screwed" verdict.
   ============================================================ */
(function () {
  "use strict";

  const DATA = window.BOTTLE_DATA || [];

  /* --- helpers --- */
  function mid(low, high, fallback) {
    if (low != null && high != null) return (low + high) / 2;
    if (low != null) return low;
    if (high != null) return high;
    return fallback != null ? fallback : null;
  }

  function retailMid(b) {
    const m = mid(b.streetLow, b.streetHigh, b.msrp);
    return m != null ? m : b.msrp;
  }

  function secondaryMid(b) {
    if (b.secondaryLow == null && b.secondaryHigh == null) return null;
    return mid(b.secondaryLow, b.secondaryHigh, null);
  }

  /* Market value = what it ACTUALLY costs to acquire.
     For allocated bottles with a secondary value, MSRP is fiction —
     the real cost is the secondary market. Otherwise it's the shelf. */
  function marketValue(b) {
    const sec = secondaryMid(b);
    if (b.allocated && sec != null) {
      return { value: sec, low: b.secondaryLow, high: b.secondaryHigh, basis: "secondary" };
    }
    const r = retailMid(b);
    return { value: r, low: b.streetLow != null ? b.streetLow : b.msrp,
             high: b.streetHigh != null ? b.streetHigh : b.msrp, basis: "retail" };
  }

  /* Quality points per dollar at the bottle's real market price. */
  function qualityPerDollar(b) {
    const mv = marketValue(b).value;
    if (!mv || mv <= 0) return 0;
    return b.quality / mv;
  }

  /* --- Category-relative value scoring ---
     "Is it worth it?" is only meaningful WITHIN a category. A $60 bourbon
     and a $60 wine aren't judged on the same curve. We rank each bottle's
     quality-per-dollar against its category peers → 0-100 value score.    */
  const catStats = {};
  function buildCategoryStats() {
    const groups = {};
    DATA.forEach(function (b) {
      (groups[b.category] = groups[b.category] || []).push(qualityPerDollar(b));
    });
    Object.keys(groups).forEach(function (cat) {
      const arr = groups[cat].slice().sort(function (a, c) { return a - c; });
      catStats[cat] = arr;
    });
  }

  function percentileRank(sortedArr, v) {
    if (!sortedArr || sortedArr.length < 2) return 50;
    let below = 0;
    for (let i = 0; i < sortedArr.length; i++) {
      if (sortedArr[i] < v) below++;
      else break;
    }
    return Math.round((below / (sortedArr.length - 1)) * 100);
  }

  /* Value score blends category-relative QPD percentile (70%) with an
     absolute quality floor (30%) so a dirt-cheap mediocre bottle can't
     out-score a genuinely great one purely on price. */
  function valueScore(b) {
    const qpd = qualityPerDollar(b);
    const pct = percentileRank(catStats[b.category], qpd);
    const qualityFloor = clamp((b.quality - 60) / 40 * 100, 0, 100); // 60→0, 100→100
    return Math.round(pct * 0.7 + qualityFloor * 0.3);
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* Static verdict for browsing — how good a buy is this AT its market price. */
  function valueVerdict(b) {
    const s = valueScore(b);
    if (s >= 78) return { key: "steal", label: "Great Value", cls: "v-steal" };
    if (s >= 62) return { key: "great", label: "Good Value", cls: "v-great" };
    if (s >= 42) return { key: "fair",  label: "Fair Price", cls: "v-fair" };
    if (s >= 26) return { key: "high",  label: "Premium",    cls: "v-high" };
    return { key: "bad", label: "Overpriced", cls: "v-bad" };
  }

  /* --- In-store deal check: a SPECIFIC asking price vs reality --- */
  function dealCheck(b, asking) {
    const mv = marketValue(b);
    const ratio = asking / mv.value;
    const overMsrp = b.msrp ? (asking - b.msrp) / b.msrp : null;

    let key, label;
    if (ratio <= 0.78)      { key = "steal"; label = "STEAL — grab it"; }
    else if (ratio <= 0.93) { key = "great"; label = "Good deal"; }
    else if (ratio <= 1.10) { key = "fair";  label = "Fair price"; }
    else if (ratio <= 1.30) { key = "high";  label = "Overpaying"; }
    else                    { key = "bad";   label = "Getting screwed"; }

    // Quality context nudge: a high price on a low-quality bottle is worse.
    const lines = [];
    const basisTxt = mv.basis === "secondary"
      ? "typical secondary-market value"
      : "typical retail";
    lines.push("Real market value: <b>" + money(mv.value) + "</b> (" + basisTxt + ").");
    if (mv.low != null && mv.high != null && mv.low !== mv.high) {
      lines.push("Normal range: " + money(mv.low) + "–" + money(mv.high) + ".");
    }
    const diff = asking - mv.value;
    if (Math.abs(diff) >= 1) {
      lines.push((diff > 0 ? "You'd pay <b>" + money(diff) + " over</b> market"
                           : "You'd save <b>" + money(-diff) + "</b> vs market")
                 + " (" + Math.round((ratio - 1) * 100) + "%).");
    }
    if (mv.basis === "secondary" && b.msrp && asking > b.msrp) {
      lines.push("MSRP is " + money(b.msrp) + ", but this bottle is allocated — nobody finds it that cheap.");
    }
    if (overMsrp != null && mv.basis === "retail" && asking > b.msrp * 1.15) {
      lines.push("That's " + Math.round(overMsrp * 100) + "% over the " + money(b.msrp) + " MSRP.");
    }
    lines.push("Quality: <b>" + b.quality + "/100</b> — " + qualityWord(b.quality)
               + ". Quality-per-dollar at this price: " + (b.quality / asking).toFixed(2) + " pts/$.");

    return { key: key, label: label, lines: lines, market: mv.value, ratio: ratio };
  }

  function qualityWord(q) {
    if (q >= 95) return "world-class";
    if (q >= 90) return "excellent";
    if (q >= 85) return "very good";
    if (q >= 80) return "solid";
    if (q >= 75) return "average";
    if (q >= 70) return "below average";
    return "weak";
  }

  function money(n) {
    if (n == null) return "—";
    const r = Math.round(n);
    return "$" + r.toLocaleString("en-US");
  }

  /* --- Trade balancer: total secondary/market value of a list --- */
  function tradeValue(bottles) {
    let total = 0;
    bottles.forEach(function (b) { total += marketValue(b).value; });
    return total;
  }

  /* expose */
  window.ValueEngine = {
    init: buildCategoryStats,
    marketValue: marketValue,
    secondaryMid: secondaryMid,
    retailMid: retailMid,
    valueScore: valueScore,
    valueVerdict: valueVerdict,
    dealCheck: dealCheck,
    tradeValue: tradeValue,
    qualityWord: qualityWord,
    money: money,
    data: DATA
  };
})();
