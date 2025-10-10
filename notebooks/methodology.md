# InsightLab: NYC Housing Dynamics — Methodology Notes

## Source citations
- NYC Department of Housing Preservation & Development (HPD), *Housing Maintenance Code Violations & Housing New York Units by Building* — used for borough-level rent medians (historic exports, 2010–2024). <https://data.cityofnewyork.us/Housing-Development/Housing-New-York-Units-by-Building/hg8x-zxpr>
- U.S. Census Bureau, *American Community Survey (ACS) 1-year estimates* — borough median household income by year. <https://data.census.gov/>
- Metropolitan Transportation Authority (MTA), *Stations and Ridership* — basis for subway access scoring. <https://data.ny.gov/Transportation/Subway-Stations/arq3-7z49>
- NYC Department of Health and Mental Hygiene (DOHMH), *Air Quality Tracking* — borough AQI measures. <https://a816-dohbesp.nyc.gov/IndicatorPublic/>

The CSV included in this repository is a replicated snapshot calibrated to the ranges and dynamics shown in the above sources so that the project runs offline for demonstration purposes.

## Replication steps
1. Established 2010 baseline rents and incomes from HPD and ACS tables, then fitted compound annual growth trajectories aligned with historic observations. Manual adjustments were applied to reflect known events (e.g., post-2012 Brooklyn surge, 2020 rent dip).
2. Derived subway access scores by normalising station counts per square mile and adjusting for service frequency, ensuring Manhattan > Brooklyn > Queens > Bronx > Staten Island ordering with subtle shifts across years.
3. Modeled air quality indices to trend downward (improving) with a temporary 2020 reversal, mirroring DOHMH AQI series.
4. Validated the resulting medians against public press releases to ensure plausibility, then copied the curated rows into `/js/embeddedData.js` so local file access (file://) still renders charts without triggering fetch/CORS issues. The derived pipeline now also emits `data/derived_summary.json` and `data/viz_payload.json`, which `js/dataLoader.js` consumes (with graceful fallback to the embedded bundle).

## Analytical formulas
- **Pearson correlation** between variables \(x\) and \(y\):
  \[
  r_{xy} = \frac{\sum_{i=1}^n (x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum_{i=1}^n (x_i - \bar{x})^2} \sqrt{\sum_{i=1}^n (y_i - \bar{y})^2}}
  \]
- **Ordinary Least Squares (OLS)** coefficients for the model \(y = X\beta + \epsilon\):
  \[
  \hat{\beta} = (X^T X)^{-1} X^T y
  \]
  Residual standard deviation: \( \sigma = \sqrt{\frac{\sum (y_i - \hat{y}_i)^2}{n - p}} \) where \(p\) is the number of predictors including the intercept.
  \(R^2 = 1 - \frac{\sum (y_i - \hat{y}_i)^2}{\sum (y_i - \bar{y})^2}\).

## Risk & bias considerations
- Borough medians mask intra-borough heterogeneity (e.g., north vs south Brooklyn). Add neighbourhood granularity for tactical decisions.
- Subway access and air quality are composite proxies; they should be replaced with station-level ridership and measured particulate data in production.
- COVID-19 impacts in 2020–2021 generated sharp anomalies; regression residuals should be stress-tested with scenario analysis.
- Transit correlation is summarised with \(r^2\) callouts (e.g., ~0.41 variance explained) to convey strength, but correlation ≠ causation; treat as directional insight.
- Replicated dataset values cannot substitute for live compliance reporting or investment-grade due diligence.
