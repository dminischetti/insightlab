import { cleanRecords } from './analysis.js';
import { embeddedRentRecords, embeddedBoroughMeta, embeddedSummary } from './embeddedData.js';

let papaModulePromise = null;

async function ensurePapa() {
  if (globalThis.Papa) return globalThis.Papa;
  if (!papaModulePromise) {
    papaModulePromise = import('https://cdn.jsdelivr.net/npm/papaparse@5.4.1/+esm')
      .then((mod) => mod.default ?? mod)
      .catch((error) => {
        console.error('Failed to load PapaParse from CDN', error);
        throw error;
      });
  }
  return papaModulePromise;
}

function resolveDataPath(file) {
  return new URL(`../data/${file}`, import.meta.url).href;
}

async function fetchCSV(file) {
  const url = resolveDataPath(file);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to fetch ${url}`);
  const text = await response.text();
  const Papa = await ensurePapa();
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      comments: '#',
      complete: (results) => resolve(results.data),
      error: reject
    });
  });
}

async function fetchJSON(file) {
  const url = resolveDataPath(file);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to fetch ${url}`);
  return response.json();
}

export async function loadAllData() {
  const rawRecords = await safeLoad(() => fetchCSV('nyc_median_rent.csv'), embeddedRentRecords);
  const boroughMeta = await safeLoad(() => fetchJSON('nyc_borough_meta.json'), embeddedBoroughMeta);
  const summaryPayload = await safeLoad(() => fetchJSON('derived_summary.json'), embeddedSummary);
  const vizPayload = await safeLoad(() => fetchJSON('viz_payload.json'), null);

  let recordsSource = Array.isArray(rawRecords) ? rawRecords : embeddedRentRecords;
  if (vizPayload?.series) {
    const expanded = expandRecordsFromViz(vizPayload);
    if (expanded.length) {
      recordsSource = expanded;
    }
  }

  const records = cleanRecords(recordsSource);
  const summary = normalizeSummary(summaryPayload, records);
  return { records, boroughMeta, summary, vizPayload };
}

async function safeLoad(loader, fallback) {
  try {
    return await loader();
  } catch (error) {
    console.warn('Falling back to embedded data because of', error?.message ?? error);
    return fallback;
  }
}

// Translate the JSON payload into the structure consumed elsewhere in the app.
function normalizeSummary(baseSummary, records) {
  if (!baseSummary) return null;
  const latestRows = Array.isArray(baseSummary.latest_rows)
    ? baseSummary.latest_rows.map((row) => ({
        borough: row.borough,
        median_rent: Number(row.median_rent),
        median_income: Number(row.median_income),
        subway_access_score: Number(row.subway_access_score ?? row.subwayAccessScore),
        air_quality_index: Number(row.air_quality_index ?? row.airQualityIndex),
        year: Number(row.year)
      }))
    : [];

  const regression = baseSummary.regression
    ? {
        ...baseSummary.regression,
        coefficients: renameCoefficient(baseSummary.regression.coefficients ?? {}),
        stderr: renameCoefficient(baseSummary.regression.stderr ?? {}),
        tvalues: renameCoefficient(baseSummary.regression.tvalues ?? {}),
        pvalues: renameCoefficient(baseSummary.regression.pvalues ?? {}),
        confidence_intervals: renameConfidence(baseSummary.regression.confidence_intervals ?? baseSummary.regression.conf_int ?? {})
      }
    : null;

  return {
    generatedAt: baseSummary.generated_at ?? new Date().toISOString(),
    latestYear: Number(baseSummary.latest_year ?? baseSummary.latestYear ?? (records?.length ? Math.max(...records.map((row) => row.year)) : NaN)),
    growth: baseSummary.rent_growth ?? baseSummary.growth ?? {},
    incomeGrowth: baseSummary.income_growth ?? baseSummary.incomeGrowth ?? {},
    yoy: baseSummary.yoy ?? {},
    latestRows,
    correlations: baseSummary.correlations ?? {},
    regression,
    disparity: baseSummary.disparity_index ?? baseSummary.disparity ?? {},
    headlines: baseSummary.headlines ?? []
  };
}

function renameCoefficient(mapper = {}) {
  if (!mapper) return {};
  const result = {};
  Object.entries(mapper).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === 'const') {
      result.intercept = Number(value);
    } else {
      result[key] = Number(value);
    }
  });
  return result;
}

function renameConfidence(conf = {}) {
  const renamed = {};
  Object.entries(conf).forEach(([key, value]) => {
    if (!value) return;
    const targetKey = key === 'const' ? 'intercept' : key;
    renamed[targetKey] = value;
  });
  return renamed;
}

// Expand the aggregated viz payload into record-shaped rows so downstream
// modules can reuse existing chart utilities without changes.
function expandRecordsFromViz(vizPayload) {
  const boroughs = vizPayload.boroughs ?? Object.keys(vizPayload.series ?? {});
  if (!boroughs || !vizPayload.series) return [];
  const rows = [];
  boroughs.forEach((borough) => {
    const series = vizPayload.series[borough];
    if (!series) return;
    const years = series.year ?? vizPayload.years ?? [];
    years.forEach((year, index) => {
      const rent = series.median_rent?.[index];
      const income = series.median_income?.[index];
      if (rent === undefined || income === undefined) return;
      rows.push({
        year: Number(year),
        borough,
        median_rent: Number(rent),
        median_income: Number(income),
        subway_access_score: Number(series.subway_access_score?.[index]),
        air_quality_index: Number(series.air_quality_index?.[index])
      });
    });
  });
  return rows;
}
