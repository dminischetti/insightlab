# OLS Appendix — NYC Housing Dynamics

**Model:** `rent ~ const + income + subway + inverseAir`  
**Window:** 2020–2024 (last 5 years).
**N:** 25
**R²:** 0.9975 (**Adj. R²:** 0.9972), **σ (resid):** 32.28

## Coefficients
| term | coef | std err | t | p>|t| | 95% CI |
|---|---:|---:|---:|---:|---:|
| intercept | -1815.4960 | 178.6850 | -10.160 | 0.0000 | [-2165.7187, -1465.2734] |
| income | 0.0279 | 0.0008 | 36.138 | 0.0000 | [0.0264, 0.0295] |
| subway | 15.7282 | 0.5951 | 26.431 | 0.0000 | [14.5619, 16.8946] |
| inverseAir | 11.7151 | 4.4019 | 2.661 | 0.0078 | [3.0875, 20.3428] |

Breusch–Pagan: LM = 5.81 (p = 0.0547), F = 2.12 (p = 0.0416).
Variance Inflation Factors: income: 3.49, subway: 1.64, inverseAir: 4.51.

Notes: observational data; possible omitted-variable bias; limited window captures recent dynamics.
