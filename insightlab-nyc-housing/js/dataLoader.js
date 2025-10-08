import { cleanRecords } from './analysis.js';
import { embeddedRentRecords, embeddedBoroughMeta, embeddedSummaryTemplate } from './embeddedData.js';

async function fetchCSV(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Unable to fetch ${path}`);
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

async function fetchJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Unable to fetch ${path}`);
  return response.json();
}

export async function loadAllData() {
  const rawRecords = await safeLoad(() => fetchCSV('./data/nyc_median_rent.csv'), embeddedRentRecords);
  const boroughMeta = await safeLoad(() => fetchJSON('./data/nyc_borough_meta.json'), embeddedBoroughMeta);
  const baseSummary = await safeLoad(() => fetchJSON('./data/derived_summary.json'), embeddedSummaryTemplate);
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
