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
import { initBarChart, initLineChart, initScatterChart, initHeatmap, refreshThemes } from './charts.js';

const state = {
  records: [],
  summary: null,
  charts: {
    bar: null,
    line: null,
    scatter: null,
    heatmap: null
  }
};

const counterOptions = { duration: 1600 };

window.addEventListener('DOMContentLoaded', bootstrap);

async function bootstrap() {
  initThemeToggle(document.querySelector('[data-theme-toggle]'));
  initDensityToggle();
  initProgressBar();
  initRevealObserver();
  const { records } = await loadAllData();
  state.records = records;
  state.summary = summarize(records);

  updateHero(state.summary);
  updateContext(state.summary);
  renderCharts(records, state.summary);
  renderCaptions(records, state.summary);
  renderFindings(records, state.summary);

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

function renderCharts(records, summary) {
  const latestYear = summary.latestYear;
  const latestRows = filterRecords(records, { year: latestYear }).sort((a, b) => b.median_rent - a.median_rent);
  const boroughs = uniqueBoroughs(records);
  const years = uniqueYears(records);
  const barCanvas = document.getElementById('chart-bar');
  const lineCanvas = document.getElementById('chart-line');
  const scatterCanvas = document.getElementById('chart-scatter');
  const heatmapCanvas = document.getElementById('chart-heatmap');

  if (barCanvas) state.charts.bar = initBarChart(barCanvas, latestRows, latestYear);
  if (lineCanvas) state.charts.line = initLineChart(lineCanvas, records, years, boroughs);
  if (scatterCanvas) state.charts.scatter = initScatterChart(scatterCanvas, compileScatter(records, boroughs));
  if (heatmapCanvas) {
    const dataset = prepareHeatmapDataset(heatmapData(records, 'rent_growth', summary.yoy));
    state.charts.heatmap = initHeatmap(heatmapCanvas, dataset);
  }
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

function renderCaptions(records, summary) {
  const latestRows = summary.latestRows ?? [];
  if (latestRows.length) {
    const top = latestRows[0];
    const bottom = latestRows[latestRows.length - 1];
    setText('[data-caption="rent-latest"]', `${top.borough} leads 2024 at ${formatCurrency(top.median_rent)}, while ${bottom.borough} sits at ${formatCurrency(bottom.median_rent)}.`);
    setText(
      '[data-interpretation="rent-latest"]',
      `The resulting $${(top.median_rent - bottom.median_rent).toLocaleString()} spread keeps higher-income boroughs out of reach for households anchored in the Bronx and Queens.`
    );
  }

  const growth = summary.growth ?? {};
  const growthValues = Object.values(growth).filter(Boolean);
  if (growthValues.length) {
    const minGrowth = Math.min(...growthValues.map((g) => g.pct));
    const maxGrowth = Math.max(...growthValues.map((g) => g.pct));
    setText(
      '[data-caption="rent-trajectories"]',
      `Borough rents climbed between ${minGrowth.toFixed(1)}% and ${maxGrowth.toFixed(1)}% from 2010 to 2024.`
    );
    setText(
      '[data-interpretation="rent-trajectories"]',
      'Brooklyn and Queens show the steepest post-2012 slope, signaling where affordability stress accelerated the most.'
    );
  }

  const incomeCorrelation = summary.correlations?.rent_income;
  const transitCorrelation = summary.correlations?.rent_subway;
  if (Number.isFinite(incomeCorrelation) && Number.isFinite(transitCorrelation)) {
    setText(
      '[data-caption="rent-transit"]',
      `Across ${state.records.length} borough-year observations, rent tracks income closely (r = ${incomeCorrelation.toFixed(
        2
      )}) while transit access still shows a material relationship (r = ${transitCorrelation.toFixed(2)}).`
    );
    setText(
      '[data-interpretation="rent-transit"]',
      'Higher subway access pushes rents above income-only expectations, clustering Manhattan and Brooklyn in the top-right corner.'
    );
  }

  const yoyMatrix = prepareHeatmapDataset(heatmapData(records, 'rent_growth', summary.yoy));
  const pctValues = yoyMatrix.matrix.flat().filter((value) => Number.isFinite(value));
  if (pctValues.length) {
    const maxYoY = Math.max(...pctValues);
    setText(
      '[data-caption="rent-heatmap"]',
      `Year-over-year rent change peaks around ${maxYoY.toFixed(1)}%, with a second surge during the 2021 recovery.`
    );
    setText(
      '[data-interpretation="rent-heatmap"]',
      `Those pulses confirm that the post-pandemic rebound nearly matched the early-2010s spike, especially in the Bronx and Brooklyn.`
    );
  }
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
