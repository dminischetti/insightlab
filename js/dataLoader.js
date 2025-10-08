import { cleanRecords } from './analysis.js';

async function fetchCSV(path) {
  const response = await fetch(path);
  const text = await response.text();
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: reject
    });
  });
}

async function fetchJSON(path) {
  const response = await fetch(path);
  return response.json();
}

export async function loadAllData() {
  const [rawRecords, boroughMeta, baseSummary] = await Promise.all([
    fetchCSV('./data/nyc_median_rent.csv'),
    fetchJSON('./data/nyc_borough_meta.json'),
    fetchJSON('./data/derived_summary.json')
  ]);
  const records = cleanRecords(rawRecords);
  return { records, boroughMeta, baseSummary };
}
