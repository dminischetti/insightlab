"""Build derived analytics artifacts for the NYC rent study."""

from __future__ import annotations

import datetime as _dt
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.stats.diagnostic import het_breuschpagan
from statsmodels.stats.outliers_influence import variance_inflation_factor


def _to_native(obj):
    """Recursively convert numpy/pandas/python objects to JSON-serializable natives."""

    import numpy as _np
    import pandas as _pd

    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
    if isinstance(obj, (_np.integer,)):
        return int(obj)
    if isinstance(obj, (_np.floating,)):
        return float(obj)
    if isinstance(obj, (_np.bool_,)):
        return bool(obj)
    if isinstance(obj, (_np.ndarray,)):
        return [_to_native(x) for x in obj.tolist()]
    if isinstance(obj, (_pd.Timestamp, _dt.datetime, _dt.date)):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {str(k): _to_native(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [_to_native(x) for x in obj]
    return str(obj)

DATA = Path("data/nyc_median_rent.csv")
OUT_DERIVED = Path("data/derived_summary.json")
OUT_PAYLOAD = Path("data/viz_payload.json")
APPENDIX_DIR = Path("appendix")
OLS_REPORT = APPENDIX_DIR / "ols_report.md"


@dataclass
class RegressionSnapshot:
    """Container for regression diagnostics written to JSON/Markdown."""

    coefficients: Dict[str, float]
    stderr: Dict[str, float]
    tvalues: Dict[str, float]
    pvalues: Dict[str, float]
    conf_int: Dict[str, Dict[str, float]]
    r2: float
    adj_r2: float
    residual_std: float
    nobs: int
    vif: Dict[str, float]
    breusch_pagan: Dict[str, float]
    window_years: List[int]

    def to_payload(self) -> Dict[str, object]:
        """Translate attribute names into JSON-friendly keys."""

        return {
            "coefficients": self.coefficients,
            "stderr": self.stderr,
            "tvalues": self.tvalues,
            "pvalues": self.pvalues,
            "confidence_intervals": self.conf_int,
            "r2": self.r2,
            "adj_r2": self.adj_r2,
            "residualStd": self.residual_std,
            "nobs": self.nobs,
            "vif": self.vif,
            "breusch_pagan": self.breusch_pagan,
            "window_years": self.window_years,
        }


def load_data() -> pd.DataFrame:
    """Read the CSV, respecting the leading comment row."""

    if not DATA.exists():
        raise FileNotFoundError(f"Missing source CSV at {DATA}")
    df = pd.read_csv(DATA, comment="#")
    df["year"] = df["year"].astype(int)
    return df.sort_values(["borough", "year"])  # deterministic ordering


def compute_growth(df: pd.DataFrame, value_col: str) -> Dict[str, Dict[str, float]]:
    """Return growth metrics from first to last year for the given column."""

    results: Dict[str, Dict[str, float]] = {}
    for borough, group in df.groupby("borough"):
        group = group.sort_values("year")
        start, end = group.iloc[0], group.iloc[-1]
        start_value = float(start[value_col])
        end_value = float(end[value_col])
        absolute = end_value - start_value
        pct = (absolute / start_value * 100) if start_value else None
        results[borough] = {
            "startYear": int(start["year"]),
            "endYear": int(end["year"]),
            "startValue": start_value,
            "endValue": end_value,
            "absolute": absolute,
            "pct": pct,
        }
    return results


def compute_yoy(df: pd.DataFrame) -> Dict[str, List[Dict[str, float]]]:
    """Compute year-over-year rent change per borough."""

    yoy: Dict[str, List[Dict[str, float]]] = {}
    for borough, group in df.groupby("borough"):
        group = group.sort_values("year")
        yoy_entries: List[Dict[str, float]] = []
        prior_rent = None
        for _, row in group.iterrows():
            current_rent = float(row["median_rent"])
            change_pct = (
                (current_rent - prior_rent) / prior_rent * 100
                if prior_rent is not None and prior_rent != 0
                else None
            )
            yoy_entries.append(
                {
                    "year": int(row["year"]),
                    "rent": current_rent,
                    "pct": change_pct,
                }
            )
            prior_rent = current_rent
        yoy[borough] = yoy_entries
    return yoy


def compute_disparity(df: pd.DataFrame) -> Dict[str, Dict[str, float]]:
    """Compute min/max rent spreads per year."""

    disparity: Dict[str, Dict[str, float]] = {}
    for year, group in df.groupby("year"):
        rents = group["median_rent"].astype(float)
        max_rent = float(rents.max())
        min_rent = float(rents.min())
        disparity[str(int(year))] = {
            "max": max_rent,
            "min": min_rent,
            "spread": max_rent - min_rent,
        }
    return disparity


def compute_correlations(df: pd.DataFrame) -> Dict[str, float]:
    """Return Pearson correlations between rent and each feature."""

    return {
        "rent_income": float(df["median_rent"].corr(df["median_income"])),
        "rent_subway": float(df["median_rent"].corr(df["subway_access_score"])),
        "rent_air": float(df["median_rent"].corr(df["air_quality_index"])),
    }


def compute_regression(df: pd.DataFrame, latest_year: int) -> RegressionSnapshot:
    """Fit a 5-year OLS window and collect diagnostics."""

    window_years = [int(year) for year in sorted(df["year"].unique()) if int(year) >= latest_year - 4]
    window_df = df[df["year"].isin(window_years)].copy()
    if window_df.empty:
        raise ValueError("Insufficient data for regression window")

    features = pd.DataFrame(
        {
            "income": window_df["median_income"].astype(float),
            "subway": window_df["subway_access_score"].astype(float),
            "inverseAir": 100 - window_df["air_quality_index"].astype(float),
        }
    )
    X = sm.add_constant(features, has_constant="add")
    y = window_df["median_rent"].astype(float)
    model = sm.OLS(y, X).fit()

    coef_map = {
        "const": "intercept",
        "income": "income",
        "subway": "subway",
        "inverseAir": "inverseAir",
    }
    coefficients = {coef_map[k]: float(v) for k, v in model.params.items()}
    stderr = {coef_map[k]: float(v) for k, v in model.bse.items()}
    tvalues = {coef_map[k]: float(v) for k, v in model.tvalues.items()}
    pvalues = {coef_map[k]: float(v) for k, v in model.pvalues.items()}
    ci = model.conf_int(alpha=0.05)
    conf_int = {
        coef_map[index]: {"lower": float(bounds[0]), "upper": float(bounds[1])}
        for index, bounds in ci.iterrows()
    }

    vif = {
        column: float(variance_inflation_factor(features.values, idx))
        for idx, column in enumerate(features.columns)
    }
    lm_stat, lm_pvalue, f_stat, f_pvalue = het_breuschpagan(model.resid, model.model.exog)

    return RegressionSnapshot(
        coefficients=coefficients,
        stderr=stderr,
        tvalues=tvalues,
        pvalues=pvalues,
        conf_int=conf_int,
        r2=float(model.rsquared),
        adj_r2=float(model.rsquared_adj),
        residual_std=float(np.sqrt(model.scale)),
        nobs=int(model.nobs),
        vif=vif,
        breusch_pagan={
            "lm_stat": float(lm_stat),
            "lm_pvalue": float(lm_pvalue),
            "f_stat": float(f_stat),
            "f_pvalue": float(f_pvalue),
        },
        window_years=window_years,
    )


def latest_snapshot(df: pd.DataFrame, latest_year: int) -> List[Dict[str, float]]:
    """Return the latest-year borough ranking."""

    rows = (
        df[df["year"] == latest_year][
            ["borough", "median_rent", "median_income", "subway_access_score", "air_quality_index", "year"]
        ]
        .copy()
    )
    rows.sort_values("median_rent", ascending=False, inplace=True)
    return [
        {
            "borough": str(row.borough),
            "median_rent": float(row.median_rent),
            "median_income": float(row.median_income),
            "subway_access_score": float(row.subway_access_score),
            "air_quality_index": float(row.air_quality_index),
            "year": int(row.year),
        }
        for row in rows.itertuples(index=False)
    ]


def generate_headlines(
    growth: Dict[str, Dict[str, float]],
    latest_rows: List[Dict[str, float]],
    correlations: Dict[str, float],
    regression: RegressionSnapshot,
    disparity: Dict[str, Dict[str, float]],
) -> List[Dict[str, object]]:
    """Mirror the narrative hooks used on the site."""

    if not growth or not latest_rows:
        return []

    eligible_growth = [
        {"borough": borough, **values}
        for borough, values in growth.items()
        if values.get("pct") is not None
    ]
    if not eligible_growth:
        return []

    strongest_growth = max(eligible_growth, key=lambda item: item["pct"])
    top_row = latest_rows[0]
    bottom_row = latest_rows[-1]

    latest_year = top_row.get("year")
    latest_spread = disparity.get(str(latest_year), {}) if disparity else {}
    top_vs_bottom = top_row["median_rent"] - bottom_row["median_rent"]
    spread_phrase = (
        f"${top_vs_bottom:,.0f} above"
        if latest_spread.get("spread") is not None
        else "outpacing"
    )

    corr_pairs = [
        ("household income", correlations.get("rent_income")),
        ("subway access", correlations.get("rent_subway")),
        ("air quality (lower is better)", correlations.get("rent_air")),
    ]
    corr_pairs = [item for item in corr_pairs if item[1] is not None]
    corr_pairs.sort(key=lambda pair: abs(pair[1]), reverse=True)
    correlation_highlight = corr_pairs[0] if corr_pairs else ("income", 0.0)

    coeffs = regression.coefficients
    drivers = [(name, value) for name, value in coeffs.items() if name != "intercept"]
    driver = max(drivers, key=lambda item: abs(item[1])) if drivers else ("income", 0.0)

    return [
        {
            "title": f"{strongest_growth['borough']} leads rent acceleration",
            "body": (
                f"{strongest_growth['borough']} rents climbed {strongest_growth['pct']:.1f}% from "
                f"{int(strongest_growth['startYear'])} to {int(strongest_growth['endYear'])}, marking the fastest borough-scale gain."
            ),
            "evidence": [round(strongest_growth["pct"], 1)],
            "caveats": "Growth is percentage-based; absolute rents remain below Manhattan levels.",
        },
        {
            "title": f"{top_row['borough']} remains the price ceiling",
            "body": (
                f"In {latest_year}, {top_row['borough']} posts a median asking rent of $"
                f"{top_row['median_rent']:,.0f}, {spread_phrase} the city-floor borough."
            ),
            "evidence": [top_row["median_rent"], latest_spread.get("spread")],
            "caveats": "Borough medians mask neighborhood heterogeneity and unit size mix.",
        },
        {
            "title": f"{correlation_highlight[0]} alignment is strongest",
            "body": (
                f"Across {regression.nobs} borough-year observations, rent moves with {correlation_highlight[0]} "
                f"(r = {correlation_highlight[1]:.2f}), while regression weights point to {driver[0]} as the "
                f"dominant driver in recent years (β ≈ {driver[1]:.4f})."
            ),
            "evidence": [correlations, coeffs],
            "caveats": "Regression is observational; omitted variables (building quality, policy shocks) remain.",
        },
    ]


def build_viz_payload(df: pd.DataFrame, yoy: Dict[str, List[Dict[str, float]]], latest_rows: List[Dict[str, float]]) -> Dict[str, object]:
    """Prepare pre-aggregated series for the front-end charts."""

    boroughs = sorted(df["borough"].unique())
    years = sorted(df["year"].unique())
    series = {}
    for borough, group in df.groupby("borough"):
        group = group.sort_values("year")
        series[borough] = {
            "year": group["year"].astype(int).tolist(),
            "median_rent": group["median_rent"].astype(float).tolist(),
            "median_income": group["median_income"].astype(float).tolist(),
            "subway_access_score": group["subway_access_score"].astype(float).tolist(),
            "air_quality_index": group["air_quality_index"].astype(float).tolist(),
        }

    heatmap_matrix: List[List[float | None]] = []
    for borough in boroughs:
        entries = yoy.get(borough, [])
        yoy_lookup = {entry["year"]: entry["pct"] for entry in entries if entry["pct"] is not None}
        row = [yoy_lookup.get(year) for year in years]
        heatmap_matrix.append(row)

    scatter = [
        {
            "x": float(row["median_income"]),
            "y": float(row["median_rent"]),
            "r": max(4.0, float(row["subway_access_score"]) / 4.0),
            "borough": str(row["borough"]),
            "year": int(row["year"]),
            "subway": float(row["subway_access_score"]),
            "air_quality_index": float(row["air_quality_index"]),
        }
        for row in df.to_dict(orient="records")
    ]

    return {
        "generated_at": pd.Timestamp.utcnow().isoformat() + "Z",
        "boroughs": boroughs,
        "years": [int(year) for year in years],
        "series": series,
        "scatter": scatter,
        "heatmap": {
            "boroughs": boroughs,
            "years": [int(year) for year in years],
            "matrix": heatmap_matrix,
        },
        "latest_snapshot": latest_rows,
        "yoy": yoy,
    }


def write_json(path: Path, payload: Dict[str, object]) -> None:
    """Serialize JSON with UTF-8 encoding."""

    path.parent.mkdir(parents=True, exist_ok=True)
    payload = _to_native(payload)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_ols_report(regression: RegressionSnapshot) -> None:
    """Render the markdown appendix describing the regression."""

    APPENDIX_DIR.mkdir(parents=True, exist_ok=True)
    lines = [
        "# OLS Appendix — NYC Housing Dynamics",
        "",
        "**Model:** `rent ~ const + income + subway + inverseAir`  ",
        f"**Window:** {min(regression.window_years)}–{max(regression.window_years)} (last {len(regression.window_years)} years). "
        f"**N:** {regression.nobs}",
        f"**R²:** {regression.r2:.4f} (**Adj. R²:** {regression.adj_r2:.4f}), **σ (resid):** {regression.residual_std:.2f}",
        "",
        "## Coefficients",
        "| term | coef | std err | t | p>|t| | 95% CI |",
        "|---|---:|---:|---:|---:|---:|",
    ]

    for term in ["intercept", "income", "subway", "inverseAir"]:
        coef = regression.coefficients.get(term)
        stderr = regression.stderr.get(term)
        tval = regression.tvalues.get(term)
        pval = regression.pvalues.get(term)
        ci = regression.conf_int.get(term, {"lower": np.nan, "upper": np.nan})
        lines.append(
            f"| {term} | {coef:.4f} | {stderr:.4f} | {tval:.3f} | {pval:.4f} | "
            f"[{ci['lower']:.4f}, {ci['upper']:.4f}] |"
        )

    bp = regression.breusch_pagan
    vif_text = ", ".join(f"{feature}: {value:.2f}" for feature, value in regression.vif.items())
    lines.extend(
        [
            "",
            f"Breusch–Pagan: LM = {bp['lm_stat']:.2f} (p = {bp['lm_pvalue']:.3g}), F = {bp['f_stat']:.2f} (p = {bp['f_pvalue']:.3g}).",
            f"Variance Inflation Factors: {vif_text}.",
            "",
            "Notes: observational data; possible omitted-variable bias; limited window captures recent dynamics.",
        ]
    )

    OLS_REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    """Coordinate the derivation workflow."""

    df = load_data()
    latest_year = int(df["year"].max())

    growth = compute_growth(df, "median_rent")
    income_growth = compute_growth(df, "median_income")
    yoy = compute_yoy(df)
    disparity = compute_disparity(df)
    correlations = compute_correlations(df)
    regression = compute_regression(df, latest_year)
    latest_rows = latest_snapshot(df, latest_year)
    headlines = generate_headlines(growth, latest_rows, correlations, regression, disparity)

    derived_payload = {
        "generated_at": pd.Timestamp.utcnow().isoformat() + "Z",
        "latest_year": latest_year,
        "rent_growth": growth,
        "income_growth": income_growth,
        "yoy": yoy,
        "latest_rows": latest_rows,
        "correlations": correlations,
        "regression": regression.to_payload(),
        "disparity_index": disparity,
        "headlines": headlines,
    }

    viz_payload = build_viz_payload(df, yoy, latest_rows)

    write_json(OUT_DERIVED, derived_payload)
    write_json(OUT_PAYLOAD, viz_payload)
    write_ols_report(regression)

    print(f"[derive] wrote {OUT_DERIVED}")
    print(f"[derive] wrote {OUT_PAYLOAD}")
    print(f"[derive] updated {OLS_REPORT}")


if __name__ == "__main__":
    main()
