// =============================================================================
// ENHANCED TOOLTIPS - Rich hover states with summary statistics
// =============================================================================

/**
 * Add enhanced tooltip to chart options with summary stats
 * @param {Object} tooltipConfig - Base tooltip configuration
 * @param {Object} summaryData - Summary statistics to display
 * @returns {Object} Enhanced tooltip configuration
 */
export function enhanceTooltip(tooltipConfig, summaryData = {}) {
  return {
    ...tooltipConfig,
    callbacks: {
      ...tooltipConfig.callbacks,
      afterBody: (context) => {
        if (!summaryData || context.length === 0) return [];
        
        const dataPoint = context[0];
        const lines = [];
        
        // Add summary statistics if available
        if (summaryData.medianRent) {
          lines.push('');
          lines.push(`📊 Median: $${summaryData.medianRent.toLocaleString()}`);
        }
        if (summaryData.rentIncrease) {
          lines.push(`📈 +${summaryData.rentIncrease}% since 2010`);
        }
        if (summaryData.incomeIncrease) {
          lines.push(`💰 Income: +${summaryData.incomeIncrease}%`);
        }
        if (summaryData.transitAccess) {
          lines.push(`🚇 Transit: +${summaryData.transitAccess}%`);
        }
        
        return lines;
      },
      footer: (context) => {
        if (!summaryData || context.length === 0) return [];
        return ['', 'Click for detailed breakdown'];
      }
    },
    padding: 16,
    bodySpacing: 6,
    footerSpacing: 8,
    footerFont: {
      size: 11,
      style: 'italic'
    }
  };
}

/**
 * Create custom HTML tooltips for complex visualizations
 * @param {HTMLElement} chartElement - The canvas element
 * @param {Function} getTooltipContent - Function that returns tooltip HTML
 */
export function initCustomTooltip(chartElement, getTooltipContent) {
  if (!chartElement) return;

  let tooltipEl = document.getElementById('custom-chart-tooltip');
  
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'custom-chart-tooltip';
    tooltipEl.className = 'custom-tooltip';
    tooltipEl.style.cssText = `
      position: absolute;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease, transform 0.3s ease;
      background: var(--bg-overlay);
      backdrop-filter: blur(16px) saturate(180%);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 1rem;
      box-shadow: var(--shadow-lg);
      z-index: 1000;
      max-width: 320px;
    `;
    document.body.appendChild(tooltipEl);
  }

  const chart = Chart.getChart(chartElement);
  if (!chart) return;

  chart.options.plugins.tooltip.enabled = false;
  chart.options.plugins.tooltip.external = function(context) {
    const tooltipModel = context.tooltip;
    
    if (tooltipModel.opacity === 0) {
      tooltipEl.style.opacity = '0';
      return;
    }

    // Set content
    if (tooltipModel.body) {
      const content = getTooltipContent(tooltipModel, context);
      tooltipEl.innerHTML = content;
    }

    // Position
    const position = context.chart.canvas.getBoundingClientRect();
    tooltipEl.style.opacity = '1';
    tooltipEl.style.left = position.left + window.pageXOffset + tooltipModel.caretX + 'px';
    tooltipEl.style.top = position.top + window.pageYOffset + tooltipModel.caretY + 'px';
    tooltipEl.style.transform = 'translate(-50%, -120%)';
  };

  chart.update();
}

/**
 * Add hover effects to insight cards
 */
export function initCardHoverEffects() {
  const cards = document.querySelectorAll('.insight-card');
  
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    });
  });
}
