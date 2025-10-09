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

.output data/duckdb_outputs/annual_rent_spread.csv
WITH ordered AS (
  SELECT year, borough, median_rent,
         ROW_NUMBER() OVER (PARTITION BY year ORDER BY median_rent DESC) AS rent_rank
  FROM read_csv_auto('data/nyc_median_rent.csv', header=True)
)
SELECT
  year,
  MAX(median_rent) AS max_rent,
  MIN(median_rent) AS min_rent,
  MAX(median_rent) - MIN(median_rent) AS spread
FROM ordered
GROUP BY year
ORDER BY year;
.output stdout

.output data/duckdb_outputs/top_bottom_latest_year.csv
WITH base AS (
  SELECT * FROM read_csv_auto('data/nyc_median_rent.csv', header=True)
),
latest AS (
  SELECT MAX(year) AS latest_year FROM base
),
ranked AS (
  SELECT
    b.year,
    b.borough,
    b.median_rent,
    b.median_income,
    ROW_NUMBER() OVER (ORDER BY b.median_rent DESC) AS rent_rank,
    ROW_NUMBER() OVER (ORDER BY b.median_rent ASC) AS rent_rank_bottom,
    (SELECT latest_year FROM latest) AS latest_year
  FROM base b
  WHERE b.year = (SELECT latest_year FROM latest)
)
SELECT
  latest_year AS year,
  borough,
  median_rent,
  median_income,
  CASE WHEN rent_rank <= 3 THEN 'top' ELSE 'bottom' END AS bucket,
  rent_rank,
  rent_rank_bottom
FROM ranked
ORDER BY bucket, rent_rank;
.output stdout
