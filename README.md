# 🥃 Whiskey or Die

**A pocket price-vs-quality scanner for liquor stores.** Standing in the aisle staring at a bottle, wondering if it's a smart buy or a rip-off? Pull this up, find the bottle (or punch in the price), and get an instant verdict — calibrated for bourbon and Scotch, but covering nearly 500 bottles across 18 categories of spirits and wine.

Built as a **dependency-free mobile web app** — no build step, no server, no accounts. Open `index.html` on your phone and go.

---

## What it does

| Tab | What it's for |
|-----|---------------|
| 🔎 **Browse** | Search/filter the whole database. Every bottle gets a 0–100 **quality score**, a real-world **market price**, and a **value verdict** (Great Value → Overpriced). Sort by best value, highest quality, or price. Bourbon-first ordering. |
| 💸 **Deal Check** | The in-store killer feature. Pick a bottle, type the **shelf price**, and get a verdict: *STEAL · Good deal · Fair · Overpaying · Getting screwed* — with the math (vs market, vs MSRP, quality-per-dollar). |
| 🤝 **Trade** | Multi-bottle **trade balancer** for aftermarket deals. Stack several bottles on each side, and it totals the secondary-market value and tells you **who's ahead and by how much**. Build "3 bottles for 1" trades and instantly see if the deal's in your favor. |
| 📓 **My Log** | Log real prices you spot (FB groups, auctions, shelves). Tracks running **averages and ranges per bottle** so you build your own legal, ban-proof record of the aftermarket. Export to CSV. |

---

## How the scoring works

- **Quality (0–100):** blended from expert critics (Whisky Advocate, Wine Spectator/Enthusiast, Tequila Matchmaker) and community consensus (Distiller, Vivino, r/bourbon). Calibrated honestly — bottom-shelf mixers score in the 70s, world-class bottles in the mid-90s.
- **Market value:** what it *actually* costs to acquire. For allocated bottles (Pappy, BTAC, Weller 12…), MSRP is fiction — the engine uses the **secondary-market value** instead. For everything else it uses real street/shelf price.
- **Value score:** quality-per-dollar ranked **within each category** (a $60 bourbon and a $60 wine aren't judged on the same curve), blended with an absolute quality floor so a cheap mediocre bottle can't out-rank a genuinely great one.
- **Deal verdict:** your asking price ÷ real market value, with quality context.

**Calibrated to Texas retail pricing, knowledge as of 2025.** These are curated *reference estimates* — always sanity-check against the actual shelf and your local market.

---

## The database (488 bottles)

Bourbon-focused, with Scotch as the second deep pillar:

| Category | Count | | Category | Count |
|---|---|---|---|---|
| Bourbon | 86 | | Japanese Whisky | 19 |
| Wine | 71 | | Vodka | 15 |
| Scotch | 67 | | Gin | 14 |
| Tequila | 46 | | Mezcal | 12 |
| Irish Whiskey | 26 | | Canadian Whisky | 10 |
| Rum | 24 | | World Whisky | 10 |
| Rye Whiskey | 23 | | Tennessee Whiskey | 8 |
| Liqueur | 23 | | Brandy | 8 |
| Cognac | 21 | | American Whiskey | 5 |

From bottom-shelf daily drinkers (Evan Williams, Mellow Corn) through the allocated unicorns (Pappy 23, George T. Stagg, William Larue Weller, BTAC ryes, Springbank). Includes a **Texas distillery section** (Garrison Brothers, Balcones, Still Austin). No beer, by design.

---

## Aftermarket / trading — the honest approach

You asked about wiring this directly into Facebook trading groups to source live prices. **That path is a trap, so the tool deliberately doesn't do it:**

- Facebook groups sit behind a login wall with aggressive bot detection — automated scraping gets your real account **banned**, cutting you off from the very groups you trade in.
- It **violates Facebook's (and most secondary sites') Terms of Service**, and **secondary alcohol sales are illegal in many states**, including restrictions in Texas.
- The data is unstructured ("PM me," photos, comments) and unreliable for automation anyway.

Instead, the tool gives you the trading edge the *legal* way:

1. **Curated secondary-value dataset** baked into every allocated bottle — the numbers that actually drive your trade math.
2. **Trade balancer** to value multi-bottle swaps instantly.
3. **My Log** for fast manual entry of prices you personally observe, building your own running market record.
4. **Legitimate resources** to source real aftermarket data (below).

### Legit aftermarket price resources

- **BAXUS** — licensed peer-to-peer whiskey marketplace & auctions (app)
- **Unicorn Auctions** — vetted secondary whiskey auctions
- **Whisky Auctioneer / Whiskey Hammer** — major UK auction houses with public past-results
- **BottleBlueBook / Bottle Spot** — secondary price reference data
- Local **whiskey club** Discords and in-person bottle shares (compliant, relationship-driven)

> This app helps you *evaluate* prices. It does **not** facilitate sales, and nothing here is legal advice — know your state's laws before trading.

---

## Running it

It's static. Any of these work:

```bash
# Just open the file
open index.html

# …or serve it (better for phones on your network)
python3 -m http.server 8000   # then visit http://<your-ip>:8000
```

**Host it free** on GitHub Pages: repo Settings → Pages → deploy from branch → `/root`. Then "Add to Home Screen" on your phone for an app-like icon.

### Project structure

```
index.html              # app shell + tabs
css/styles.css          # mobile-first dark theme
js/value-engine.js      # scoring: market value, value score, deal/trade math
js/app.js               # UI: browse, deal check, trade balancer, log
data/
  bourbon.js  rye.js  scotch.js          # hand-curated core
  agave.js  rum.js  gin-vodka.js
  world-whisky.js  brandy-liqueur.js  wine.js
```

Each `data/*.js` pushes plain objects into `window.BOTTLE_DATA` — easy to extend. Adding a bottle = one object; the engine scores it automatically.

---

*Curated reference estimates, calibrated to Texas retail (2025). Verify against the shelf. Drink responsibly.*
