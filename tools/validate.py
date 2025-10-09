"""Lightweight data validation for the NYC rent pipeline."""

import pandas as pd

SOURCE = "data/nyc_median_rent.csv"


def main() -> None:
    """Run a handful of schema and range assertions."""

    df = pd.read_csv(SOURCE, comment="#")

    expected_columns = {
        "year",
        "borough",
        "median_rent",
        "median_income",
        "subway_access_score",
        "air_quality_index",
    }
    missing = expected_columns.difference(df.columns)
    if missing:
        raise ValueError(f"Missing expected columns: {sorted(missing)}")

    if not df["median_rent"].between(200, 10_000).all():
        raise ValueError("median_rent column falls outside sanity bounds")
    if not df["median_income"].between(10_000, 300_000).all():
        raise ValueError("median_income column falls outside sanity bounds")

    duplicates = df.groupby(["borough", "year"]).size()
    if (duplicates > 1).any():
        raise ValueError("Duplicate borough-year combinations detected")

    print("[validate] basic checks OK")

    import json
    import pathlib

    for path_str in ["data/derived_summary.json", "data/viz_payload.json"]:
        path_obj = pathlib.Path(path_str)
        if path_obj.exists():
            json.loads(path_obj.read_text(encoding="utf-8"))

    print("[validate] json round-trip OK")


if __name__ == "__main__":
    main()
