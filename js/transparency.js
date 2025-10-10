// =============================================================================
// DATA TRANSPARENCY LAYER - Toggle for "How I Built This" section
// =============================================================================

/**
 * Initialize the transparency section toggle functionality
 */
export function initTransparencyToggle() {
  const toggle = document.querySelector('[data-transparency-toggle]');
  const content = document.getElementById('transparency-content');

  if (!toggle || !content) return;

  toggle.addEventListener('click', () => {
    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    
    if (isExpanded) {
      // Collapse
      toggle.setAttribute('aria-expanded', 'false');
      content.setAttribute('hidden', '');
    } else {
      // Expand
      toggle.setAttribute('aria-expanded', 'true');
      content.removeAttribute('hidden');
    }
  });
}
