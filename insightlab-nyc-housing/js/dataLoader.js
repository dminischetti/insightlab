import { cleanRecords } from './analysis.js';
import { embeddedRentRecords, embeddedBoroughMeta, embeddedSummaryTemplate } from './embeddedData.js';

function resolveDataPath(file) {
  return new URL(`../data/${file}`, import.meta.url).href;
}

async function fetchCSV(file) {
  const url = resolveDataPath(file);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to fetch ${url}`);
  const text = await response.text();
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
  const baseSummary = await safeLoad(() => fetchJSON('derived_summary.json'), embeddedSummaryTemplate);
  const records = cleanRecords(Array.isArray(rawRecords) ? rawRecords : embeddedRentRecords);
  return { records, boroughMeta, baseSummary };
}

async function safeLoad(loader, fallback) {
  try {
    return await loader();
  } catch (error) {
    console.warn('Falling back to embedded data because of', error?.message ?? error);
    return fallback;
  }
}
