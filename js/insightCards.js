// =============================================================================
// PERSONAL INSIGHT CARDS - Humanize the technical process with thought bubbles
// =============================================================================

/**
 * Configuration for insight cards at key visualizations
 */
const INSIGHT_CARDS_CONFIG = [
  {
    targetSelector: '#chart-bar',
    icon: '💡',
    text: 'Built to visualize rent elasticity by borough—showing how Manhattan maintains its premium while other boroughs converge.',
    position: 'top-right',
    delay: 1000
  },
  {
    targetSelector: '#chart-scatter',
    icon: '🔍',
    text: 'Bubble size represents transit access—revealing how subway proximity adds 15-25% rent premium across all periods.',
    position: 'top-left',
    delay: 1200
  },
  {
    targetSelector: '#chart-heatmap',
    icon: '📊',
    text: 'This heatmap captures the pulse of NYC housing—two major surges frame our 14-year story of affordability pressure.',
    position: 'bottom-right',
    delay: 1400
  }
];

/**
 * Initialize personal insight cards on the page
 */
export function initInsightCards() {
  // Wait for page load and data to be ready
  setTimeout(() => {
    INSIGHT_CARDS_CONFIG.forEach(config => {
      createInsightCard(config);
    });
  }, 500);
}

/**
 * Create and position an insight card near a visualization
 * @param {Object} config - Configuration object for the insight card
 */
function createInsightCard(config) {
  const targetElement = document.querySelector(config.targetSelector);
  if (!targetElement) return;

  // Find the parent figure or card container
  const parentCard = targetElement.closest('.insight-card') || targetElement.closest('figure');
  if (!parentCard) return;

  // Create the insight card element
  const card = document.createElement('div');
  card.className = 'personal-insight-card';
  card.setAttribute('role', 'note');
  card.setAttribute('aria-label', 'Personal insight about this visualization');
  
  // Position classes based on config
  const positionClass = `insight-${config.position}`;
  card.classList.add(positionClass);

  card.innerHTML = `
    <span class="insight-icon" aria-hidden="true">${config.icon}</span>
    <p class="insight-text">${config.text}</p>
  `;

  // Add to parent container
  parentCard.style.position = 'relative';
  parentCard.appendChild(card);

  // Animate in after delay
  setTimeout(() => {
    card.classList.add('is-visible');
  }, config.delay);

  // Add intersection observer for scroll-triggered animation
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        card.classList.add('is-visible');
      }
    });
  }, {
    threshold: 0.3,
    rootMargin: '0px 0px -100px 0px'
  });

  observer.observe(parentCard);
}
