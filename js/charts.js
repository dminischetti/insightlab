import { groupByBorough } from './analysis.js';

const boroughPalette = {
  Manhattan: '#38bdf8',
  Brooklyn: '#0ea5e9',
  Queens: '#6366f1',
  Bronx: '#4f46e5',
  'Staten Island': '#312e81'
};

const chartStore = {
  bar: null,
  multiples: [],
  scatter: null,
  heatmap: null
};

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function withOpacity(hex, alpha) {
  const value = hex.replace('#', '');
  const bigint = parseInt(value, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function chartDefaults() {
  const gridColor = cssVar('--grid-line') || 'rgba(148,163,184,0.25)';
  const axisColor = cssVar('--fg-muted') || '#94a3b8';
  const labelColor = cssVar('--fg') || '#e2e8f0';
  return {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: 8 },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: labelColor, usePointStyle: true, pointStyle: 'circle' }
      },
      tooltip: {
        backgroundColor: cssVar('--bg-overlay') || 'rgba(15,23,42,0.92)',
        borderColor: cssVar('--border') || 'rgba(148,163,184,0.25)',
        borderWidth: 1,
        titleColor: '#f8fafc',
        bodyColor: '#f8fafc',
        padding: 12,
        displayColors: true
      }
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: axisColor, maxRotation: 0, autoSkipPadding: 12 }
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: axisColor }
      }
    }
  };
}

export function initBarChart(canvas, rows, year) {
  const ctx = canvas.getContext('2d');
  const dataset = {
    label: `Median rent (${year})`,
    data: rows.map((row) => row.median_rent),
    backgroundColor: rows.map((row) => withOpacity(boroughPalette[row.borough] ?? '#38bdf8', 0.85)),
    borderRadius: 14,
    borderSkipped: false
  };

  chartStore.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map((row) => row.borough),
      datasets: [dataset]
    },
    options: {
      ...chartDefaults(),
      plugins: {
        ...chartDefaults().plugins,
        legend: { display: false },
        tooltip: {
          ...chartDefaults().plugins.tooltip,
          callbacks: {
            label: (context) => `${context.label}: $${Number(context.raw).toLocaleString()}`
          }
        }
      },
      scales: {
        ...chartDefaults().scales,
        y: {
          ...chartDefaults().scales.y,
          beginAtZero: true,
          ticks: {
            ...chartDefaults().scales.y.ticks,
            callback: (value) => `$${Number(value).toLocaleString()}`
          }
        }
      }
    }
  });
  return chartStore.bar;
}

export function initLineMultiples(container, records, years, boroughs) {
  const grouped = groupByBorough(records);
  Object.values(grouped).forEach((rows) => rows.sort((a, b) => a.year - b.year));
  const yValues = records.map((row) => row.median_rent).filter((value) => Number.isFinite(value));
  const min = Math.min(...yValues);
  const max = Math.max(...yValues);
  container.innerHTML = '';
  chartStore.multiples = boroughs.map((borough) => {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute(
      'aria-label',
      `${borough} median rent trend from ${years[0]} to ${years[years.length - 1]}; steady climb with post-2012 lift.`
    );
    canvas.dataset.borough = borough;
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const dataset = {
      label: borough,
      data: years.map((year) => grouped[borough]?.find((row) => row.year === year)?.median_rent ?? null),
      borderColor: boroughPalette[borough] ?? '#38bdf8',
      backgroundColor: withOpacity(boroughPalette[borough] ?? '#38bdf8', 0.35),
      tension: 0.35,
      pointRadius: 0,
      spanGaps: true,
      fill: false
    };
    return new Chart(ctx, {
      type: 'line',
      data: { labels: years, datasets: [dataset] },
      options: {
        ...chartDefaults(),
        plugins: {
          ...chartDefaults().plugins,
          legend: { display: false },
          tooltip: {
            ...chartDefaults().plugins.tooltip,
            callbacks: {
              label: (context) => `$${Number(context.raw).toLocaleString()} (${context.label})`
            }
          }
        },
        scales: {
          x: {
            ...chartDefaults().scales.x,
            ticks: {
              ...chartDefaults().scales.x.ticks,
              maxTicksLimit: 5,
              autoSkipPadding: 16
            }
          },
          y: {
            ...chartDefaults().scales.y,
            min: min * 0.95,
            max: max * 1.05,
            ticks: {
              ...chartDefaults().scales.y.ticks,
              callback: (value) => `$${Number(value).toLocaleString()}`,
              maxTicksLimit: 4
            }
          }
        }
      }
    });
  });
  return chartStore.multiples;
}

export function initScatterChart(canvas, points) {
  const ctx = canvas.getContext('2d');
  const boroughs = [...new Set(points.map((point) => point.borough))];
  chartStore.scatter = new Chart(ctx, {
    type: 'bubble',
    data: {
      datasets: boroughs.map((borough) => ({
        label: borough,
        data: points.filter((point) => point.borough === borough),
        parsing: false,
        backgroundColor: withOpacity(boroughPalette[borough] ?? '#6366f1', 0.75),
        borderColor: boroughPalette[borough] ?? '#6366f1',
        borderWidth: 1.5
      }))
    },
    options: {
      ...chartDefaults(),
      scales: {
        x: {
          ...chartDefaults().scales.x,
          title: { display: true, text: 'Median household income (USD)', color: cssVar('--fg-muted') || '#94a3b8' },
          ticks: {
            ...chartDefaults().scales.x.ticks,
            callback: (value) => `$${Number(value).toLocaleString()}`
          }
        },
        y: {
          ...chartDefaults().scales.y,
          title: { display: true, text: 'Median rent (USD per month)', color: cssVar('--fg-muted') || '#94a3b8' },
          ticks: {
            ...chartDefaults().scales.y.ticks,
            callback: (value) => `$${Number(value).toLocaleString()}`
          }
        }
      },
      plugins: {
        ...chartDefaults().plugins,
        tooltip: {
          ...chartDefaults().plugins.tooltip,
          callbacks: {
            label: (context) => {
              const { raw } = context;
              return `${context.dataset.label} ${raw.year}: $${Number(raw.y).toLocaleString()} rent vs $${Number(raw.x).toLocaleString()} income (Transit ${raw.subway})`;
            }
          }
        }
      }
    }
  });
  return chartStore.scatter;
}

export function updateScatterChart(chart, points) {
  if (!chart) return;
  const boroughs = [...new Set(points.map((point) => point.borough))];
  chart.data.datasets = boroughs.map((borough) => ({
    label: borough,
    data: points.filter((point) => point.borough === borough),
    parsing: false,
    backgroundColor: withOpacity(boroughPalette[borough] ?? '#6366f1', 0.75),
    borderColor: boroughPalette[borough] ?? '#6366f1',
    borderWidth: 1.5
  }));
  chart.update();
}

export function initHeatmap(canvas, dataset) {
  chartStore.heatmap = {
    canvas,
    dataset
  };
  drawHeatmap();
  window.addEventListener('resize', drawHeatmap);
  return chartStore.heatmap;
}

function drawHeatmap() {
  const instance = chartStore.heatmap;
  if (!instance) return;
  const { canvas, dataset } = instance;
  const ratio = window.devicePixelRatio || 1;
  const ctx = canvas.getContext('2d');
  const { years, boroughs, matrix } = dataset;
  const paddingX = 70;
  const paddingY = 60;
  const width = canvas.clientWidth || canvas.offsetWidth || 600;
  const height = canvas.clientHeight || canvas.offsetHeight || 360;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const cellWidth = (width - paddingX) / years.length;
  const cellHeight = (height - paddingY) / boroughs.length;
  const allValues = matrix.flat().filter((value) => value !== null && value !== undefined);
  if (!allValues.length) return;
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const axisColor = cssVar('--fg-muted') || '#94a3b8';
  const textColor = cssVar('--fg') || '#e2e8f0';
  ctx.font = '12px Inter';
  ctx.fillStyle = axisColor;

  years.forEach((year, index) => {
    const textX = paddingX + index * cellWidth + cellWidth / 2 - 12;
    ctx.fillText(year, textX, 20);
  });

  boroughs.forEach((borough, index) => {
    ctx.fillText(borough, 10, paddingY + index * cellHeight + cellHeight / 1.7);
  });

  matrix.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (value === null || value === undefined) return;
      const t = (value - min) / (max - min || 1);
      const color = interpolateColor('#38bdf8', '#6366f1', t);
      ctx.fillStyle = color;
      const x = paddingX + columnIndex * cellWidth;
      const y = paddingY + rowIndex * cellHeight;
      ctx.fillRect(x, y, cellWidth - 6, cellHeight - 6);
      ctx.fillStyle = t > 0.55 ? '#0b1221' : textColor;
      ctx.fillText(`${Number(value).toFixed(1)}%`, x + 8, y + cellHeight / 1.7);
    });
  });
}

function interpolateColor(startHex, endHex, t) {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  const r = Math.round(start.r + (end.r - start.r) * t);
  const g = Math.round(start.g + (end.g - start.g) * t);
  const b = Math.round(start.b + (end.b - start.b) * t);
  return `rgba(${r}, ${g}, ${b}, 0.85)`;
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const bigint = parseInt(value, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

export function refreshThemes() {
  const defaults = chartDefaults();
  if (chartStore.bar) {
    chartStore.bar.options.scales = defaults.scales;
    chartStore.bar.options.plugins.tooltip = defaults.plugins.tooltip;
    chartStore.bar.update();
  }
  if (chartStore.multiples?.length) {
    chartStore.multiples.forEach((chart) => {
      chart.options.scales = {
        x: { ...defaults.scales.x, ticks: { ...defaults.scales.x.ticks, maxTicksLimit: 5, autoSkipPadding: 16 } },
        y: {
          ...defaults.scales.y,
          min: chart.options.scales.y.min,
          max: chart.options.scales.y.max,
          ticks: {
            ...defaults.scales.y.ticks,
            maxTicksLimit: chart.options.scales.y.ticks.maxTicksLimit,
            callback: (value) => `$${Number(value).toLocaleString()}`
          }
        }
      };
      chart.options.plugins.tooltip = defaults.plugins.tooltip;
      chart.update();
    });
  }
  if (chartStore.scatter) {
    chartStore.scatter.options.scales = defaults.scales;
    chartStore.scatter.options.plugins.tooltip = defaults.plugins.tooltip;
    chartStore.scatter.update();
  }
  drawHeatmap();
}
