import { uniqueBoroughs, yearRange } from './analysis.js';

export function initFilters(records, callbacks = {}) {
  const state = {
    year: null,
    boroughs: [],
    metric: 'median_rent'
  };

  const yearInput = document.querySelector('#filter-year');
  const yearValueLabel = document.querySelector('[data-year-label]');
  const boroughSelect = document.querySelector('#filter-borough');
  const metricInputs = document.querySelectorAll('input[name="metric"]');
  const resetButton = document.querySelector('#filter-reset');

  if (!yearInput || !boroughSelect) return state;

  const { min, max } = yearRange(records);
  yearInput.min = String(min);
  yearInput.max = String(max);
  yearInput.value = String(max);
  yearInput.setAttribute('aria-valuenow', String(max));
  yearValueLabel.textContent = max;
  state.year = max;

  const boroughs = uniqueBoroughs(records);
  boroughSelect.innerHTML = '';
  boroughs.forEach((borough) => {
    const option = document.createElement('option');
    option.value = borough;
    option.textContent = borough;
    option.selected = true;
    boroughSelect.appendChild(option);
  });
  state.boroughs = [...boroughs];

  function emitChange() {
    callbacks.onChange?.({ ...state });
  }

  yearInput.addEventListener('input', (event) => {
    state.year = Number(event.target.value);
    yearValueLabel.textContent = state.year;
    yearInput.setAttribute('aria-valuenow', String(state.year));
    emitChange();
  });

  boroughSelect.addEventListener('change', () => {
    const selected = Array.from(boroughSelect.selectedOptions).map((option) => option.value);
    state.boroughs = selected.length ? selected : [...boroughs];
    emitChange();
  });

  metricInputs.forEach((input) => {
    if (input.checked) state.metric = input.value;
    input.addEventListener('change', () => {
      state.metric = input.value;
      emitChange();
    });
  });

  resetButton?.addEventListener('click', () => {
    yearInput.value = String(max);
    yearValueLabel.textContent = max;
    yearInput.setAttribute('aria-valuenow', String(max));
    state.year = max;
    state.boroughs = [...boroughs];
    Array.from(boroughSelect.options).forEach((option) => {
      option.selected = true;
    });
    const defaultMetric = document.querySelector('input[name="metric"][value="median_rent"]');
    if (defaultMetric) {
      defaultMetric.checked = true;
      state.metric = 'median_rent';
    }
    emitChange();
  });

  emitChange();
  return state;
}
