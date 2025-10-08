const STORAGE_KEY = 'insightlab-theme';

const prefersDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

export function applyTheme(theme) {
  const normalized = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', normalized === 'dark' ? 'dark' : 'light');
  document.documentElement.classList.toggle('theme-light', normalized === 'light');
  document.documentElement.classList.toggle('theme-dark', normalized === 'dark');
  if (normalized === 'dark') {
    document.body.classList.remove('light-mode');
  } else {
    document.body.classList.add('light-mode');
  }
  localStorage.setItem(STORAGE_KEY, normalized);
  document.dispatchEvent(new CustomEvent('theme:change', { detail: { theme: normalized } }));
}

export function initThemeToggle(button) {
  const stored = localStorage.getItem(STORAGE_KEY);
  const initial = stored || (prefersDark() ? 'dark' : 'light');
  applyTheme(initial);

  if (!button) return;
  const updateLabel = () => {
    const theme = localStorage.getItem(STORAGE_KEY) || initial;
    button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  };
  updateLabel();

  button.addEventListener('click', () => {
    const current = localStorage.getItem(STORAGE_KEY) || initial;
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    updateLabel();
  });
}
