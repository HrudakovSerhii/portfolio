/**
 * Generative Image Component
 * Creates an AI-generation-style image loading effect with grid overlay
 */

/**
 * Creates a generative image element with progressive reveal animation
 * @param {string} highResSrc - URL of the high-resolution image
 * @param {string|undefined} lowResSrc - Optional URL of low-resolution image for overlay
 * @param {string} alt - Alt text for accessibility
 * @param {string} aspectClass - CSS class for aspect ratio (e.g., 'aspect-video')
 * @param {boolean} shouldAnimate - Whether to enable animation
 * @param {Object} gridConfig - Grid configuration
 * @param {number} gridConfig.rows - Number of grid rows
 * @param {number} gridConfig.cols - Number of grid columns
 * @param {number} gridConfig.delay - Delay between cell removals in milliseconds
 * @returns {HTMLElement} The generative image container element
 */
export function createGenerativeImage(
  highResSrc,
  lowResSrc = undefined,
  alt = '',
  aspectClass = 'aspect-video',
  shouldAnimate = true,
  gridConfig = { rows: 4, cols: 4, delay: 50 }
) {
  // Create container
  const container = document.createElement('div');
  container.className = `generative-image ${aspectClass}`;

  // 1. High Resolution Image (Underneath)
  const highResImg = new Image();
  highResImg.alt = alt;
  highResImg.className = 'generative-image__high-res';
  highResImg.src = highResSrc;

  container.appendChild(highResImg);

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  // If animation is disabled or reduced motion is preferred, handle simple load
  if (!shouldAnimate || prefersReducedMotion || gridConfig.delay === 0) {
    highResImg.onload = () => {
      highResImg.classList.add('generative-image__high-res--loaded');
    };
    return container;
  }

  // 2. Grid Overlay (The Low Res "Mosaic")
  // Use lowResSrc if provided, otherwise fallback to highResSrc
  const overlaySrc = lowResSrc || highResSrc;
  
  const overlay = document.createElement('div');
  overlay.className = 'generative-image__overlay';
  overlay.style.gridTemplateColumns = `repeat(${gridConfig.cols}, 1fr)`;
  overlay.style.gridTemplateRows = `repeat(${gridConfig.rows}, 1fr)`;

  const totalCells = gridConfig.rows * gridConfig.cols;
  const cells = [];

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'generative-image__cell';
    cell.style.backgroundImage = `url(${overlaySrc})`;
    cell.style.backgroundSize = `${gridConfig.cols * 100}% ${gridConfig.rows * 100}%`;
    
    // Calculate position for this specific cell
    const row = Math.floor(i / gridConfig.cols);
    const col = i % gridConfig.cols;
    
    const xPos = (col / (gridConfig.cols - 1)) * 100;
    const yPos = (row / (gridConfig.rows - 1)) * 100;
    
    cell.style.backgroundPosition = `${xPos}% ${yPos}%`;
    
    overlay.appendChild(cell);
    cells.push(cell);
  }
  
  container.appendChild(overlay);

  // 3. Badge
  const badge = document.createElement('div');
  badge.className = 'generative-image__badge';
  badge.textContent = 'Refining...';
  container.appendChild(badge);

  // 4. Animation Logic
  highResImg.onload = () => {
    // Show the high res image underneath
    highResImg.classList.add('generative-image__high-res--loaded');

    // Shuffle the cells to remove them randomly
    const shuffledIndices = Array.from({ length: totalCells }, (_, i) => i)
      .sort(() => Math.random() - 0.5);

    let processedCount = 0;

    const intervalId = setInterval(() => {
      if (processedCount >= totalCells) {
        clearInterval(intervalId);
        
        // Cleanup DOM
        setTimeout(() => {
          overlay.remove();
          badge.classList.add('generative-image__badge--hidden');
          setTimeout(() => badge.remove(), 500);
        }, 500);
        return;
      }

      // Pick next random cell index
      const cellIndex = shuffledIndices[processedCount];
      const cell = cells[cellIndex];
      
      // Hide it
      if (cell) {
        cell.classList.add('generative-image__cell--hidden');
      }

      processedCount++;
    }, gridConfig.delay);
  };

  return container;
}
