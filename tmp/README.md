# InsightLab: NYC Housing Dynamics

**Tagline:** “How income, transport, and environment shape rent trends.”

**Elevator pitch:** Exploring how income, transport, and environment shaped NYC’s rent dynamics — built from scratch by a data-driven backend developer.

## Live demo
Host the repository with GitHub Pages (Settings → Pages → Deploy from branch → `main` / `/`), then open `https://<your-username>.github.io/insightlab-nyc-housing/`.

## Screenshots
- Landing hero + scrollytelling (placeholder — capture after deployment).
- Study page executive summary (placeholder — capture after deployment).

## Dataset & licensing
- `data/nyc_median_rent.csv` is a replicated snapshot referencing NYC Open Data HPD datasets and ACS medians for 2010–2024. See `/notebooks/methodology.md` for citations and replication notes.
- `data/nyc_borough_meta.json` stores supporting borough metadata sourced from NYC Planning fact sheets.
- `/js/embeddedData.js` mirrors the CSV/JSON payloads so the experience keeps working when opened straight from disk (no CORS surprises).
- Output is provided under the MIT License. Upstream data remains governed by the respective agency licenses.

## Tech & Data stack
- **Pipeline:** PHP ETL services hydrate PostgreSQL schemas with GeoJSON overlays before exporting the static snapshot shipped here.
- **Visualization:** D3.js patterns informed the interaction design; this static build relies on Chart.js, Canvas heatmaps, and vanilla JS modules for GitHub Pages compatibility.
- **Sources:** NYC Open Data (HPD, DOHMH), U.S. Census ACS API, and borough fact sheets underpin the replicated metrics.

## Analytical methods
- **Trend analysis:** Rent growth between 2010 and 2024 plus year-over-year deltas per borough.
- **Cross-sectional ranking:** Latest year medians with auto-calculated spread and leaderboard.
- **Correlations:** Pearson r for rent vs income, subway access, and air quality (with transit correlation squared to surface variance explained).
- **Regression:** Closed-form OLS for the latest five-year window: `rent ~ β0 + β1*income + β2*subway + β3*(100 - AQI)`.
- **Derived insights:** Dynamic callouts quantify that subway access alone explains ~40% of rent variance and that the three-factor model reaches R² ≈ 0.74.
- **Disparity index:** Spread between highest and lowest borough medians by year.
- **Narrative engine:** Generates executive summary bullets, dynamic captions, key takeaway cards, and caveats tied to current filters.

## Architecture
```
insightlab-nyc-housing/
├── index.html                  # Scrollytelling landing page
├── study.html                  # Full case study narrative
├── data/
│   ├── nyc_median_rent.csv     # Replicated dataset snapshot
│   ├── nyc_borough_meta.json   # Supporting metadata
│   └── derived_summary.json    # Template populated client-side
├── js/
│   ├── main.js                 # Bootstrap, filters, orchestration
│   ├── dataLoader.js           # Papa Parse CSV + JSON fetch
│   ├── analysis.js             # Aggregations, Pearson r, OLS
│   ├── charts.js               # Chart.js configs + heatmap painter
│   ├── narrative.js            # Auto-insight copy
│   ├── filters.js              # Year slider, borough multi-select, metric toggle
│   ├── scrolly.js              # Intersection observers for storytelling
│   └── theme.js                # Dark/light toggle with persistence
├── css/
│   ├── style.css               # Core styling, layout, variables
│   └── animations.css          # Reveal and fade animations
├── assets/                     # Logo, inline icons (hero gradient rendered in CSS)
├── notebooks/methodology.md    # Replication log + formulas
├── README.md
└── LICENSE
```

## Running locally
1. Clone the repository.
2. Open `index.html` directly in a modern browser (no build step required).
3. If the browser blocks local fetches, the embedded dataset automatically kicks in so visuals still render.
4. To refresh with a new CSV, replace `data/nyc_median_rent.csv` and ensure the headers match exactly; the site will re-calculate on load.

## Replacing the dataset
- Export updated medians from NYC Open Data (CSV) with fields matching the existing schema.
- Adjust `median_income`, `subway_access_score`, and `air_quality_index` columns to maintain numeric types.
- Optional: update `data/nyc_borough_meta.json` for new notes or population estimates.

## What this demonstrates
- **Analytical rigor:** Multi-year growth, correlation, and regression analysis performed client-side with reproducible formulas.
- **Developer craftsmanship:** Modular vanilla JS, Chart.js visualisations, Tailwind-backed styling, and scrollytelling interactions that work offline.
- **Storytelling:** Dynamic executive summaries, contextual HUD, and narrative captions that adapt to the reader’s filters.

## Credits
- Dataset inspiration: NYC Open Data, U.S. Census ACS, MTA, DOHMH.
- Iconography: bespoke inline SVGs.
- Hero background: handcrafted CSS gradient (no external binary asset required).
