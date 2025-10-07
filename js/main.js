import { initThemeToggle } from './theme.js';
import { loadAllData } from './dataLoader.js';
import {
  summarize,
  filterRecords,
  latestMetrics,
  buildSummaryPayload
} from './analysis.js';
import { initBarChart, updateBarChart, initLineChart, updateLineChart, initScatterChart, updateScatterChart, initHeatmap, updateHeatmap, refreshThemes } from './charts.js';
import { initFilters } from './filters.js';
import { initScrolly, revealOnScroll } from './scrolly.js';
import { renderExecutiveSummary, applyNarrativeBlocks } from './narrative.js';

const state = {
  filters: null,
  summary: null,
  yoy: null,
  derivedPayload: null,
  records: [],
  boroughMeta: {}
};

async function bootstrap() {
  initThemeToggle(document.querySelector('[data-theme-toggle]'));

  const { records, boroughMeta, baseSummary } = await loadAllData();
  state.records = records;
  state.boroughMeta = boroughMeta;
  state.summary = summarize(records);
  state.yoy = state.summary.yoy;
  state.derivedPayload = buildSummaryPayload(baseSummary, state.summary);

  initialiseCharts(records);
  initialiseFilters(records);
  initialiseNarrative();
  initialiseScrolly();
  bindDownloads();
  updateHUD(state.filters);

  document.dispatchEvent(new CustomEvent('insightlab:ready'));
}

function initialiseCharts(records) {
  const barCtx = document.querySelector('#chart-bar');
  const lineCtx = document.querySelector('#chart-line');
  const scatterCtx = document.querySelector('#chart-scatter');
  const heatmapCanvas = document.querySelector('#chart-heatmap');

  const latestYear = state.summary.latestYear;
  const latestRows = filterRecords(records, { year: latestYear });
  const sortedLatest = [...latestRows].sort((a, b) => b.median_rent - a.median_rent);

  if (barCtx) initBarChart(barCtx, sortedLatest, latestYear);
  if (lineCtx) initLineChart(lineCtx, records);
  if (scatterCtx) initScatterChart(scatterCtx, records, Array.from(new Set(records.map((row) => row.borough))));
  if (heatmapCanvas) {
    heatmapCanvas.width = heatmapCanvas.clientWidth * window.devicePixelRatio;
    heatmapCanvas.height = 420 * window.devicePixelRatio;
    initHeatmap(heatmapCanvas, records, 'median_rent', state.yoy);
  }
}

function initialiseFilters(records) {
  state.filters = initFilters(records, {
    onChange: (filters) => {
      state.filters = filters;
      const filteredYearRows = filterRecords(records, { year: filters.year, boroughs: filters.boroughs });
      const sortedYearRows = [...filteredYearRows].sort((a, b) => b.median_rent - a.median_rent);
      updateBarChart(sortedYearRows, filters.year);
      updateLineChart(records, filters.boroughs);
      updateScatterChart(records, filters.boroughs);
      updateHeatmap(records, filters.metric, filters.metric === 'rent_growth' ? state.yoy : null);
      updateHUD(filters);
      applyNarrativeBlocks(records, filters);
      updateNarrativeList(filters);
    }
  });
}

function initialiseNarrative() {
  if (!state.filters) return;
  applyNarrativeBlocks(state.records, state.filters);
  updateNarrativeList(state.filters);
  renderExecutiveSummary(state.records, state.filters).forEach((line, idx) => {
    const target = document.querySelector(`[data-summary-item="${idx}"]`);
    if (target) target.innerHTML = line;
  });
}

function initialiseScrolly() {
  if (document.body.dataset.page !== 'index') return;
  initScrolly({
    onStepChange: (index) => {
      const indicator = document.querySelector('[data-hud-step]');
      if (indicator) indicator.textContent = index + 1;
    }
  });
  revealOnScroll('.chart-card, .step');
}

function bindDownloads() {
  const downloadCsv = document.querySelector('[data-download="csv"]');
  const downloadJson = document.querySelector('[data-download="json"]');
  const printButton = document.querySelector('[data-print]');

  downloadCsv?.addEventListener('click', () => {
    downloadFile('./data/nyc_median_rent.csv', 'nyc_median_rent.csv');
  });

  downloadJson?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.derivedPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'derived_summary.json');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  printButton?.addEventListener('click', () => window.print());
}

function downloadFile(path, name) {
  fetch(path)
    .then((response) => response.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      triggerDownload(url, name);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
}

function triggerDownload(url, name) {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function updateHUD(filters) {
  const yearTarget = document.querySelector('[data-hud-year]');
  const boroughTarget = document.querySelector('[data-hud-boroughs]');
  const spreadTarget = document.querySelector('[data-hud-spread]');
  const avgRentTarget = document.querySelector('[data-hud-avg-rent]');

  if (!filters) return;
  const year = filters.year;
  const boroughs = filters.boroughs;
  const metrics = latestMetrics(state.records, year, boroughs);

  if (yearTarget) yearTarget.textContent = year;
  if (boroughTarget) boroughTarget.textContent = boroughs.join(', ');
  if (spreadTarget && metrics.rank.length) {
    const top = metrics.rank[0];
    const bottom = metrics.rank[metrics.rank.length - 1];
    spreadTarget.textContent = `$${(top.median_rent - bottom.median_rent).toLocaleString()}`;
  }
  if (avgRentTarget && !Number.isNaN(metrics.averageRent)) {
    avgRentTarget.textContent = `$${Math.round(metrics.averageRent).toLocaleString()}`;
  }
}

function updateNarrativeList(filters) {
  const list = document.querySelector('[data-dynamic-narrative]');
  if (!list) return;
  const yearRows = filterRecords(state.records, { year: filters.year, boroughs: filters.boroughs });
  if (!yearRows.length) return;
  const best = [...yearRows].sort((a, b) => b.median_rent - a.median_rent)[0];
  const worst = [...yearRows].sort((a, b) => a.median_rent - b.median_rent)[0];
  list.innerHTML = `In ${filters.year}, <strong>${best.borough}</strong> tops the rent table at $${best.median_rent.toLocaleString()} while <strong>${worst.borough}</strong> anchors affordability at $${worst.median_rent.toLocaleString()}.`;
}

document.addEventListener('theme:change', () => {
  refreshThemes();
});

document.addEventListener('DOMContentLoaded', bootstrap);
