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
  boroughMeta: {},
  totalBoroughs: 0 // Stores dataset breadth for HUD copy changes.
};

let heatmapResizeBound = false;
let heatmapResizeFrame = null;
let activeNavTarget = null;
let heroInsightTimer = null;

const dataUrl = (file) => new URL(`../data/${file}`, import.meta.url).href;

async function bootstrap() {
  initThemeToggle(document.querySelector('[data-theme-toggle]'));
  document.body.classList.add('compact-mode');
  initQuickNav();
  initLayoutToggle();
  observeSections();
  initBackToTop();
  initProgressBar();

  const { records, boroughMeta, baseSummary } = await loadAllData();
  state.records = records;
  state.boroughMeta = boroughMeta;
  state.totalBoroughs = Object.keys(boroughMeta ?? {}).length;
  state.summary = summarize(records);
  state.yoy = state.summary.yoy;
  state.derivedPayload = buildSummaryPayload(baseSummary, state.summary);

  initialiseCharts(records);
  initialiseFilters(records);
  initialiseNarrative();
  initHeroInsight();
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
    initHeatmap(heatmapCanvas, records, 'median_rent', state.yoy);
    scheduleHeatmapResize();
    bindHeatmapResize();
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
      scheduleHeatmapResize();
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
  revealOnScroll('.chart-card, .step, .chart-frame');
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

function bindHeatmapResize() {
  if (heatmapResizeBound) return;
  heatmapResizeBound = true;
  window.addEventListener('resize', () => scheduleHeatmapResize());
}

function scheduleHeatmapResize() {
  if (heatmapResizeFrame) cancelAnimationFrame(heatmapResizeFrame);
  heatmapResizeFrame = requestAnimationFrame(() => {
    if (!state.records.length) return;
    const metric = state.filters?.metric ?? 'median_rent';
    const payload = metric === 'rent_growth' ? state.yoy : null;
    updateHeatmap(state.records, metric, payload);
    heatmapResizeFrame = null;
  });
}

function initQuickNav() {
  document.querySelectorAll('[data-scroll-target]').forEach((control) => {
    control.addEventListener('click', (event) => {
      const targetSelector = control.dataset.scrollTarget;
      if (!targetSelector) return;
      const target = document.querySelector(targetSelector);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveNav(targetSelector);
    });
  });
}

function initLayoutToggle() {
  const toggle = document.querySelector('[data-layout-toggle]');
  if (!toggle) return;
  toggle.setAttribute('aria-pressed', String(document.body.classList.contains('compact-mode')));
  toggle.addEventListener('click', () => {
    const compact = document.body.classList.toggle('compact-mode');
    toggle.setAttribute('aria-pressed', String(compact));
    scheduleHeatmapResize();
  });
}

function initBackToTop() {
  const backTop = document.getElementById('back-top');
  if (!backTop) return;
  const toggleVisibility = () => {
    if (window.scrollY > 320) {
      backTop.classList.add('is-visible');
    } else {
      backTop.classList.remove('is-visible');
    }
  };
  window.addEventListener('scroll', toggleVisibility, { passive: true });
  toggleVisibility();
  backTop.addEventListener('click', () =>
    window.scrollTo({ top: 0, behavior: 'smooth' })
  );
}

function initProgressBar() {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  const update = () => {
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    const ratio = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    bar.style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

function initHeroInsight() {
  const valueNode = document.querySelector('[data-hero-insight-value]');
  const labelNode = document.querySelector('[data-hero-insight-label]');
  if (!valueNode || !labelNode || !state.summary) return;

  if (heroInsightTimer) {
    clearInterval(heroInsightTimer);
    heroInsightTimer = null;
  }

  const insights = [];
  const disparityEntries = Object.entries(state.summary.disparity ?? {});
  if (disparityEntries.length) {
    const latestSpreadYear = Math.max(...disparityEntries.map(([year]) => Number(year)));
    const latestSpread = state.summary.disparity?.[latestSpreadYear];
    if (latestSpread && Number.isFinite(latestSpread.spread)) {
      insights.push({
        value: `$${Math.round(latestSpread.spread).toLocaleString()}`,
        label: `Rent spread across boroughs in ${latestSpreadYear}`
      });
    }
  }

  const growthEntries = Object.entries(state.summary.growth ?? {})
    .filter(([, meta]) => meta && Number.isFinite(meta.pct))
    .sort((a, b) => b[1].pct - a[1].pct);
  if (growthEntries.length) {
    const [borough, meta] = growthEntries[0];
    insights.push({
      value: `${meta.pct.toFixed(1)}%`,
      label: `${borough} rent growth since ${meta.startYear}`
    });
  }

  const transitR = state.summary.correlations?.rent_subway;
  if (Number.isFinite(transitR)) {
    insights.push({
      value: transitR.toFixed(2),
      label: 'Transit vs. rent correlation (r)'
    });
  }

  const regressionR2 = state.summary.regression?.r2;
  if (Number.isFinite(regressionR2)) {
    insights.push({
      value: regressionR2.toFixed(2),
      label: 'Three-factor model R²'
    });
  }

  if (!insights.length) {
    insights.push({ value: 'Loading', label: 'Insights will appear shortly' });
  }

  let index = 0;
  const render = () => {
    const current = insights[index];
    valueNode.textContent = current.value;
    labelNode.textContent = current.label;
  };

  render();

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduceMotion.matches || insights.length === 1) {
    return;
  }

  heroInsightTimer = window.setInterval(() => {
    index = (index + 1) % insights.length;
    render();
  }, 1000);
}

function observeSections() {
  const sections = document.querySelectorAll('[data-nav-section][id]');
  if (!sections.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length) {
        setActiveNav(`#${visible[0].target.id}`);
      }
    },
    {
      rootMargin: '-40% 0px -50% 0px',
      threshold: 0.2
    }
  );
  sections.forEach((section) => observer.observe(section));
}

function setActiveNav(targetSelector) {
  if (activeNavTarget === targetSelector) return;
  activeNavTarget = targetSelector;
  document.querySelectorAll('[data-scroll-target]').forEach((button) => {
    if (button.dataset.scrollTarget === targetSelector) {
      button.setAttribute('aria-current', 'true');
    } else {
      button.removeAttribute('aria-current');
    }
  });
}

function updateHUD(filters) {
  const yearTarget = document.querySelector('[data-hud-year]');
  const boroughTarget = document.querySelector('[data-hud-boroughs]');
  const spreadTarget = document.querySelector('[data-hud-spread]');
  const avgRentTarget = document.querySelector('[data-hud-avg-rent]');

  if (!filters) return;
  const year = filters.year;
  const boroughs = filters.boroughs?.length ? filters.boroughs : Object.keys(state.summary?.growth ?? {});
  const boroughCount = boroughs.length;
  const metrics = latestMetrics(state.records, year, boroughs);

  if (yearTarget) yearTarget.textContent = year;
  if (boroughTarget) {
    if (state.totalBoroughs && boroughCount === state.totalBoroughs) {
      boroughTarget.textContent = 'All boroughs';
    } else {
      boroughTarget.textContent = boroughs.join(', ');
    }
  }
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
