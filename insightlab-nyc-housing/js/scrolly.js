export function initScrolly({ stepsSelector = '.step', activeClass = 'active', onStepChange } = {}) {
  const steps = document.querySelectorAll(stepsSelector);
  if (!steps.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          steps.forEach((step) => step.classList.remove(activeClass));
          entry.target.classList.add(activeClass);
          entry.target.classList.add('visible');
          onStepChange?.(Array.from(steps).indexOf(entry.target));
        }
      });
    },
    { threshold: 0.5 }
  );

  steps.forEach((step) => {
    step.classList.add('fade-in');
    observer.observe(step);
  });
}

export function revealOnScroll(selector) {
  const elements = document.querySelectorAll(selector);
  if (!elements.length) return;
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );
  elements.forEach((element) => observer.observe(element));
}
