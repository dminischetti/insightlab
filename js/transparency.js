// =============================================================================
// DATA TRANSPARENCY LAYER - Toggle for "How I Built This" section
// =============================================================================

/**
 * Initialize the transparency section toggle functionality
 */
export function initTransparencyToggle() {
  const toggle = document.querySelector('[data-transparency-toggle]');
  const content = document.getElementById('transparency-content');
  const label = toggle?.querySelector('[data-toggle-label]');
  const hint = toggle?.querySelector('[data-toggle-hint]');

  if (!toggle || !content) return;

  toggle.addEventListener('click', () => {
    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    
    if (isExpanded) {
      // Collapse
      toggle.setAttribute('aria-expanded', 'false');
      content.setAttribute('hidden', '');
      if (label) label.textContent = 'Expand breakdown';
      if (hint) hint.textContent = 'Peek at the workflow';
    } else {
      // Expand
      toggle.setAttribute('aria-expanded', 'true');
      content.removeAttribute('hidden');
      if (label) label.textContent = 'Hide breakdown';
      if (hint) hint.textContent = 'Close build notes';
    }
  });
}
