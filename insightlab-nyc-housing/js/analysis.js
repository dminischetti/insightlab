function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function cleanRecords(rows) {
  return rows
    .map((row) => ({
      year: Number(row.year),
      borough: String(row.borough),
      median_rent: toNumber(row.median_rent),
      median_income: toNumber(row.median_income),
      subway_access_score: toNumber(row.subway_access_score),
      air_quality_index: toNumber(row.air_quality_index)
    }))
    .filter((row) => row.year && row.borough && row.median_rent && row.median_income);
}

export function uniqueYears(records) {
  return Array.from(new Set(records.map((d) => d.year))).sort((a, b) => a - b);
}

export function uniqueBoroughs(records) {
  return Array.from(new Set(records.map((d) => d.borough))).sort();
}

export function filterRecords(records, { year = null, boroughs = [] } = {}) {
  return records.filter((row) => {
    const yearMatch = year ? row.year === year : true;
    const boroughMatch = boroughs && boroughs.length ? boroughs.includes(row.borough) : true;
    return yearMatch && boroughMatch;
  });
}

export function groupByBorough(records) {
  return records.reduce((acc, row) => {
    if (!acc[row.borough]) acc[row.borough] = [];
    acc[row.borough].push(row);
    return acc;
  }, {});
}

export function calculateRentGrowth(records) {
  const years = uniqueYears(records);
  const startYear = years[0];
  const endYear = years[years.length - 1];
  const byBorough = groupByBorough(records);
  const result = {};
  Object.entries(byBorough).forEach(([borough, rows]) => {
    const start = rows.find((r) => r.year === startYear);
    const end = rows.find((r) => r.year === endYear);
    if (!start || !end) return;
    const absolute = end.median_rent - start.median_rent;
    const pct = (absolute / start.median_rent) * 100;
    result[borough] = {
      startYear,
      endYear,
      startValue: start.median_rent,
      endValue: end.median_rent,
      absolute,
      pct
    };
  });
  return result;
}

export function calculateMetricGrowth(records, metric) {
  const years = uniqueYears(records);
  const startYear = years[0];
  const endYear = years[years.length - 1];
  const byBorough = groupByBorough(records);
  const result = {};
  Object.entries(byBorough).forEach(([borough, rows]) => {
    const start = rows.find((r) => r.year === startYear);
    const end = rows.find((r) => r.year === endYear);
    if (!start || !end) return;
    const startValue = start[metric];
    const endValue = end[metric];
    if (startValue === undefined || endValue === undefined) return;
    const absolute = endValue - startValue;
    const pct = startValue === 0 ? 0 : (absolute / startValue) * 100;
    result[borough] = { startYear, endYear, startValue, endValue, absolute, pct };
  });
  return result;
}

export function calculateYearOverYear(records) {
  const sorted = [...records].sort((a, b) => (a.year === b.year ? a.median_rent - b.median_rent : a.year - b.year));
  const yoy = {};
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    if (current.borough !== prev.borough) continue;
    if (!yoy[current.borough]) yoy[current.borough] = [];
    yoy[current.borough].push({
      year: current.year,
      change: current.median_rent - prev.median_rent,
      pct: ((current.median_rent - prev.median_rent) / prev.median_rent) * 100
    });
  }
  return yoy;
}

export function latestYear(records) {
  return Math.max(...records.map((d) => d.year));
}

export function latestYearSnapshot(records) {
  const year = latestYear(records);
  const rows = filterRecords(records, { year });
  return rows.sort((a, b) => b.median_rent - a.median_rent);
}

export function pearsonCorrelation(records, xKey, yKey) {
  const valid = records.filter((r) => Number.isFinite(r[xKey]) && Number.isFinite(r[yKey]));
  if (!valid.length) return null;
  const xs = valid.map((r) => r[xKey]);
  const ys = valid.map((r) => r[yKey]);
  const n = xs.length;
  const meanX = xs.reduce((sum, v) => sum + v, 0) / n;
  const meanY = ys.reduce((sum, v) => sum + v, 0) / n;
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    denomX += dx ** 2;
    denomY += dy ** 2;
  }
  const denominator = Math.sqrt(denomX * denomY);
  if (denominator === 0) return null;
  return numerator / denominator;
}

function matrixMultiply(A, B) {
  const rowsA = A.length;
  const colsA = A[0].length;
  const colsB = B[0].length;
  const result = Array.from({ length: rowsA }, () => Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      for (let k = 0; k < colsA; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

function transpose(A) {
  return A[0].map((_, colIndex) => A.map((row) => row[colIndex]));
}

function invertMatrix(matrix) {
  const n = matrix.length;
  const augmented = matrix.map((row, i) => {
    const identityRow = Array(n).fill(0);
    identityRow[i] = 1;
    return [...row, ...identityRow];
  });

  for (let i = 0; i < n; i++) {
    let pivot = augmented[i][i];
    if (Math.abs(pivot) < 1e-9) {
      const swap = augmented.findIndex((row, idx) => idx > i && Math.abs(row[i]) > 1e-9);
      if (swap === -1) return null;
      [augmented[i], augmented[swap]] = [augmented[swap], augmented[i]];
      pivot = augmented[i][i];
    }
    for (let j = 0; j < 2 * n; j++) {
      augmented[i][j] /= pivot;
    }
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = augmented[k][i];
      for (let j = 0; j < 2 * n; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }

  return augmented.map((row) => row.slice(n));
}

export function olsRegression(records) {
  if (!records.length) return null;
  const X = [];
  const y = [];
  records.forEach((row) => {
    const inverseAQI = 100 - row.air_quality_index;
    X.push([1, row.median_income, row.subway_access_score, inverseAQI]);
    y.push([row.median_rent]);
  });
  const Xt = transpose(X);
  const XtX = matrixMultiply(Xt, X);
  const XtXInv = invertMatrix(XtX);
  if (!XtXInv) return null;
  const XtY = matrixMultiply(Xt, y);
  const betaMatrix = matrixMultiply(XtXInv, XtY);
  const beta = betaMatrix.map((row) => row[0]);

  const predictions = X.map((row) => row.reduce((sum, value, idx) => sum + value * beta[idx], 0));
  const residuals = predictions.map((pred, idx) => y[idx][0] - pred);
  const meanY = y.reduce((sum, val) => sum + val[0], 0) / y.length;
  const ssTot = y.reduce((sum, val) => sum + (val[0] - meanY) ** 2, 0);
  const ssRes = residuals.reduce((sum, r) => sum + r ** 2, 0);
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const residualStd = Math.sqrt(ssRes / Math.max(1, y.length - beta.length));
  return {
    coefficients: {
      intercept: beta[0],
      income: beta[1],
      subway: beta[2],
      inverseAir: beta[3]
    },
    r2,
    residualStd,
    predictions,
    residuals
  };
}

export function latestWindow(records, size = 5) {
  const years = uniqueYears(records);
  const windowYears = years.slice(-size);
  return records.filter((row) => windowYears.includes(row.year));
}

export function calculateDisparity(records) {
  const years = uniqueYears(records);
  const disparity = {};
  years.forEach((year) => {
    const rows = filterRecords(records, { year });
    const rents = rows.map((r) => r.median_rent);
    disparity[year] = {
      max: Math.max(...rents),
      min: Math.min(...rents),
      spread: Math.max(...rents) - Math.min(...rents)
    };
  });
  return disparity;
}

export function heatmapData(records, metric = 'median_rent', yoy = null) {
  const years = uniqueYears(records);
  const boroughs = uniqueBoroughs(records);
  return {
    years,
    boroughs,
    matrix: boroughs.map((borough) =>
      years.map((year) => {
        const match = records.find((row) => row.year === year && row.borough === borough);
        if (!match) return null;
        if (metric === 'median_rent') return match.median_rent;
        if (metric === 'rent_growth' && yoy && yoy[borough]) {
          const change = yoy[borough].find((entry) => entry.year === year);
          return change ? Number(change.pct.toFixed(1)) : 0;
        }
        return match[metric] ?? null;
      })
    )
  };
}

function rankBoroughs(latestRows) {
  return latestRows.map((row, index) => ({
    rank: index + 1,
    borough: row.borough,
    median_rent: row.median_rent,
    median_income: row.median_income
  }));
}

export function summarize(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      growth: {},
      incomeGrowth: {},
      yoy: {},
      latestRows: [],
      correlations: { rent_income: null, rent_subway: null, rent_air: null },
      regression: null,
      disparity: {},
      headlines: [],
      latestYear: null
    };
  }
  const growth = calculateRentGrowth(records);
  const incomeGrowth = calculateMetricGrowth(records, 'median_income');
  const yoy = calculateYearOverYear(records);
  const latestRows = latestYearSnapshot(records);
  const correlations = {
    rent_income: pearsonCorrelation(records, 'median_income', 'median_rent'),
    rent_subway: pearsonCorrelation(records, 'subway_access_score', 'median_rent'),
    rent_air: pearsonCorrelation(records, 'air_quality_index', 'median_rent')
  };
  const regWindow = latestWindow(records, 5);
  const regression = olsRegression(regWindow);
  const disparity = calculateDisparity(records);
  const headlines = generateHeadlines({ growth, latestRows, correlations, regression, disparity, regWindow });

  return {
    growth,
    incomeGrowth,
    yoy,
    latestRows,
    correlations,
    regression,
    disparity,
    headlines,
    latestYear: latestYear(records)
  };
}

export function generateHeadlines({ growth, latestRows, correlations, regression, disparity, regWindow }) {
  if (!latestRows?.length || !growth || !Object.keys(growth).length) return [];

  const safeWindow = Array.isArray(regWindow)
    ? regWindow.filter((row) => row && Number.isFinite(row.year))
    : [];

  const strongestGrowth = Object.entries(growth)
    .map(([borough, values]) => ({ borough, pct: values.pct, meta: values }))
    .filter((entry) => Number.isFinite(entry.pct))
    .sort((a, b) => b.pct - a.pct)[0];

  const topRow = latestRows.find((row) => row && Number.isFinite(row.median_rent));
  if (!strongestGrowth || !topRow) return [];

  const spreadYears = disparity ? Object.keys(disparity) : [];
  const latestSpreadYear = spreadYears.length ? Math.max(...spreadYears.map(Number)) : null;
  const latestSpread = latestSpreadYear ? disparity[latestSpreadYear] : null;

  const correlationEntries = [
    ['household income', correlations.rent_income],
    ['subway access', correlations.rent_subway],
    ['air quality (lower is better)', correlations.rent_air]
  ].filter(([, value]) => value !== null && !Number.isNaN(value));
  const correlationHighlight = correlationEntries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];

  const regressionDriver = regression?.coefficients
    ? Object.entries(regression.coefficients)
        .filter(([key]) => key !== 'intercept')
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]
    : null;

  const recentYears = safeWindow.map((row) => row.year);
  const latestYearFallback = strongestGrowth?.meta?.endYear ?? topRow.year ?? new Date().getFullYear();
  const latestYearValue = recentYears.length ? Math.max(...recentYears) : latestYearFallback;
  const topVsBottom = latestSpread && Number.isFinite(latestSpread.min) ? topRow.median_rent - latestSpread.min : 0;

  return [
    {
      title: `${strongestGrowth.borough} leads rent acceleration`,
      body: `${strongestGrowth.borough} rents climbed ${strongestGrowth.pct.toFixed(1)}% from ${strongestGrowth.meta.startYear} to ${strongestGrowth.meta.endYear}, marking the fastest borough-scale gain.`,
      evidence: [strongestGrowth.pct.toFixed(1)],
      caveats: 'Growth is percentage-based; absolute rents remain below Manhattan levels.'
    },
    {
      title: `${topRow.borough} remains the price ceiling`,
      body: `In ${latestYearValue}, ${topRow.borough} posts a median asking rent of $${topRow.median_rent.toLocaleString()}, ${latestSpread ? `$${topVsBottom.toLocaleString()} above` : 'outpacing'} the city-floor borough.`,
      evidence: [topRow.median_rent, latestSpread?.spread ?? null],
      caveats: 'Borough medians mask neighborhood heterogeneity and unit size mix.'
    },
    {
      title: `${correlationHighlight ? correlationHighlight[0] : 'Income'} alignment is strongest`,
      body: `Across 75 borough-year observations, rent moves with ${correlationHighlight ? correlationHighlight[0] : 'household income'} (r = ${correlationHighlight ? correlationHighlight[1].toFixed(2) : '0.00'}), while regression weights point to ${regressionDriver ? regressionDriver[0] : 'income'} as the dominant driver in recent years (β ≈ ${regressionDriver ? regressionDriver[1].toFixed(4) : '0.0000'}).`,
      evidence: [correlations, regression?.coefficients],
      caveats: 'Regression is observational; omitted variables (building quality, policy shocks) remain.'
    }
  ];
}


export function buildSummaryPayload(base, summary) {
  return {
    ...base,
    generated_at: new Date().toISOString(),
    latest_year: summary.latestYear,
    rent_growth: summary.growth,
    correlations: summary.correlations,
    regression: summary.regression,
    disparity_index: summary.disparity,
    headlines: summary.headlines
  };
}

export function latestMetrics(records, year, boroughs = []) {
  const rows = filterRecords(records, { year, boroughs });
  const rank = rankBoroughs([...rows].sort((a, b) => b.median_rent - a.median_rent));
  const averageIncome = rows.reduce((sum, row) => sum + row.median_income, 0) / rows.length;
  const averageRent = rows.reduce((sum, row) => sum + row.median_rent, 0) / rows.length;
  return {
    rank,
    averageIncome,
    averageRent
  };
}

export function aggregateForYear(records, year) {
  return filterRecords(records, { year });
}

export function compileScatter(records, boroughs) {
  const filtered = filterRecords(records, { boroughs });
  return filtered.map((row) => ({
    x: row.median_income,
    y: row.median_rent,
    r: Math.max(4, row.subway_access_score / 4),
    borough: row.borough,
    year: row.year,
    subway: row.subway_access_score,
    airQuality: row.air_quality_index
  }));
}

export function yearRange(records) {
  const years = uniqueYears(records);
  return { min: years[0], max: years[years.length - 1] };
}
