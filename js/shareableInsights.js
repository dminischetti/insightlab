// =============================================================================
// SHAREABLE INSIGHTS - Copy visualizations as images with attribution
// =============================================================================

/**
 * Initialize share buttons for each chart
 */
export function initShareableInsights() {
  const insightCards = document.querySelectorAll('.insight-card');
  
  insightCards.forEach(card => {
    addShareButton(card);
  });
}

/**
 * Add a share button to an insight card
 * @param {HTMLElement} card - The insight card element
 */
function addShareButton(card) {
  const canvas = card.querySelector('canvas');
  if (!canvas) return;

  // Create share button
  const shareBtn = document.createElement('button');
  shareBtn.className = 'share-insight-btn';
  shareBtn.setAttribute('aria-label', 'Share this visualization');
  shareBtn.setAttribute('type', 'button');
  shareBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M13 5L8 1L3 5M8 1V11M1 11V14C1 14.5523 1.44772 15 2 15H14C14.5523 15 15 14.5523 15 14V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span>Share</span>
  `;

  // Add to card header
  const header = card.querySelector('header');
  if (header) {
    header.style.position = 'relative';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.appendChild(shareBtn);
  }

  // Add click handler
  shareBtn.addEventListener('click', async () => {
    await shareInsight(card, canvas);
  });
}

/**
 * Create a shareable image from a chart
 * @param {HTMLElement} card - The insight card element
 * @param {HTMLCanvasElement} canvas - The chart canvas
 */
async function shareInsight(card, canvas) {
  try {
    const title = card.querySelector('h3')?.textContent || 'NYC Housing Insight';
    const note = card.querySelector('.chart-note')?.textContent || '';

    // Create a temporary canvas for composition
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    
    // Set dimensions with padding for attribution
    const padding = 40;
    const footerHeight = 80;
    tempCanvas.width = canvas.width + (padding * 2);
    tempCanvas.height = canvas.height + (padding * 2) + footerHeight;

    // Background
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--bg-elevated').trim() || '#1e293b';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw title
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--fg').trim() || '#f8fafc';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.fillText(title, padding, padding - 10);

    // Draw chart
    ctx.drawImage(canvas, padding, padding);

    // Draw note (if it fits)
    if (note && note.length < 100) {
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--fg-muted').trim() || '#94a3b8';
      ctx.font = '14px Inter, sans-serif';
      const maxWidth = tempCanvas.width - (padding * 2);
      wrapText(ctx, note, padding, canvas.height + padding + 30, maxWidth, 20);
    }

    // Draw attribution footer
    const footerY = tempCanvas.height - 40;
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-cyan').trim() || '#38bdf8';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.fillText('InsightLab by Dominic Minischetti', padding, footerY);

    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--fg-subtle').trim() || '#64748b';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('minischetti.org/insightlab', padding, footerY + 20);

    // Convert to blob and copy/download
    tempCanvas.toBlob(async (blob) => {
      if (!blob) {
        showShareNotification('Failed to create image', 'error');
        return;
      }

      try {
        // Try to copy to clipboard first
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          showShareNotification('📋 Image copied to clipboard!');
        } else {
          // Fallback: download the image
          downloadBlob(blob, `insightlab-${slugify(title)}.png`);
          showShareNotification('💾 Image downloaded!');
        }
      } catch (err) {
        // Fallback to download if clipboard fails
        downloadBlob(blob, `insightlab-${slugify(title)}.png`);
        showShareNotification('💾 Image downloaded!');
      }
    }, 'image/png');

  } catch (error) {
    console.error('Share failed:', error);
    showShareNotification('Failed to share image', 'error');
  }
}

/**
 * Wrap text to fit within a width
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} text - Text to wrap
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} maxWidth - Maximum width
 * @param {number} lineHeight - Line height
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let lineY = y;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line, x, lineY);
      line = words[i] + ' ';
      lineY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, lineY);
}

/**
 * Download a blob as a file
 * @param {Blob} blob - The blob to download
 * @param {string} filename - Desired filename
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Convert string to URL-friendly slug
 * @param {string} text - Text to slugify
 * @returns {string} Slugified text
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

/**
 * Show notification after sharing
 * @param {string} message - Message to display
 * @param {string} type - 'success' or 'error'
 */
function showShareNotification(message, type = 'success') {
  let notification = document.getElementById('share-notification');
  
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'share-notification';
    notification.className = 'share-notification';
    notification.setAttribute('role', 'status');
    notification.setAttribute('aria-live', 'polite');
    notification.style.cssText = `
      position: fixed;
      bottom: 6rem;
      right: 2rem;
      background: var(--bg-overlay);
      backdrop-filter: blur(16px) saturate(180%);
      color: var(--fg);
      padding: 1rem 1.5rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-xl);
      z-index: 1002;
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.3s ease, transform 0.3s ease;
      font-weight: 500;
      font-size: 0.9375rem;
    `;
    document.body.appendChild(notification);
  }

  notification.textContent = message;
  notification.style.borderColor = type === 'error' ? '#ef4444' : 'var(--accent-cyan)';
  notification.style.opacity = '1';
  notification.style.transform = 'translateY(0)';

  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(20px)';
  }, 3000);
}
