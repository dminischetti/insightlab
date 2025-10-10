# InsightLab: NYC Housing Dynamics

[![Build & Deploy (Pages)](https://github.com/<user>/<repo>/actions/workflows/build-and-deploy.yml/badge.svg)](https://github.com/<user>/<repo>/actions/workflows/build-and-deploy.yml)
[![Nightly Refresh](https://github.com/<user>/<repo>/actions/workflows/nightly-refresh.yml/badge.svg)](https://github.com/<user>/<repo>/actions/workflows/nightly-refresh.yml)

**Tagline:** “How income, transport, and environment shape rent trends.”  
**Elevator pitch:** Exploring how income, transport, and environment shaped NYC’s rent dynamics — built from scratch by a data-driven backend developer.

## Live demo
Host the repository with GitHub Pages (Settings → Pages → Deploy from branch → `main` / `/`), then open `https://<your-username>.github.io/insightlab/`.

## Reproducibility workflow
A minimal Python + DuckDB toolchain regenerates all derived assets before deployment.

| Command | Description |
| --- | --- |
| `python -m pip install -r requirements.txt` | Install the pinned analysis stack (pandas, numpy, scipy, statsmodels, duckdb, matplotlib, seaborn). |
| `make derive` | Build `data/derived_summary.json`, `data/viz_payload.json`, and `appendix/ols_report.md`. |
| `make validate` | Run schema/range assertions on `data/nyc_median_rent.csv`. |
| `make sql` | Run `tools/run_sql.py` (DuckDB Python API) to refresh `data/duckdb_outputs/*.csv`. |
| `make figures` | Produce regression diagnostics in `appendix/figures/*.png`. |
| `make all` | Run derive → validate → sql → figures in one shot. |
| `make site` | Bundle the static site (including generated artifacts) into `./site/` for GitHub Pages. |
| `make clean` | Remove build artifacts (`site/`, `data/duckdb_outputs/`, `appendix/figures/`). |

The CI workflows (`.github/workflows/*.yml`) call `make all` followed by `make site`, guaranteeing the live site always reflects the latest pipeline output.

## Data dictionary
| Field | Type | Description |
| --- | --- | --- |
| `year` | int | Calendar year of the observation (2010–2024). |
| `borough` | string | NYC borough label. |
| `median_rent` | float | Monthly median asking rent in USD. |
| `median_income` | float | Annual median household income in USD. |
| `subway_access_score` | float | 0–100 composite index summarising subway proximity/frequency. |
| `air_quality_index` | float | NYC DOHMH AQI analogue (lower is cleaner air). |

Supporting metadata lives in `data/nyc_borough_meta.json` and powers narrative/tooltips. See `notebooks/methodology.md` for replication and sourcing notes.

## Methods appendix & diagnostics
- `appendix/ols_report.md` — markdown report of OLS coefficients (β, SE, t, p, 95% CI), fit statistics, VIF, and Breusch–Pagan test.
- `appendix/figures/residuals.png` — residuals vs fitted.
- `appendix/figures/qq.png` — QQ plot of residuals.
- `appendix/figures/influence.png` — leverage vs Cook’s distance.
- `appendix/figures/corr_matrix.png` — correlation heatmap.

All figures are generated via `tools/figures.py` and automatically packaged into the static site.

## SQL snapshots
`tools/run_sql.py` (and the illustrative `sql/examples.sql`) execute three DuckDB queries that write CSV snapshots to `data/duckdb_outputs/`:
- `median_rent_yoy.csv` — year-over-year rent deltas by borough.
- `disparity_by_year.csv` — annual max/min rent spread summary.
- `latest_leaderboard.csv` — latest-year rent leaderboard with supporting drivers.

These tables provide auditable checkpoints for BI/warehouse consumers.

## Output artifacts shipped with the site
- `data/derived_summary.json` — correlations, regression diagnostics, disparity index, generated headlines.
- `data/viz_payload.json` — pre-aggregated series powering charts when CSV fetches are unavailable.
- `data/duckdb_outputs/*.csv` — DuckDB snapshots (`median_rent_yoy`, `disparity_by_year`, `latest_leaderboard`).
- `appendix/ols_report.md` & `appendix/figures/*.png` — linked directly from every chart caption.

The front-end prefers these JSON payloads but gracefully falls back to the embedded CSV snapshot for offline use.

## Quickstart (local)
1. `python -m pip install -r requirements.txt`
2. `make site`
3. Open `site/index.html` (and optionally `site/study.html`) in a modern browser.

If you only need the exploratory view, you can still open `index.html` directly; the embedded dataset mirrors the pipeline outputs for offline scenarios.

## Architecture
```
insightlab/
├── index.html                  # Scrollytelling landing page
├── study.html                  # Full case study narrative
├── data/
│   ├── nyc_median_rent.csv     # Replicated dataset snapshot
│   ├── nyc_borough_meta.json   # Supporting metadata
│   ├── derived_summary.json    # Pipeline-derived summary payload
│   └── viz_payload.json        # Chart-ready series emitted by derive.py
├── data/duckdb_outputs/        # DuckDB CSV snapshots (make sql)
├── tools/
│   ├── derive.py               # Builds derived JSON + OLS appendix
│   ├── validate.py             # Schema/range checks
│   ├── run_sql.py              # DuckDB-powered tabular snapshots
│   └── figures.py              # Diagnostic matplotlib/seaborn plots
├── sql/examples.sql            # DuckDB queries executed in CI/local runs
├── appendix/
│   ├── ols_report.md           # Markdown appendix (regenerated)
│   └── figures/                # Residual, QQ, leverage, correlation visuals
├── js/                         # Client-side orchestration (analysis, charts, filters, scrollytelling)
├── css/                        # Styling + animation layers
├── assets/                     # Logos and icons
├── notebooks/methodology.md    # Replication log & citations
├── Makefile                    # Reproducible pipeline entry points
└── requirements.txt            # Python dependencies for the toolchain
```

## CI/CD
- **Build & Deploy (Pages):** triggers on every push to `main` and publishes `site/` to GitHub Pages.
- **Nightly Refresh:** runs weekly (Sunday 03:00 UTC) to rerun the pipeline against the latest CSV, refresh derived assets, and redeploy.

Both workflows rely on the `make` targets documented above so local and remote executions stay in lockstep.

## Dataset & licensing
- `data/nyc_median_rent.csv` is a replicated snapshot referencing NYC Open Data HPD datasets and ACS medians for 2010–2024.
- `data/nyc_borough_meta.json` stores supporting borough metadata sourced from NYC Planning fact sheets.
- Output is provided under the MIT License. Upstream data remains governed by the respective agency licenses.

## What this demonstrates
- **Analytical rigor:** Multi-year growth, correlation, regression, and diagnostics refreshed through a reproducible Python + DuckDB pipeline.
- **Developer craftsmanship:** Modular vanilla JS, Chart.js visualisations, Canvas heatmap, and a CI/CD path to GitHub Pages.
- **Storytelling:** Dynamic executive summaries, contextual HUD, chart captions, and a linked diagnostics appendix for credibility.

## Credits
- Dataset inspiration: NYC Open Data, U.S. Census ACS, MTA, DOHMH.
- Iconography: bespoke inline SVGs.
- Hero background: handcrafted CSS gradient (no external binary asset required).
