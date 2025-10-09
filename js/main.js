import { initThemeToggle } from './theme.js';
import { loadAllData } from './dataLoader.js';
import {
  summarize,
  uniqueYears,
  uniqueBoroughs,
  filterRecords,
  compileScatter,
  heatmapData,
  calculateMetricGrowth
} from './analysis.js';
import { initBarChart, initLineMultiples, initScatterChart, updateScatterChart, initHeatmap, refreshThemes } from './charts.js';

const state = {
  records: [],
  summary: null,
  viz: null,
  charts: {
    bar: null,
    multiples: [],
    scatter: null,
    heatmap: null
  },
  scatterRanges: null
};

const counterOptions = { duration: 1600 };

window.addEventListener('DOMContentLoaded', bootstrap);

async function bootstrap() {
  initThemeToggle(document.querySelector('[data-theme-toggle]'));
  initDensityToggle();
  initProgressBar();
  initRevealObserver();
  const { records, summary, vizPayload } = await loadAllData();
  state.records = records;
  state.viz = vizPayload;
  // Derive a summary locally so we can merge in any precomputed fields from the
  // pipeline while preserving the interactive fallbacks.
  const computedSummary = summarize(records);
  if (summary) {
    state.summary = {
      ...computedSummary,
      ...summary,
      latestRows: summary.latestRows?.length ? summary.latestRows : computedSummary.latestRows,
      yoy: Object.keys(summary.yoy ?? {}).length ? summary.yoy : computedSummary.yoy,
      growth: Object.keys(summary.growth ?? {}).length ? summary.growth : computedSummary.growth,
      incomeGrowth: Object.keys(summary.incomeGrowth ?? {}).length ? summary.incomeGrowth : computedSummary.incomeGrowth,
      disparity: Object.keys(summary.disparity ?? {}).length ? summary.disparity : computedSummary.disparity,
      correlations: summary.correlations ?? computedSummary.correlations,
      regression: summary.regression ?? computedSummary.regression,
      headlines: summary.headlines?.length ? summary.headlines : computedSummary.headlines
    };
  } else {
    state.summary = computedSummary;
  }

  updateHero(state.summary);
  updateContext(state.summary);
  updateKpis(state.records, state.summary);
  renderCharts(state.records, state.summary, state.viz);
  renderCaptions(state.records, state.summary, state.viz);
  renderFindings(state.records, state.summary);

  document.addEventListener('theme:change', () => refreshThemes());
}

function initDensityToggle() {
  const toggle = document.querySelector('[data-density-toggle]');
  if (!toggle) return;
  const updateLabel = () => {
    const compact = document.body.classList.contains('compact-mode');
    toggle.textContent = compact ? 'Compact spacing' : 'Expanded spacing';
    toggle.setAttribute('aria-pressed', String(compact));
  };
  updateLabel();
  toggle.addEventListener('click', () => {
    document.body.classList.toggle('compact-mode');
    updateLabel();
  });
}

function initProgressBar() {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  const update = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.body.scrollHeight - window.innerHeight;
    const ratio = docHeight > 0 ? scrollTop / docHeight : 0;
    bar.style.width = `${Math.max(0, Math.min(100, ratio * 100))}%`;
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

function initRevealObserver() {
  const targets = document.querySelectorAll('[data-animate], .chart-frame');
  if (!targets.length) return;
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  targets.forEach((el) => observer.observe(el));
}

function renderCharts(records, summary, vizPayload) {
  const latestYear = summary.latestYear;
  const latestRows = (summary.latestRows && summary.latestRows.length
    ? summary.latestRows
    : filterRecords(records, { year: latestYear }).sort((a, b) => b.median_rent - a.median_rent))
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const boroughs = vizPayload?.boroughs ?? uniqueBoroughs(records);
  const years = vizPayload?.years ?? uniqueYears(records);
  const barCanvas = document.getElementById('chart-bar');
  const multiplesContainer = document.querySelector('[data-chart-multiples]');
  const scatterCanvas = document.getElementById('chart-scatter');
  const heatmapCanvas = document.getElementById('chart-heatmap');

  if (barCanvas) state.charts.bar = initBarChart(barCanvas, latestRows, latestYear);
  if (multiplesContainer) state.charts.multiples = initLineMultiples(multiplesContainer, records, years, boroughs);
  if (scatterCanvas) initScatterWithTabs(scatterCanvas, records, boroughs, years);
  if (heatmapCanvas) {
    const dataset = vizPayload?.heatmap ?? prepareHeatmapDataset(heatmapData(records, 'rent_growth', summary.yoy));
    state.charts.heatmap = initHeatmap(heatmapCanvas, dataset);
  }
}

function initScatterWithTabs(canvas, records, boroughs, years) {
  const points = compileScatter(records, boroughs);
  const startYear = Math.min(...years);
  const splitYear = 2016;
  const endYear = Math.max(...years);
  const ranges = {
    '2010-2016': { min: startYear, max: Math.min(splitYear, endYear) },
    '2017-2024': { min: Math.min(splitYear + 1, endYear), max: endYear }
  };
  state.scatterRanges = ranges;
  const defaultKey = Object.keys(ranges)[0];
  const initialPoints = filterScatter(points, ranges[defaultKey]);
  state.charts.scatter = initScatterChart(canvas, initialPoints);

  const tabs = document.querySelectorAll('[data-period-tab]');
  tabs.forEach((tab, index) => {
    if (!tab.dataset.periodTab) return;
    tab.setAttribute('tabindex', index === 0 ? '0' : '-1');
    tab.addEventListener('click', () => {
      const key = tab.dataset.periodTab;
      if (!key || !ranges[key]) return;
      tabs.forEach((other) => {
        const isActive = other === tab;
        other.classList.toggle('is-active', isActive);
        other.setAttribute('aria-selected', String(isActive));
        other.setAttribute('tabindex', isActive ? '0' : '-1');
      });
      const filtered = filterScatter(points, ranges[key]);
      updateScatterChart(state.charts.scatter, filtered);
    });
  });
}

function filterScatter(points, range) {
  if (!range) return points;
  if (range.max < range.min) return points;
  return points.filter((point) => point.year >= range.min && point.year <= range.max);
}


function updateHero(summary) {
  const disparityEntries = Object.entries(summary.disparity ?? {});
  if (!disparityEntries.length) return;
  const earliestYear = Math.min(...disparityEntries.map(([year]) => Number(year)));
  const latestYear = summary.latestYear;
  const earliestSpread = summary.disparity[earliestYear]?.spread ?? 0;
  const latestSpread = summary.disparity[latestYear]?.spread ?? 0;
  const delta = latestSpread - earliestSpread;

  const metricNode = document.querySelector('[data-counter-value]');
  const abstractNode = document.querySelector('[data-abstract-spread]');
  if (abstractNode) {
    abstractNode.textContent = `${formatCurrency(delta)} wider`;
  }
  if (metricNode) {
    animateCounter(metricNode, delta, counterOptions, { prefix: '+$' });
    metricNode.dataset.value = delta;
    metricNode.setAttribute('aria-live', 'polite');
  }
}

function updateContext(summary) {
  const latestYear = summary.latestYear;
  const latestRows = summary.latestRows ?? [];
  if (!latestRows.length) return;
  const averageRent = latestRows.reduce((sum, row) => sum + row.median_rent, 0) / latestRows.length;
  const averageIncome = latestRows.reduce((sum, row) => sum + row.median_income, 0) / latestRows.length;
  const statNode = document.querySelector('[data-context-stat]');
  if (statNode) {
    statNode.textContent = `In ${latestYear}, the typical borough renter faced a $${Math.round(
      averageRent
    ).toLocaleString()} median asking rent while household income averaged $${Math.round(averageIncome)
      .toLocaleString()} — a gap that kept pressure on affordability.`;
  }
}

function renderCaptions(records, summary, vizPayload) {
  const latestRows = summary.latestRows ?? [];
  if (latestRows.length) {
    const top = latestRows[0];
    const bottom = latestRows[latestRows.length - 1];
    const spread = top.median_rent - bottom.median_rent;
    setText(
      '[data-takeaway="rent-latest"]',
      `Takeaway: ${top.borough} tops ${summary.latestYear} at ${formatCurrency(top.median_rent)}, while ${bottom.borough} remains lowest, leaving a ${spread.toLocaleString('en-US', { maximumFractionDigits: 0 })} dollar gap. · Source: NYC Open Data. · Period: ${summary.latestYear}.`
    );
  }

  const growth = summary.growth ?? {};
  const growthValues = Object.values(growth).filter(Boolean);
  if (growthValues.length) {
    const minGrowth = Math.min(...growthValues.map((g) => g.pct));
    const maxGrowth = Math.max(...growthValues.map((g) => g.pct));
    const topBorough = Object.keys(growth).reduce((best, borough) => {
      if (!best) return borough;
      return (growth[borough]?.pct ?? 0) > (growth[best]?.pct ?? 0) ? borough : best;
    }, null);
    setText(
      '[data-takeaway="rent-trajectories"]',
      `Takeaway: Borough rents climbed between ${minGrowth.toFixed(1)}% and ${maxGrowth.toFixed(1)}%, with ${(topBorough ?? 'Brooklyn')} bending upward fastest after 2012. · Source: NYC Open Data. · Period: 2010–2024.`
    );
  }

  const incomeCorrelation = summary.correlations?.rent_income;
  const transitCorrelation = summary.correlations?.rent_subway;
  if (Number.isFinite(incomeCorrelation) && Number.isFinite(transitCorrelation)) {
    setText(
      '[data-takeaway="rent-transit"]',
      `Takeaway: Rent tracks income (r = ${incomeCorrelation.toFixed(2)}) yet high-transit borough-years sit above the trend, tightening budgets. · Source: ACS + MTA + NYC Open Data. · Period: 2010–2024.`
    );
  }

  const yoyMatrix = vizPayload?.heatmap ?? prepareHeatmapDataset(heatmapData(records, 'rent_growth', summary.yoy));
  const pctValues = yoyMatrix.matrix.flat().filter((value) => Number.isFinite(value));
  if (pctValues.length) {
    const maxYoY = Math.max(...pctValues);
    setText(
      '[data-takeaway="rent-heatmap"]',
      `Takeaway: Year-over-year rent change peaked near ${maxYoY.toFixed(1)}%, with matching surges around 2013 and 2021. · Source: NYC Open Data. · Period: 2011–2024.`
    );
  }
}

function updateKpis(records, summary) {
  const years = uniqueYears(records);
  if (!years.length) return;
  const startYear = years[0];
  const endYear = years[years.length - 1];
  const startRows = filterRecords(records, { year: startYear });
  const endRows = filterRecords(records, { year: endYear });
  if (startRows.length && endRows.length) {
    const startAverage = average(startRows.map((row) => row.median_rent));
    const endAverage = average(endRows.map((row) => row.median_rent));
    const rentDelta = endAverage - startAverage;
    const rentPrefix = rentDelta >= 0 ? '+' : '−';
    setText('[data-kpi="rent-delta"]', `${rentPrefix}${formatCurrency(Math.abs(rentDelta))}`);
  }

  const wageStartYear = Math.max(2015, startYear);
  const startIncomeRows = filterRecords(records, { year: wageStartYear });
  const endIncomeRows = filterRecords(records, { year: endYear });
  if (startIncomeRows.length && endIncomeRows.length) {
    const startGap = average(startIncomeRows.map((row) => row.median_income / 12 - row.median_rent));
    const endGap = average(endIncomeRows.map((row) => row.median_income / 12 - row.median_rent));
    const gapDelta = endGap - startGap;
    const gapPrefix = gapDelta >= 0 ? '+' : '−';
    setText('[data-kpi="wage-gap"]', `${gapPrefix}${formatCurrency(Math.abs(gapDelta))}`);
  }
}

function average(values) {
  if (!values.length) return 0;
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
  return total / values.length;
}

function renderFindings(records, summary) {
  const list = document.querySelector('[data-findings-list]');
  if (!list) return;
  list.innerHTML = '';

  const growth = summary.growth ?? {};
  const incomeGrowth = calculateMetricGrowth(records, 'median_income');
  const rentGrowthRange = rangeFromGrowth(growth);
  const incomeGrowthRange = rangeFromGrowth(incomeGrowth);
  const rentOutpaced = countRentOutpacesIncome(records, 2016, summary.latestYear);
  const transitR = summary.correlations?.rent_subway ?? null;
  const spreadDelta = computeSpreadDelta(summary.disparity ?? {});
  const regressionR2 = summary.regression?.r2 ?? null;

  const bullets = [
    `Median borough rent rose ${rentGrowthRange} since 2010, compared with income gains of ${incomeGrowthRange}.`,
    `Rent growth outpaced income growth in ${rentOutpaced} of 5 boroughs after 2016, reinforcing sustained affordability pressure.`,
    Number.isFinite(transitR)
      ? `Transit proximity explains roughly ${(transitR ** 2 * 100).toFixed(0)}% of rent variance (r ≈ ${transitR.toFixed(2)}).`
      : null,
    spreadDelta
      ? `The Manhattan–Bronx rent spread widened by ${formatCurrency(spreadDelta.delta)} since 2010, reaching ${formatCurrency(
          spreadDelta.latest
        )} in ${spreadDelta.year}.`
      : null,
    Number.isFinite(regressionR2)
      ? `A three-factor OLS (income + transit + air quality) on 2020–2024 produces R² ≈ ${regressionR2.toFixed(
          3
        )}, indicating little unexplained variance.`
      : null
  ].filter(Boolean);

  bullets.forEach((text) => {
    const item = document.createElement('li');
    item.textContent = text;
    list.appendChild(item);
  });
}

function animateCounter(node, value, { duration } = { duration: 1200 }, { prefix = '', suffix = '' } = {}) {
  const start = performance.now();
  const startValue = 0;
  const target = Number(value) || 0;
  const step = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = easeOutQuart(progress);
    const current = Math.round(startValue + (target - startValue) * eased);
    node.textContent = `${prefix}${current.toLocaleString()}${suffix}`;
    if (progress < 1) requestAnimationFrame(step);
  };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    node.textContent = `${prefix}${Math.round(target).toLocaleString()}${suffix}`;
    return;
  }
  requestAnimationFrame(step);
}

function easeOutQuart(t) {
  return 1 - (1 - t) ** 4;
}

function setText(selector, text) {
  const node = document.querySelector(selector);
  if (node) node.textContent = text;
}

function formatCurrency(value) {
  const number = Number(value) || 0;
  return `$${Math.round(number).toLocaleString()}`;
}

function rangeFromGrowth(growthMap) {
  const entries = Object.values(growthMap).filter(Boolean);
  if (!entries.length) return 'n/a';
  const min = Math.min(...entries.map((g) => g.pct));
  const max = Math.max(...entries.map((g) => g.pct));
  return `${min.toFixed(1)}%–${max.toFixed(1)}%`;
}

function countRentOutpacesIncome(records, startYear, endYear) {
  const boroughs = uniqueBoroughs(records);
  let count = 0;
  boroughs.forEach((borough) => {
    const rentGrowth = percentChange(records, borough, 'median_rent', startYear, endYear);
    const incomeGrowth = percentChange(records, borough, 'median_income', startYear, endYear);
    if (rentGrowth !== null && incomeGrowth !== null && rentGrowth > incomeGrowth) {
      count += 1;
    }
  });
  return count;
}

function percentChange(records, borough, key, startYear, endYear) {
  const start = records.find((row) => row.borough === borough && row.year === startYear);
  const end = records.find((row) => row.borough === borough && row.year === endYear);
  if (!start || !end || !Number.isFinite(start[key]) || !Number.isFinite(end[key])) return null;
  return ((end[key] - start[key]) / start[key]) * 100;
}

function computeSpreadDelta(disparity) {
  const years = Object.keys(disparity || {}).map(Number);
  if (!years.length) return null;
  const earliest = Math.min(...years);
  const latest = Math.max(...years);
  const earliestSpread = disparity[earliest]?.spread;
  const latestSpread = disparity[latest]?.spread;
  if (!Number.isFinite(earliestSpread) || !Number.isFinite(latestSpread)) return null;
  return { delta: latestSpread - earliestSpread, latest: latestSpread, year: latest };
}

function prepareHeatmapDataset(dataset) {
  if (!dataset || !Array.isArray(dataset.years)) {
    return { years: [], boroughs: [], matrix: [] };
  }
  if (dataset.years.length <= 1) return dataset;
  const years = dataset.years.slice(1);
  const matrix = dataset.matrix.map((row) => row.slice(1));
  return { ...dataset, years, matrix };
}
