import { uniqueYears, groupByBorough, filterRecords, compileScatter, heatmapData } from './analysis.js';

const boroughColors = {
  Manhattan: '#f97316',
  Brooklyn: '#6366f1',
  Queens: '#22d3ee',
  Bronx: '#facc15',
  'Staten Island': '#38bdf8'
};

const charts = {
  bar: null,
  line: null,
  scatter: null,
  heatmap: null
};

function withOpacity(hex, opacity) {
  const bigint = parseInt(hex.replace('#', ''), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function chartDefaults() {
  return {
    plugins: {
      legend: {
        labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--fg') }
      },
      tooltip: {
        backgroundColor: withOpacity('#0f172a', document.body.classList.contains('light-mode') ? 0.85 : 0.92),
        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--border'),
        borderWidth: 1,
        padding: 12,
        titleColor: '#f8fafc',
        bodyColor: '#f8fafc',
        displayColors: true
      }
    },
    scales: {
      x: {
        grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid') },
        ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--fg-muted') }
      },
      y: {
        grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid') },
        ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--fg-muted') }
      }
    }
  };
}

export function initBarChart(ctx, initialData, year) {
  const config = {
    type: 'bar',
    data: {
      labels: initialData.map((row) => row.borough),
      datasets: [
        {
          label: `Median Rent (${year})`,
          data: initialData.map((row) => row.median_rent),
          backgroundColor: initialData.map((row) => withOpacity(boroughColors[row.borough], 0.85)),
          borderRadius: 12
        }
      ]
    },
    options: {
      ...chartDefaults(),
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        ...chartDefaults().plugins,
        legend: { display: false },
        tooltip: {
          ...chartDefaults().plugins.tooltip,
          callbacks: {
            label: (ctx) => `${ctx.label}: $${Number(ctx.raw).toLocaleString()}`
          }
        }
      },
      scales: {
        ...chartDefaults().scales,
        y: {
          ...chartDefaults().scales.y,
          beginAtZero: true
        }
      }
    }
  };
  charts.bar = new Chart(ctx, config);
  return charts.bar;
}

export function updateBarChart(data, year) {
  if (!charts.bar) return;
  charts.bar.data.labels = data.map((row) => row.borough);
  charts.bar.data.datasets[0].label = `Median Rent (${year})`;
  charts.bar.data.datasets[0].data = data.map((row) => row.median_rent);
  charts.bar.data.datasets[0].backgroundColor = data.map((row) => withOpacity(boroughColors[row.borough], 0.85));
  charts.bar.update();
}

export function initLineChart(ctx, records) {
  const years = uniqueYears(records);
  const grouped = groupByBorough(records);
  const datasets = Object.entries(grouped).map(([borough, rows]) => ({
    label: borough,
    data: years.map((year) => {
      const entry = rows.find((row) => row.year === year);
      return entry ? entry.median_rent : null;
    }),
    borderColor: boroughColors[borough],
    backgroundColor: withOpacity(boroughColors[borough], 0.35),
    tension: 0.35,
    spanGaps: true
  }));

  const config = {
    type: 'line',
    data: { labels: years, datasets },
    options: {
      ...chartDefaults(),
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        ...chartDefaults().plugins,
        tooltip: {
          ...chartDefaults().plugins.tooltip,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: $${Number(ctx.raw).toLocaleString()} (${ctx.label})`
          }
        }
      },
      scales: {
        ...chartDefaults().scales,
        y: {
          ...chartDefaults().scales.y,
          beginAtZero: false
        }
      }
    }
  };
  charts.line = new Chart(ctx, config);
  return charts.line;
}

export function updateLineChart(records, boroughs) {
  if (!charts.line) return;
  const years = uniqueYears(records);
  charts.line.data.labels = years;
  charts.line.data.datasets = boroughs.map((borough) => ({
    label: borough,
    data: years.map((year) => {
      const match = records.find((row) => row.year === year && row.borough === borough);
      return match ? match.median_rent : null;
    }),
    borderColor: boroughColors[borough],
    backgroundColor: withOpacity(boroughColors[borough], 0.3),
    tension: 0.35,
    spanGaps: true
  }));
  charts.line.update();
}

export function initScatterChart(ctx, records, boroughs) {
  const points = compileScatter(records, boroughs);
  const config = {
    type: 'bubble',
    data: {
      datasets: boroughs.map((borough) => ({
        label: borough,
        data: points.filter((point) => point.borough === borough),
        backgroundColor: withOpacity(boroughColors[borough], 0.8),
        borderColor: boroughColors[borough],
        borderWidth: 1
      }))
    },
    options: {
      ...chartDefaults(),
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        ...chartDefaults().scales,
        x: {
          ...chartDefaults().scales.x,
          title: { display: true, text: 'Median Household Income (USD)', color: getComputedStyle(document.documentElement).getPropertyValue('--fg-muted') }
        },
        y: {
          ...chartDefaults().scales.y,
          title: { display: true, text: 'Median Rent (USD)', color: getComputedStyle(document.documentElement).getPropertyValue('--fg-muted') }
        }
      },
      plugins: {
        ...chartDefaults().plugins,
        tooltip: {
          ...chartDefaults().plugins.tooltip,
          callbacks: {
            label: (ctx) => {
              const data = ctx.raw;
              return `${ctx.dataset.label} • ${data.year}: $${Number(data.y).toLocaleString()} rent vs $${Number(data.x).toLocaleString()} income (Subway ${data.subway}, AQI ${data.airQuality})`;
            }
          }
        }
      }
    }
  };
  charts.scatter = new Chart(ctx, config);
  return charts.scatter;
}

export function updateScatterChart(records, boroughs) {
  if (!charts.scatter) return;
  const points = compileScatter(records, boroughs);
  charts.scatter.data.datasets = boroughs.map((borough) => ({
    label: borough,
    data: points.filter((point) => point.borough === borough),
    backgroundColor: withOpacity(boroughColors[borough], 0.8),
    borderColor: boroughColors[borough],
    borderWidth: 1
  }));
  charts.scatter.update();
}

export function initHeatmap(canvas, records, metric = 'median_rent', yoy = null) {
  resizeCanvas(canvas);
  charts.heatmap = {
    canvas,
    ctx: canvas.getContext('2d'),
    metric,
    yoy,
    data: heatmapData(records, metric, yoy)
  };
  drawHeatmap();
  return charts.heatmap;
}

export function updateHeatmap(records, metric = 'median_rent', yoy = null) {
  if (!charts.heatmap) return;
  resizeCanvas(charts.heatmap.canvas);
  charts.heatmap.metric = metric;
  charts.heatmap.yoy = yoy;
  charts.heatmap.data = heatmapData(records, metric, yoy);
  drawHeatmap();
}

function resizeCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const displayWidth = canvas.clientWidth || canvas.width;
  const displayHeight = canvas.clientHeight || 420;
  canvas.width = displayWidth * ratio;
  canvas.height = displayHeight * ratio;
}

function drawHeatmap() {
  if (!charts.heatmap) return;
  const { canvas, ctx, data, metric } = charts.heatmap;
  const ratio = window.devicePixelRatio || 1;
  const padding = 60;
  const { years, boroughs, matrix } = data;
  const width = canvas.width / ratio;
  const height = canvas.height / ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.font = '12px Inter';
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--fg');
  const cellWidth = (width - padding) / years.length;
  const cellHeight = (height - padding) / boroughs.length;
  const values = matrix.flat().filter((v) => v !== null);
  const min = Math.min(...values);
  const max = Math.max(...values);

  boroughs.forEach((borough, i) => {
    ctx.fillText(borough, 4, padding + i * cellHeight + cellHeight / 1.5);
  });
  years.forEach((year, j) => {
    ctx.fillText(year, padding + j * cellWidth + cellWidth / 2.8, 20);
  });

  matrix.forEach((row, i) => {
    row.forEach((value, j) => {
      const t = (value - min) / (max - min || 1);
      const color = heatColor(t);
      ctx.fillStyle = color;
      ctx.fillRect(padding + j * cellWidth, padding + i * cellHeight, cellWidth - 4, cellHeight - 4);
      ctx.fillStyle = t > 0.55 ? '#0f172a' : '#f8fafc';
      const textValue = metric === 'rent_growth' ? `${Number(value).toFixed(1)}%` : `$${Number(value).toLocaleString()}`;
      ctx.fillText(textValue, padding + j * cellWidth + 6, padding + i * cellHeight + cellHeight / 1.7);
    });
  });
}

function heatColor(t) {
  const start = [56, 189, 248];
  const end = [147, 51, 234];
  const r = Math.round(start[0] + (end[0] - start[0]) * t);
  const g = Math.round(start[1] + (end[1] - start[1]) * t);
  const b = Math.round(start[2] + (end[2] - start[2]) * t);
  return `rgba(${r}, ${g}, ${b}, 0.85)`;
}

export function refreshThemes() {
  const defaults = chartDefaults();
  ['bar', 'line', 'scatter'].forEach((key) => {
    if (!charts[key]) return;
    charts[key].options.scales = defaults.scales;
    charts[key].options.plugins.tooltip = defaults.plugins.tooltip;
    if (charts[key].options.plugins.legend) {
      charts[key].options.plugins.legend.labels = defaults.plugins.legend.labels;
    }
    charts[key].update();
  });
  drawHeatmap();
}
