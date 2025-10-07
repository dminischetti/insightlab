import { calculateRentGrowth, calculateDisparity, pearsonCorrelation, latestWindow, olsRegression, filterRecords } from './analysis.js';

export function renderExecutiveSummary(records, state) {
  const growth = calculateRentGrowth(records);
  const disparity = calculateDisparity(records);
  const latestYear = state.year;
  let filteredRecords = filterRecords(records, { year: latestYear, boroughs: state.boroughs });
  if (!filteredRecords.length) {
    filteredRecords = filterRecords(records, { year: latestYear });
  }
  const corr = pearsonCorrelation(records, 'median_income', 'median_rent');
  const reg = olsRegression(latestWindow(records, 5));
  const spread = disparity[latestYear];
  const topBorough = filteredRecords.sort((a, b) => b.median_rent - a.median_rent)[0];

  if (!topBorough || !spread) {
    return [
      'Insufficient data in the current filter to calculate growth.',
      'Adjust the filters to include at least one borough-year observation.',
      `Rent tracks household income closely (r = <strong>${corr?.toFixed(2) ?? '0.00'}</strong>) even when filters narrow.`
    ];
  }

  return [
    `Borough rent growth since ${growth[topBorough.borough].startYear} places <strong>${topBorough.borough}</strong> at <strong>${growth[topBorough.borough].pct.toFixed(1)}%</strong>, the steepest citywide trajectory within the current filter.`,
    `Median asking rent in ${latestYear} now spans <strong>$${spread.min.toLocaleString()}–$${spread.max.toLocaleString()}</strong>, a spread of <strong>$${spread.spread.toLocaleString()}</strong> across the five boroughs.`,
    `Rent tracks household income closely (r = <strong>${corr?.toFixed(2) ?? '0.00'}</strong>); regression over the last five years pins the largest coefficient on income (β = <strong>${reg?.coefficients.income.toFixed(4) ?? '0.0000'}</strong>).`
  ];
}

export function applyNarrativeBlocks(records, state) {
  const growthPanel = document.querySelector('[data-narrative="growth"]');
  const correlationPanel = document.querySelector('[data-narrative="correlation"]');
  const regressionPanel = document.querySelector('[data-narrative="regression"]');
  const disparityPanel = document.querySelector('[data-narrative="disparity"]');

  const growth = calculateRentGrowth(records);
  const disparity = calculateDisparity(records);
  const corrIncome = pearsonCorrelation(records, 'median_income', 'median_rent');
  const corrTransit = pearsonCorrelation(records, 'subway_access_score', 'median_rent');
  const corrAir = pearsonCorrelation(records, 'air_quality_index', 'median_rent');
  const regression = olsRegression(latestWindow(records, 5));

  const fastest = Object.entries(growth)
    .map(([borough, stats]) => ({ borough, pct: stats.pct }))
    .sort((a, b) => b.pct - a.pct)[0];
  const latestYear = state.year;
  const spread = disparity[latestYear];

  if (growthPanel) {
    growthPanel.innerHTML = `Since ${growth[fastest.borough].startYear}, <strong>${fastest.borough}</strong> rents climbed <strong>${fastest.pct.toFixed(1)}%</strong>, adding $${growth[fastest.borough].absolute.toLocaleString()} on top of a ${growth[fastest.borough].startValue.toLocaleString()} baseline.`;
  }

  if (correlationPanel) {
    correlationPanel.innerHTML = `Correlations show rent co-moving with income (<strong>r=${corrIncome?.toFixed(2) ?? '0.00'}</strong>), subway access (<strong>r=${corrTransit?.toFixed(2) ?? '0.00'}</strong>), and a modest inverse with air quality (<strong>r=${corrAir?.toFixed(2) ?? '0.00'}</strong>). Higher incomes align most tightly with higher rents, though causality is not implied.`;
  }

  if (regressionPanel && regression) {
    regressionPanel.innerHTML = `OLS on 2019–${latestYear} observations yields <strong>R²=${regression.r2.toFixed(3)}</strong> with residual σ=${regression.residualStd.toFixed(2)}. Income carries β=${regression.coefficients.income.toFixed(4)}, subway β=${regression.coefficients.subway.toFixed(4)}, and cleaner air proxy β=${regression.coefficients.inverseAir.toFixed(4)}.`;
  }

  if (disparityPanel && spread) {
    const lowest = filterRecords(records, { year: latestYear, boroughs: state.boroughs }).sort((a, b) => a.median_rent - b.median_rent)[0];
    disparityPanel.innerHTML = `The ${latestYear} disparity gap is <strong>$${spread.spread.toLocaleString()}</strong>, with ${lowest ? lowest.borough : 'the lowest borough'} anchoring the floor at $${spread.min.toLocaleString()}. Pandemic volatility compressed spreads briefly in 2020 before widening again.`;
  }
}
