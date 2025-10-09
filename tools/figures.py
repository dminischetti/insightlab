"""Create diagnostic figures for the appendix."""

from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
import statsmodels.api as sm

SOURCE = "data/nyc_median_rent.csv"
OUTPUT_DIR = Path("appendix/figures")


def main() -> None:
    """Generate residual, QQ, influence, and correlation charts."""

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(SOURCE, comment="#")
    latest_year = int(df["year"].max())
    window = df["year"].ge(latest_year - 4)

    X = df.loc[window, ["median_income", "subway_access_score"]].astype(float).copy()
    X["inverseAir"] = 100 - df.loc[window, "air_quality_index"].astype(float)
    X = sm.add_constant(X, has_constant="add")
    y = df.loc[window, "median_rent"].astype(float)

    model = sm.OLS(y, X).fit()

    # Residuals vs fitted
    plt.figure(figsize=(6, 4))
    sns.scatterplot(x=model.fittedvalues, y=model.resid, s=30, color="#38bdf8")
    plt.axhline(0, color="gray", linestyle="--")
    plt.xlabel("Fitted values")
    plt.ylabel("Residuals")
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "residuals.png", dpi=180)
    plt.close()

    # QQ plot
    fig = sm.qqplot(model.resid, line="45")
    fig.set_size_inches(6, 4)
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "qq.png", dpi=180)
    plt.close()

    # Influence (leverage vs Cook's distance)
    influence = model.get_influence()
    leverage = influence.hat_matrix_diag
    cooks = influence.cooks_distance[0]
    plt.figure(figsize=(6, 4))
    plt.scatter(leverage, cooks, s=30, color="#6366f1")
    plt.xlabel("Leverage")
    plt.ylabel("Cook's distance")
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "influence.png", dpi=180)
    plt.close()

    # Correlation heatmap across core features
    plt.figure(figsize=(5, 4))
    corr = df[["median_rent", "median_income", "subway_access_score", "air_quality_index"]].corr()
    sns.heatmap(corr, annot=True, cmap="Blues", vmin=-1, vmax=1)
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "corr_matrix.png", dpi=180)
    plt.close()

    print("[figures] saved appendix figures")


if __name__ == "__main__":
    main()
