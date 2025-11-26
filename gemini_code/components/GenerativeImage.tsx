
interface GridConfig {
  rows: number;
  cols: number;
  delay: number; // ms
}

export const createGenerativeImage = (
  highResSrc: string,
  lowResSrc: string | undefined,
  alt: string,
  aspectClass: string = 'aspect-video',
  shouldAnimate: boolean = true,
  gridConfig: GridConfig = { rows: 4, cols: 4, delay: 50 }
): HTMLElement => {
  const container = document.createElement('div');
  // Update: w-[70%] and mx-auto to satisfy static size requirement relative to container
  container.className = `relative overflow-hidden rounded-2xl bg-[#1e1f20] w-[70%] mx-auto ${aspectClass} shadow-xl`;

  // 1. High Resolution Image (Underneath)
  const highResImg = new Image();
  highResImg.alt = alt;
  highResImg.className = 'absolute inset-0 w-full h-full object-cover z-0 opacity-0 transition-opacity duration-500';
  highResImg.src = highResSrc;

  container.appendChild(highResImg);

  // If animation is disabled or reduced motion is preferred, handle simple load
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!shouldAnimate || prefersReducedMotion || gridConfig.delay === 0) {
    highResImg.onload = () => {
      highResImg.classList.remove('opacity-0');
      highResImg.classList.add('opacity-100');
    };
    return container;
  }

  // 2. Grid Overlay (The Low Res "Mosaic")
  // Use lowResSrc if provided, otherwise fallback to highResSrc (browser will cache, but visual effect remains)
  const overlaySrc = lowResSrc || highResSrc;
  
  const overlay = document.createElement('div');
  overlay.className = 'absolute inset-0 z-10 grid w-full h-full pointer-events-none';
  overlay.style.gridTemplateColumns = `repeat(${gridConfig.cols}, 1fr)`;
  overlay.style.gridTemplateRows = `repeat(${gridConfig.rows}, 1fr)`;

  const totalCells = gridConfig.rows * gridConfig.cols;
  const cells: HTMLElement[] = [];

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'w-full h-full transition-opacity duration-500 ease-out';
    cell.style.backgroundImage = `url(${overlaySrc})`;
    cell.style.backgroundSize = `${gridConfig.cols * 100}% ${gridConfig.rows * 100}%`;
    
    // Calculate position for this specific cell
    const row = Math.floor(i / gridConfig.cols);
    const col = i % gridConfig.cols;
    
    const xPos = (col / (gridConfig.cols - 1)) * 100;
    const yPos = (row / (gridConfig.rows - 1)) * 100;
    
    cell.style.backgroundPosition = `${xPos}% ${yPos}%`;
    
    // Add a slight blur to the low res grid to look more "generative"
    cell.style.filter = 'blur(2px)';
    
    overlay.appendChild(cell);
    cells.push(cell);
  }
  
  container.appendChild(overlay);

  // 3. Badge
  const badge = document.createElement('div');
  badge.className = 'absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-[10px] uppercase tracking-widest text-blue-300 font-mono backdrop-blur-md z-20 transition-opacity duration-500';
  badge.textContent = 'Refining...';
  container.appendChild(badge);

  // 4. Animation Logic
  highResImg.onload = () => {
    // Show the high res image underneath
    highResImg.classList.remove('opacity-0');
    highResImg.classList.add('opacity-100');

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
          badge.style.opacity = '0';
          setTimeout(() => badge.remove(), 500);
        }, 500);
        return;
      }

      // Pick next random cell index
      const cellIndex = shuffledIndices[processedCount];
      const cell = cells[cellIndex];
      
      // Hide it
      if (cell) {
        cell.style.opacity = '0';
      }

      processedCount++;
    }, gridConfig.delay);
  };

  return container;
};
