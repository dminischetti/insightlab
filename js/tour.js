// =============================================================================
// GUIDED TOUR MODE - Auto-scroll storytelling experience
// =============================================================================

/**
 * Tour configuration defining the sections to visit and timing
 */
const TOUR_CONFIG = {
  sections: [
    { id: 'context', duration: 2500, caption: 'Understanding NYC housing pressure dynamics' },
    { id: 'method', duration: 2500, caption: 'Reproducible pipeline with public data sources' },
    { id: 'insights', duration: 3000, caption: 'Four key visualizations anchoring the narrative' },
    { id: 'findings', duration: 2500, caption: 'What the data reveals about affordability' },
    { id: 'limitations', duration: 2000, caption: 'Honest scope and future directions' }
  ],
  totalDuration: 12500 // Total ~12.5 seconds for a gentle tour
};

/**
 * Tour state management
 */
const TOUR_STATE = {
  isActive: false,
  currentStep: 0,
  timeoutId: null,
  captionElement: null,
  buttonElement: null
};

/**
 * Initialize the guided tour functionality
 */
export function initGuidedTour() {
  const tourButton = document.querySelector('[data-tour-button]');
  if (!tourButton) return;

  TOUR_STATE.buttonElement = tourButton;

  tourButton.addEventListener('click', () => {
    if (TOUR_STATE.isActive) {
      stopTour();
    } else {
      startTour();
    }
  });

  // Initialize caption overlay (hidden by default)
  createCaptionOverlay();
}

/**
 * Create the caption overlay element that shows during the tour
 */
function createCaptionOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'tour-caption';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.style.cssText = `
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-overlay);
    backdrop-filter: blur(16px) saturate(180%);
    color: var(--fg);
    padding: 1rem 2rem;
    border-radius: var(--radius-full);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-xl);
    z-index: 1000;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.4s ease;
    font-size: 0.9375rem;
    font-weight: 500;
    max-width: 90vw;
    text-align: center;
  `;
  document.body.appendChild(overlay);
  TOUR_STATE.captionElement = overlay;
}

/**
 * Start the guided tour
 */
function startTour() {
  TOUR_STATE.isActive = true;
  TOUR_STATE.currentStep = 0;

  // Update button state
  if (TOUR_STATE.buttonElement) {
    TOUR_STATE.buttonElement.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="4" y="3" width="3" height="10" fill="currentColor" rx="0.5"/>
        <rect x="9" y="3" width="3" height="10" fill="currentColor" rx="0.5"/>
      </svg>
      <span>Pause Tour</span>
    `;
    TOUR_STATE.buttonElement.setAttribute('aria-label', 'Pause guided tour');
  }

  // Scroll to top first
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Start first step after a brief delay
  setTimeout(() => {
    if (TOUR_STATE.isActive) {
      tourStep(0);
    }
  }, 800);
}

/**
 * Stop the guided tour
 */
function stopTour() {
  TOUR_STATE.isActive = false;

  if (TOUR_STATE.timeoutId) {
    clearTimeout(TOUR_STATE.timeoutId);
    TOUR_STATE.timeoutId = null;
  }

  // Hide caption
  if (TOUR_STATE.captionElement) {
    TOUR_STATE.captionElement.style.opacity = '0';
  }

  // Reset button
  if (TOUR_STATE.buttonElement) {
    TOUR_STATE.buttonElement.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M5 3L12 8L5 13V3Z" fill="currentColor"/>
      </svg>
      <span>Take a Tour</span>
    `;
    TOUR_STATE.buttonElement.setAttribute('aria-label', 'Take a 60-second guided tour');
  }
}

/**
 * Execute a single tour step
 * @param {number} stepIndex - The index of the step to execute
 */
function tourStep(stepIndex) {
  if (!TOUR_STATE.isActive || stepIndex >= TOUR_CONFIG.sections.length) {
    // Tour complete
    stopTour();
    return;
  }

  const step = TOUR_CONFIG.sections[stepIndex];
  const section = document.getElementById(step.id);

  if (section) {
    // Scroll to section with smooth behavior
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Show caption
    if (TOUR_STATE.captionElement) {
      TOUR_STATE.captionElement.textContent = step.caption;
      TOUR_STATE.captionElement.style.opacity = '1';
    }

    // Schedule next step
    TOUR_STATE.timeoutId = setTimeout(() => {
      if (TOUR_STATE.isActive) {
        TOUR_STATE.currentStep++;
        tourStep(TOUR_STATE.currentStep);
      }
    }, step.duration);
  } else {
    // Section not found, skip to next
    TOUR_STATE.currentStep++;
    tourStep(TOUR_STATE.currentStep);
  }
}
