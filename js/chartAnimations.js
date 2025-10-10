// =============================================================================
// CHART ANIMATIONS - Smooth entrance and transition effects
// =============================================================================

/**
 * Default animation configuration for charts
 * Consistent 500ms duration with natural easing
 */
export const CHART_ANIMATION_CONFIG = {
  duration: 500,
  easing: 'easeInOutCubic',
  delay: (context) => {
    let delay = 0;
    if (context.type === 'data' && context.mode === 'default') {
      delay = context.dataIndex * 50; // Stagger effect
    }
    return delay;
  },
};

/**
 * Animation configuration for initial chart load
 */
export const INITIAL_ANIMATION = {
  duration: 800,
  easing: 'easeOutQuart',
  delay: (context) => {
    let delay = 0;
    if (context.type === 'data' && context.mode === 'default') {
      delay = context.dataIndex * 80; // More pronounced stagger on first load
    }
    return delay;
  },
};

/**
 * Animation configuration for data updates
 */
export const UPDATE_ANIMATION = {
  duration: 500,
  easing: 'easeInOutCubic',
};

/**
 * Add animation configuration to chart options
 * @param {Object} options - Chart.js options object
 * @param {boolean} isInitial - Whether this is the initial render
 * @returns {Object} Updated options with animation config
 */
export function addChartAnimations(options, isInitial = true) {
  return {
    ...options,
    animation: isInitial ? INITIAL_ANIMATION : CHART_ANIMATION_CONFIG,
    transitions: {
      show: {
        animations: {
          x: { from: 0 },
          y: { from: 0 }
        }
      },
      hide: {
        animations: {
          x: { to: 0 },
          y: { to: 0 }
        }
      },
      active: {
        animation: {
          duration: 300
        }
      }
    }
  };
}

/**
 * Observer to trigger animations when charts come into view
 */
export function observeChartAnimations() {
  const charts = document.querySelectorAll('canvas[id^="chart-"]');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.hasAttribute('data-animated')) {
        entry.target.setAttribute('data-animated', 'true');
        
        // Trigger a subtle scale animation on the parent card
        const card = entry.target.closest('.insight-card');
        if (card) {
          card.style.animation = 'chartCardEntrance 0.6s ease-out forwards';
        }
      }
    });
  }, {
    threshold: 0.2,
    rootMargin: '0px 0px -50px 0px'
  });

  charts.forEach(chart => observer.observe(chart));
}
