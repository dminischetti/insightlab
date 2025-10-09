-- NOTE: This file is illustrative. CI runs tools/run_sql.py using DuckDB's Python API.
-- The CLI meta-commands (.mode/.output) aren't used in CI.
-- DuckDB snapshot queries for reproducible tabular outputs.
.mode csv
.headers on

.output data/duckdb_outputs/median_rent_yoy.csv
WITH base AS (
  SELECT year, borough, CAST(median_rent AS DOUBLE) AS rent
  FROM read_csv_auto('data/nyc_median_rent.csv', header=True)
),
yoy AS (
  SELECT
    year,
    borough,
    rent,
    100.0 * (rent - LAG(rent) OVER (PARTITION BY borough ORDER BY year)) /
      NULLIF(LAG(rent) OVER (PARTITION BY borough ORDER BY year), 0) AS yoy_pct
  FROM base
)
SELECT * FROM yoy ORDER BY borough, year;
.output stdout

.output data/duckdb_outputs/disparity_by_year.csv
SELECT
  year,
  MAX(median_rent) AS max_rent,
  MIN(median_rent) AS min_rent,
  MAX(median_rent) - MIN(median_rent) AS spread
FROM read_csv_auto('data/nyc_median_rent.csv', header=True)
GROUP BY year
ORDER BY year;
.output stdout

.output data/duckdb_outputs/latest_leaderboard.csv
WITH base AS (
  SELECT * FROM read_csv_auto('data/nyc_median_rent.csv', header=True)
),
latest AS (
  SELECT MAX(year) AS latest_year FROM base
)
SELECT
  b.borough,
  b.year,
  b.median_rent,
  b.median_income,
  b.subway_access_score,
  b.air_quality_index
FROM base b, latest
WHERE b.year = latest.latest_year
ORDER BY b.median_rent DESC;
.output stdout
