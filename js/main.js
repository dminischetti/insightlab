// main.js - Production-ready JavaScript that uses YOUR actual data

// Import enhancement modules
import { initInsightCards } from './insightCards.js';
import { addChartAnimations, observeChartAnimations } from './chartAnimations.js';
import { initShareableInsights } from './shareableInsights.js';

// =============================================================================
// CONSTANTS & STATE
// =============================================================================

const SCATTER_PERIODS = [
  { key: '2010-2013', start: 2010, end: 2013 },
  { key: '2014-2016', start: 2014, end: 2016 },
  { key: '2017-2020', start: 2017, end: 2020 },
  { key: '2021-2024', start: 2021, end: 2024 },
];

const STATE = {
  theme: localStorage.getItem('theme') || 'dark',
  chartInstances: new Map(),
  data: null,
  summary: null,
  counterObserver: null,
};

// =============================================================================
// DATA LOADING
// =============================================================================

const loadData = async () => {
  try {
    const [vizResponse, summaryResponse] = await Promise.all([
      fetch('./data/viz_payload.json').catch(() => null),
      fetch('./data/derived_summary.json').catch(() => null),
    ]);

    const vizPayload = vizResponse?.ok ? await vizResponse.json() : null;
    const summary = summaryResponse?.ok ? await summaryResponse.json() : null;

    if (!vizPayload) {
      console.warn('Visualization payload is missing; charts will remain placeholders.');
      return null;
    }

    const boroughs = vizPayload.boroughs ?? [];
    const years = vizPayload.years ?? [];

    const rentSeries = {};
    boroughs.forEach((borough) => {
      const rents = vizPayload.series?.[borough]?.median_rent ?? [];
      rentSeries[borough] = rents;
    });

    const rentData = {
      labels: boroughs,
      values: boroughs.map((borough) => {
        if (summary?.rent_growth?.[borough]?.endValue) {
          return summary.rent_growth[borough].endValue;
        }
        const rents = rentSeries[borough];
        return rents?.length ? rents[rents.length - 1] : 0;
      }),
      years,
      boroughs,
      series: rentSeries,
    };

    const scatterPoints = vizPayload.scatter ?? [];
    const scatterData = {};
    SCATTER_PERIODS.forEach(({ key }) => {
      scatterData[key] = [];
    });

    scatterPoints.forEach((point) => {
      if (!point || typeof point.year !== 'number') return;
      const enriched = {
        x: Number(point.x ?? 0),
        y: Number(point.y ?? 0),
        r: Number(point.r ?? 0),
        label: `${point.borough ?? 'Unknown'} ${point.year}`,
        borough: point.borough,
        year: point.year,
      };
      const period = SCATTER_PERIODS.find((range) => point.year >= range.start && point.year <= range.end);
      if (period) {
        scatterData[period.key].push(enriched);
      }
    });

    const heatmapSource = vizPayload.heatmap ?? {};
    const heatmapData = {
      years: heatmapSource.years ?? years,
      boroughs: heatmapSource.boroughs ?? boroughs,
      values: (heatmapSource.matrix ?? []).map((row = []) =>
        row.map((value) => (typeof value === 'number' ? value : 0))
      ),
    };

    STATE.data = { rentData, scatterData, heatmapData };
    STATE.summary = summary;

    return STATE.data;
  } catch (error) {
    console.warn('Could not load data files, charts will wait for data:', error);
    return null;
  }
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const animateCounter = (element, target, duration = 2000) => {
  const start = 0;
  const increment = target / (duration / 16 || 1);
  let current = start;

  const timer = setInterval(() => {
    current += increment;
    if ((increment >= 0 && current >= target) || (increment < 0 && current <= target)) {
      current = target;
      clearInterval(timer);
    }
    element.textContent = `+$${Math.round(current).toLocaleString()}`;
    element.dataset.counterAnimated = 'true';
  }, 16);
};

const getChartColors = (theme) => {
  const isDark = theme === 'dark';
  return {
    primary: isDark ? 'oklch(78% 0.15 195)' : 'oklch(62% 0.18 195)',
    secondary: isDark ? 'oklch(62% 0.22 270)' : 'oklch(55% 0.24 270)',
    text: isDark ? 'oklch(93% 0.01 250)' : 'oklch(20% 0.02 250)',
    textMuted: isDark ? 'oklch(68% 0.02 250)' : 'oklch(48% 0.02 250)',
    grid: isDark ? 'oklch(35% 0.02 250 / 0.2)' : 'oklch(85% 0.01 250 / 0.5)',
    background: isDark ? 'oklch(18% 0.02 250)' : 'oklch(98% 0.005 250)',
    boroughColors: [
      'oklch(78% 0.15 195)',
      'oklch(62% 0.22 270)',
      'oklch(75% 0.18 150)',
      'oklch(70% 0.20 60)',
      'oklch(65% 0.18 330)',
    ],
  };
};

const formatCurrency = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const sign = value >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString()}`;
};

const formatDifference = (value, suffix = '') => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}${suffix}`;
};

// =============================================================================
// THEME MANAGEMENT
// =============================================================================

const initTheme = () => {
  const toggle = document.querySelector('[data-theme-toggle]');
  const html = document.documentElement;

  const applyTheme = (theme) => {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    STATE.theme = theme;

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.content = theme === 'dark' ? '#0b1221' : '#f5f7fb';
    }

    refreshAllCharts();
  };

  toggle?.addEventListener('click', () => {
    const newTheme = STATE.theme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
  });

  applyTheme(STATE.theme);
};

// =============================================================================
// SCROLL PROGRESS & ANIMATIONS
// =============================================================================

const initScrollProgress = () => {
  const progressBar = document.getElementById('progress-bar');
  if (!progressBar) return;

  const updateProgress = () => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = window.scrollY;
    const progress = scrollHeight > 0 ? (scrolled / scrollHeight) * 100 : 0;
    progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  };

  window.addEventListener('scroll', debounce(updateProgress, 10), { passive: true });
  updateProgress();
};

const initScrollAnimations = () => {
  const elements = document.querySelectorAll('[data-animate]');
  if (!elements.length) return;

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.1,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  elements.forEach((el) => observer.observe(el));
};

// =============================================================================
// CHART INITIALIZATION - USES YOUR DATA
// =============================================================================

const createBarChart = (data) => {
  const canvas = document.getElementById('chart-bar');
  if (!canvas) return;

  if (!data) {
    console.warn('Bar chart waiting for data...');
    return;
  }

  const ctx = canvas.getContext('2d');
  const colors = getChartColors(STATE.theme);

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels || ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'],
      datasets: [
        {
          label: 'Median Rent (USD)',
          data: data.values || [],
          backgroundColor: colors.boroughColors,
          borderWidth: 0,
          borderRadius: 8,
        },
      ],
    },
    options: addChartAnimations({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.background,
          titleColor: colors.text,
          bodyColor: colors.textMuted,
          borderColor: colors.grid,
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            label: (context) => `$${context.parsed.y.toLocaleString()}/month`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: colors.textMuted,
            callback: (value) => `$${value.toLocaleString()}`,
          },
          grid: { color: colors.grid },
        },
        x: {
          ticks: { color: colors.textMuted },
          grid: { display: false },
        },
      },
    }, true),
  });

  STATE.chartInstances.set('bar', chart);
  canvas.setAttribute('data-loaded', 'true');
};

const createSmallMultiples = (data) => {
  const container = document.querySelector('[data-chart-multiples]');
  if (!container) return;

  if (!data) {
    console.warn('Small multiples waiting for data...');
    return;
  }

  const colors = getChartColors(STATE.theme);
  container.innerHTML = '';

  const boroughs = data.boroughs || Object.keys(data.series || {});

  boroughs.forEach((borough, index) => {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Rent trajectory for ${borough} from ${data.years?.[0] ?? 2010} to ${data.years?.slice(-1)[0] ?? 2024}`);
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const values = data.series?.[borough] || [];
    const years = data.years || Array.from({ length: values.length }, (_, i) => 2010 + i);

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: years,
        datasets: [
          {
            label: borough,
            data: values,
            borderColor: colors.boroughColors[index % colors.boroughColors.length],
            backgroundColor: `${colors.boroughColors[index % colors.boroughColors.length]}20`,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { color: colors.text, font: { size: 11, weight: '600' } },
          },
          tooltip: {
            backgroundColor: colors.background,
            titleColor: colors.text,
            bodyColor: colors.textMuted,
            borderColor: colors.grid,
            borderWidth: 1,
            padding: 8,
            displayColors: false,
            callbacks: {
              label: (context) => `$${context.parsed.y.toLocaleString()}`,
            },
          },
        },
        scales: {
          y: {
            ticks: {
              color: colors.textMuted,
              font: { size: 10 },
              callback: (value) => `$${(value / 1000).toFixed(1)}k`,
            },
            grid: { color: colors.grid },
          },
          x: {
            ticks: {
              color: colors.textMuted,
              font: { size: 9 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 5,
            },
            grid: { display: false },
          },
        },
      },
    });

    STATE.chartInstances.set(`multiple-${borough}`, chart);
    canvas.setAttribute('data-loaded', 'true');
  });
};

const createScatterChart = (data, period = SCATTER_PERIODS[0].key) => {
  const canvas = document.getElementById('chart-scatter');
  if (!canvas) return;

  if (!data) {
    console.warn('Scatter chart waiting for data...');
    return;
  }

  if (STATE.chartInstances.has('scatter')) {
    STATE.chartInstances.get('scatter').destroy();
  }

  const ctx = canvas.getContext('2d');
  const colors = getChartColors(STATE.theme);

  const periodData = data[period] || [];

  const chart = new Chart(ctx, {
    type: 'bubble',
    data: {
      datasets: [
        {
          label: 'Borough Data',
          data: periodData,
          backgroundColor: colors.boroughColors.map((c) => `${c}60`),
          borderColor: colors.boroughColors,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.background,
          titleColor: colors.text,
          bodyColor: colors.textMuted,
          borderColor: colors.grid,
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            title: (context) => periodData[context[0].dataIndex]?.label ?? '',
            label: (context) => [
              `Income: $${context.parsed.x.toLocaleString()}`,
              `Rent: $${context.parsed.y.toLocaleString()}`,
              `Transit: ${Math.round((context.raw.r / 90) * 100)} index`,
            ],
          },
        },
      },
      scales: {
        y: {
          title: {
            display: true,
            text: 'Median Rent (USD/month)',
            color: colors.text,
          },
          ticks: {
            color: colors.textMuted,
            callback: (value) => `$${(value / 1000).toFixed(1)}k`,
          },
          grid: { color: colors.grid },
        },
        x: {
          title: {
            display: true,
            text: 'Median Household Income (USD/year)',
            color: colors.text,
          },
          ticks: {
            color: colors.textMuted,
            callback: (value) => `$${(value / 1000).toFixed(0)}k`,
          },
          grid: { color: colors.grid },
        },
      },
    },
  });

  STATE.chartInstances.set('scatter', chart);
  canvas.setAttribute('data-loaded', 'true');
};

const createHeatmapChart = (data) => {
  const canvas = document.getElementById('chart-heatmap');
  if (!canvas) return;

  if (!data) {
    console.warn('Heatmap chart waiting for data...');
    return;
  }

  const ctx = canvas.getContext('2d');
  const colors = getChartColors(STATE.theme);

  const years = data.years || [];
  const boroughs = data.boroughs || [];
  const values = data.values || [];

  const getColor = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value) || value === 0) {
      return 'oklch(50% 0.02 250 / 0.25)';
    }
    const intensity = Math.min(Math.abs(value) / 8, 1.5);
    if (value > 0) {
      return `oklch(${70 - intensity * 20}% ${0.15 + intensity * 0.1} 60 / ${0.45 + intensity * 0.4})`;
    }
    return `oklch(${70 - intensity * 20}% ${0.15 + intensity * 0.1} 270 / ${0.45 + intensity * 0.4})`;
  };

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: years,
      datasets: boroughs.map((borough, idx) => ({
        label: borough,
        data: values[idx] || [],
        backgroundColor: (values[idx] || []).map((v) => getColor(v)),
        borderWidth: 1,
        borderColor: colors.background,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: colors.text,
            font: { size: 11 },
            boxWidth: 12,
            padding: 10,
          },
        },
        tooltip: {
          backgroundColor: colors.background,
          titleColor: colors.text,
          bodyColor: colors.textMuted,
          borderColor: colors.grid,
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (context) => `${context.dataset.label}: ${context.parsed.y > 0 ? '+' : ''}${context.parsed.y.toFixed(1)}%`,
          },
        },
      },
      scales: {
        y: {
          stacked: false,
          ticks: {
            color: colors.textMuted,
            callback: (value) => `${value}%`,
          },
          grid: { color: colors.grid },
        },
        x: {
          stacked: false,
          ticks: {
            color: colors.textMuted,
            maxRotation: 45,
            minRotation: 45,
          },
          grid: { display: false },
        },
      },
    },
  });

  STATE.chartInstances.set('heatmap', chart);
  canvas.setAttribute('data-loaded', 'true');
};

const initChartTabs = () => {
  const tabs = document.querySelectorAll('[data-period-tab]');
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      const period = tab.getAttribute('data-period-tab');
      createScatterChart(STATE.data?.scatterData, period);
    });
  });
};

const refreshAllCharts = () => {
  STATE.chartInstances.forEach((chart) => chart.destroy());
  STATE.chartInstances.clear();

  setTimeout(() => {
    if (STATE.data) {
      createBarChart(STATE.data.rentData);
      createSmallMultiples(STATE.data.rentData);
      const activePeriod =
        document.querySelector('[data-period-tab].is-active')?.getAttribute('data-period-tab') || SCATTER_PERIODS[0].key;
      createScatterChart(STATE.data.scatterData, activePeriod);
      createHeatmapChart(STATE.data.heatmapData);
    }
  }, 100);
};

// =============================================================================
// KPI & COUNTER ANIMATIONS - CALCULATES FROM YOUR DATA
// =============================================================================

const initKPIs = () => {
  const kpis = {
    'rent-delta': '—',
    'wage-gap': '—',
    'volatility-hotspots': '—',
  };

  Object.entries(kpis).forEach(([key, value]) => {
    const element = document.querySelector(`[data-kpi="${key}"]`);
    if (element) {
      element.textContent = value;
    }
  });

  const counterElement = document.querySelector('[data-counter-value]');
  if (counterElement) {
    counterElement.dataset.counterTarget = '0';
    counterElement.dataset.counterAnimated = 'false';
    STATE.counterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = Number(counterElement.dataset.counterTarget || '0');
          animateCounter(counterElement, target, 2000);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    STATE.counterObserver.observe(counterElement);
  }
};

const updateKPIs = () => {
  const summary = STATE.summary;
  const rentData = STATE.data?.rentData;

  const rentDeltaEl = document.querySelector('[data-kpi="rent-delta"]');
  if (rentDeltaEl && summary?.rent_growth) {
    const absoluteChanges = Object.values(summary.rent_growth).map((entry) => entry?.absolute ?? 0);
    const avgChange = absoluteChanges.length
      ? absoluteChanges.reduce((acc, value) => acc + value, 0) / absoluteChanges.length
      : null;
    rentDeltaEl.textContent = avgChange ? formatCurrency(avgChange) : '—';
  }

  const wageGapEl = document.querySelector('[data-kpi="wage-gap"]');
  if (wageGapEl && summary?.rent_growth && summary?.income_growth) {
    const rentPct = Object.values(summary.rent_growth).map((entry) => entry?.pct ?? 0);
    const incomePct = Object.values(summary.income_growth).map((entry) => entry?.pct ?? 0);
    const avgRentPct = rentPct.length
      ? rentPct.reduce((acc, value) => acc + value, 0) / rentPct.length
      : null;
    const avgIncomePct = incomePct.length
      ? incomePct.reduce((acc, value) => acc + value, 0) / incomePct.length
      : null;
    if (avgRentPct !== null && avgIncomePct !== null) {
      wageGapEl.textContent = formatDifference(avgRentPct - avgIncomePct, ' pts');
    }
  }

  const volatilityEl = document.querySelector('[data-kpi="volatility-hotspots"]');
  if (volatilityEl && STATE.data?.heatmapData?.values) {
    const threshold = 6;
    const hotspots = STATE.data.heatmapData.values.reduce((total, row) => (
      total + row.filter((value) => Math.abs(value) >= threshold).length
    ), 0);
    volatilityEl.textContent = hotspots ? hotspots.toString() : '—';
  }

  const counterElement = document.querySelector('[data-counter-value]');
  if (counterElement && summary?.disparity_index) {
    const years = Object.keys(summary.disparity_index).map((year) => Number(year)).sort((a, b) => a - b);
    if (years.length) {
      const firstSpread = summary.disparity_index[years[0]]?.spread ?? 0;
      const lastSpread = summary.disparity_index[years[years.length - 1]]?.spread ?? 0;
      const delta = lastSpread - firstSpread;
      counterElement.dataset.counterTarget = String(delta);
      if (counterElement.dataset.counterAnimated === 'true') {
        counterElement.textContent = `+$${Math.round(delta).toLocaleString()}`;
      }
    }
  }

  const contextStat = document.querySelector('[data-context-stat]');
  if (contextStat && summary?.disparity_index) {
    const years = Object.keys(summary.disparity_index).map((year) => Number(year));
    const span = years.length ? Math.max(...years) - Math.min(...years) + 1 : 0;
    if (span) {
      contextStat.textContent = `Analyzing ${span} years of borough-level data across ${rentData?.labels?.length ?? 5} NYC boroughs.`;
    }
  }
};

// =============================================================================
// SMOOTH SCROLL & NAVIGATION
// =============================================================================

const initSmoothScroll = () => {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (!href || href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus({ preventScroll: true });
    });
  });
};

// =============================================================================
// KEYBOARD NAVIGATION
// =============================================================================

const initKeyboardNav = () => {
  const tabLists = document.querySelectorAll('[role="tablist"]');

  tabLists.forEach((tabList) => {
    const tabs = Array.from(tabList.querySelectorAll('[role="tab"]'));

    tabList.addEventListener('keydown', (e) => {
      const currentIndex = tabs.indexOf(document.activeElement);
      let nextIndex = currentIndex;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          nextIndex = (currentIndex + 1) % tabs.length;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      const targetTab = tabs[nextIndex];
      targetTab.focus();
      targetTab.click();
    });
  });
};

// =============================================================================
// ERROR HANDLING
// =============================================================================

const initErrorHandling = () => {
  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
  });
};

// =============================================================================
// INITIALIZATION
// =============================================================================

const init = async () => {
  try {
    initTheme();
    initScrollProgress();
    initScrollAnimations();
    initSmoothScroll();
    initKeyboardNav();
    initKPIs();
    initErrorHandling();

    await loadData();

    if (typeof Chart !== 'undefined') {
      requestAnimationFrame(() => {
        if (STATE.data) {
          createBarChart(STATE.data.rentData);
          createSmallMultiples(STATE.data.rentData);
          createScatterChart(STATE.data.scatterData, SCATTER_PERIODS[0].key);
          createHeatmapChart(STATE.data.heatmapData);
          
          // Initialize insight cards, chart animations, and share buttons after charts are rendered
          setTimeout(() => {
            initInsightCards();
            observeChartAnimations();
            initShareableInsights();
          }, 500);
          initChartTabs();
          updateKPIs();
        } else {
          console.warn('Charts waiting for data to be provided');
        }
      });
    } else {
      console.warn('Chart.js not loaded');
    }

    console.log('NYC Housing Dynamics initialized successfully');
  } catch (error) {
    console.error('Initialization error:', error);
  }
};

// =============================================================================
// DOM READY
// =============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// =============================================================================
// EXPORTS & GLOBAL ACCESS
// =============================================================================

window.nycHousing = {
  loadChartData: (rentData, scatterData, heatmapData, summary = null) => {
    STATE.data = { rentData, scatterData, heatmapData };
    STATE.summary = summary;
    refreshAllCharts();
    updateKPIs();
  },
  STATE,
  refreshAllCharts,
};

export { init, STATE, refreshAllCharts };
