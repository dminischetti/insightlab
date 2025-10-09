"""Execute DuckDB SQL over the CSV and emit CSV outputs (no CLI required)."""

from pathlib import Path

import duckdb
import pandas as pd

SRC = Path("data/nyc_median_rent.csv")
OUT_DIR = Path("data/duckdb_outputs")
OUT_DIR.mkdir(parents=True, exist_ok=True)

def main() -> None:
    if not SRC.exists():
        raise FileNotFoundError(f"Missing source CSV at {SRC}")

    con = duckdb.connect()
    # Register the CSV as a DuckDB view (no need to copy to DB)
    con.execute(f"""
        CREATE OR REPLACE VIEW rents AS
        SELECT
            CAST(year AS INTEGER) AS year,
            borough::VARCHAR AS borough,
            CAST(median_rent AS DOUBLE) AS median_rent,
            CAST(median_income AS DOUBLE) AS median_income,
            CAST(subway_access_score AS DOUBLE) AS subway_access_score,
            CAST(air_quality_index AS DOUBLE) AS air_quality_index
        FROM read_csv_auto('{SRC.as_posix()}', header=True);
    """)

    # 1) Median rent YoY %
    yoy_df: pd.DataFrame = con.execute("""
        WITH base AS (
          SELECT year, borough, median_rent AS rent
          FROM rents
        )
        SELECT
          year,
          borough,
          rent,
          100.0 * (rent - LAG(rent) OVER (PARTITION BY borough ORDER BY year))
                / NULLIF(LAG(rent) OVER (PARTITION BY borough ORDER BY year), 0) AS yoy_pct
        FROM base
        ORDER BY borough, year;
    """).df()
    yoy_df.to_csv(OUT_DIR / "median_rent_yoy.csv", index=False)

    # 2) Borough disparity per year (max/min/spread)
    spread_df: pd.DataFrame = con.execute("""
        SELECT
          year,
          MAX(median_rent) AS max_rent,
          MIN(median_rent) AS min_rent,
          MAX(median_rent) - MIN(median_rent) AS spread
        FROM rents
        GROUP BY year
        ORDER BY year;
    """).df()
    spread_df.to_csv(OUT_DIR / "disparity_by_year.csv", index=False)

    # 3) Latest-year leaderboard (nice for README/table)
    leaderboard_df: pd.DataFrame = con.execute("""
        WITH latest AS (
          SELECT MAX(year) AS y FROM rents
        )
        SELECT r.borough, r.year, r.median_rent, r.median_income,
               r.subway_access_score, r.air_quality_index
        FROM rents r, latest
        WHERE r.year = latest.y
        ORDER BY r.median_rent DESC;
    """).df()
    leaderboard_df.to_csv(OUT_DIR / "latest_leaderboard.csv", index=False)

    print("[sql] wrote:",
          (OUT_DIR / "median_rent_yoy.csv").as_posix(),
          (OUT_DIR / "disparity_by_year.csv").as_posix(),
          (OUT_DIR / "latest_leaderboard.csv").as_posix())

if __name__ == "__main__":
    main()
