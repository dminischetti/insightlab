// =============================================================================
// PANDEMIC COMPARISON TOGGLE - Before/After 2020 dataset switcher
// =============================================================================

/**
 * State management for pandemic comparison
 */
const PANDEMIC_STATE = {
  mode: 'current', // 'current' or 'pandemic'
  notificationTimeout: null
};

/**
 * Initialize the pandemic comparison toggle
 */
export function initPandemicToggle() {
  const toggle = document.querySelector('[data-pandemic-toggle]');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    PANDEMIC_STATE.mode = PANDEMIC_STATE.mode === 'current' ? 'pandemic' : 'current';
    applyPandemicMode(PANDEMIC_STATE.mode);
    showPandemicNotification(PANDEMIC_STATE.mode);
  });
}

/**
 * Apply pandemic mode styling and data filtering
 * @param {string} mode - 'current' or 'pandemic'
 */
function applyPandemicMode(mode) {
  const toggle = document.querySelector('[data-pandemic-toggle]');
  const body = document.body;
  
  if (mode === 'pandemic') {
    body.classList.add('pandemic-mode');
    if (toggle) {
      toggle.textContent = '2020 Focus';
      toggle.setAttribute('aria-pressed', 'true');
      toggle.setAttribute('aria-label', 'Switch to current data view');
    }
    
    // Apply pandemic-era color scheme
    document.documentElement.style.setProperty('--chart-accent', 'oklch(65% 0.20 30)');
    
    // Dispatch event for charts to update
    document.dispatchEvent(new CustomEvent('pandemic:toggle', { 
      detail: { mode: 'pandemic', year: 2020 } 
    }));
  } else {
    body.classList.remove('pandemic-mode');
    if (toggle) {
      toggle.textContent = 'Compare 2020';
      toggle.setAttribute('aria-pressed', 'false');
      toggle.setAttribute('aria-label', 'Switch to pandemic comparison view');
    }
    
    // Reset to default color scheme
    document.documentElement.style.setProperty('--chart-accent', '');
    
    document.dispatchEvent(new CustomEvent('pandemic:toggle', { 
      detail: { mode: 'current', year: null } 
    }));
  }
}

/**
 * Show animated notification when switching modes
 * @param {string} mode - 'current' or 'pandemic'
 */
function showPandemicNotification(mode) {
  let notification = document.getElementById('pandemic-notification');
  
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'pandemic-notification';
    notification.className = 'pandemic-notification';
    notification.setAttribute('role', 'status');
    notification.setAttribute('aria-live', 'polite');
    notification.style.cssText = `
      position: fixed;
      top: calc(var(--safe-top) + 5rem);
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-overlay);
      backdrop-filter: blur(16px) saturate(180%);
      color: var(--fg);
      padding: 1rem 2rem;
      border-radius: var(--radius-full);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-xl);
      z-index: 1001;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.4s ease, transform 0.4s ease;
      font-weight: 600;
      font-size: 0.9375rem;
    `;
    document.body.appendChild(notification);
  }

  // Clear existing timeout
  if (PANDEMIC_STATE.notificationTimeout) {
    clearTimeout(PANDEMIC_STATE.notificationTimeout);
  }

  // Set message
  const messages = {
    pandemic: '🔄 Pandemic Reset in Motion — Viewing 2020 impact',
    current: '📊 Back to Full Timeline — 2010-2024'
  };
  
  notification.textContent = messages[mode];
  notification.style.opacity = '1';
  notification.style.transform = 'translateX(-50%) translateY(0)';

  // Auto-hide after 3 seconds
  PANDEMIC_STATE.notificationTimeout = setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(-50%) translateY(-10px)';
  }, 3000);
}

/**
 * Filter data based on pandemic mode
 * @param {Array} data - Original dataset
 * @param {string} mode - 'current' or 'pandemic'
 * @returns {Array} Filtered dataset
 */
export function filterByPandemicMode(data, mode) {
  if (!data || mode !== 'pandemic') return data;
  
  // Filter to show 2019-2021 window for pandemic comparison
  return data.filter(item => {
    const year = item.year || item.x || 0;
    return year >= 2019 && year <= 2021;
  });
}
