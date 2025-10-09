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

const dataUrl = (file) => new URL(`../data/${file}`, import.meta.url).href;

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
  updateKeyTakeaways(state.filters);
  updateDerivedInsights(state.filters);

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
      updateKeyTakeaways(filters);
      updateDerivedInsights(filters);
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
  updateDerivedInsights(state.filters);
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
    downloadFile(dataUrl('nyc_median_rent.csv'), 'nyc_median_rent.csv');
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

function updateKeyTakeaways(filters) {
  if (!filters || !state.summary) return;
  const { growth, incomeGrowth, disparity, correlations, yoy } = state.summary;
  const boroughUniverse = filters.boroughs.length ? filters.boroughs : Object.keys(growth);
  const rankedGrowth = boroughUniverse
    .map((borough) => ({
      borough,
      rent: growth[borough]?.pct ?? 0,
      income: incomeGrowth[borough]?.pct ?? 0,
      detail: growth[borough]
    }))
    .filter((entry) => entry.detail)
    .sort((a, b) => b.rent - a.rent);

  const leader = rankedGrowth[0];
  const rentOutpace = leader ? leader.rent - leader.income : null;
  const paceDescriptor = rentOutpace !== null && rentOutpace < 0 ? 'trailing' : 'outpacing';
  const paceMagnitude = rentOutpace !== null ? Math.abs(rentOutpace).toFixed(1) : '0.0';
  const rentMessage = leader
    ? `From ${leader.detail.startYear} to ${leader.detail.endYear}, <strong>${leader.borough}</strong> rents advanced <strong>${leader.rent.toFixed(1)}%</strong>, ${paceDescriptor} income by <strong>${paceMagnitude} points</strong>.`
    : 'Adjust filters to surface a borough with complete rent and income history.';
  document.querySelectorAll('[data-takeaway="bar"]').forEach((node) => {
    node.innerHTML = rentMessage;
  });

  const yearSpread = disparity[filters.year];
  const baseSpreadYear = leader?.detail?.startYear ?? filters.year;
  const baseSpread = disparity[baseSpreadYear]?.spread ?? yearSpread?.spread ?? 0;
  const spreadDelta = yearSpread && baseSpread !== null ? yearSpread.spread - baseSpread : null;
  const spreadDirection = spreadDelta !== null && spreadDelta < 0 ? 'narrowed' : 'widened';
  const spreadMagnitude = spreadDelta !== null ? Math.abs(spreadDelta).toLocaleString() : '0';
  const spreadMessage = yearSpread
    ? `In ${filters.year}, the rent spread across the selection spans <strong>$${yearSpread.min.toLocaleString()}–$${yearSpread.max.toLocaleString()}</strong>; the gap has ${spreadDirection} by <strong>$${spreadMagnitude}</strong> since ${baseSpreadYear}.`
    : 'Spread metrics activate once a full year of data is available.';
  document.querySelectorAll('[data-takeaway="line"]').forEach((node) => {
    node.innerHTML = spreadMessage;
  });

  const transitR = correlations.rent_subway ?? 0;
  const transitR2 = Math.round(Math.pow(transitR, 2) * 1000) / 10;
  const corrMessage = `Transit proximity alone explains roughly <strong>${transitR2.toFixed(1)}%</strong> of rent variation (r=${transitR.toFixed(2)}), underscoring why stations anchor pricing tiers.`;
  document.querySelectorAll('[data-takeaway="scatter"]').forEach((node) => {
    node.innerHTML = corrMessage;
  });

  const yoyEntries = boroughUniverse
    .map((borough) => ({
      borough,
      change: yoy[borough]?.find((entry) => entry.year === filters.year)?.pct ?? null
    }))
    .filter((entry) => entry.change !== null);
  const heatLead = yoyEntries.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];
  const heatMessage = heatLead
    ? `${heatLead.change >= 0 ? 'Growth' : 'Pullback'} in ${filters.year} peaked in <strong>${heatLead.borough}</strong> at <strong>${heatLead.change.toFixed(1)}%</strong>, a pulse clearly visible in the matrix.`
    : 'Year-over-year pulses begin in 2011 once two full observations exist.';
  document.querySelectorAll('[data-takeaway="heatmap"]').forEach((node) => {
    node.innerHTML = heatMessage;
  });
}

function updateDerivedInsights(filters) {
  if (!state.summary) return;
  const { correlations, regression } = state.summary;
  const transitR = correlations.rent_subway ?? 0;
  const transitShare = Math.round(Math.pow(transitR, 2) * 1000) / 10;
  const regressionR2 = regression?.r2 ?? null;
  const betaIncome = regression?.coefficients?.income ?? null;
  const betaSubway = regression?.coefficients?.subway ?? null;

  const transitLine = `Transit proximity explains about <strong>${transitShare.toFixed(1)}%</strong> of cross-borough rent variance, reinforcing that subway access is a quantifiable premium.`;
  const regressionLine = regressionR2 !== null
    ? `The three-factor model covering 2019–${filters?.year ?? state.summary.latestYear} achieves <strong>R²=${regressionR2.toFixed(3)}</strong>, with income (β=${(betaIncome ?? 0).toFixed(4)}) edging subway access (β=${(betaSubway ?? 0).toFixed(4)}) as the strongest levers.`
    : 'Regression metrics load once five or more recent observations are present.';

  document.querySelectorAll('[data-derived="transit"]').forEach((node) => {
    node.innerHTML = transitLine;
  });
  document.querySelectorAll('[data-derived="regression"]').forEach((node) => {
    node.innerHTML = regressionLine;
  });
}

document.addEventListener('theme:change', () => {
  refreshThemes();
});

document.addEventListener('DOMContentLoaded', bootstrap);
