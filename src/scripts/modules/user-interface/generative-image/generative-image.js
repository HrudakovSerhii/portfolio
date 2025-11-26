class GenerativeImage {
  constructor(config = {}) {
    this.highResSrc = config.highResSrc;
    this.lowResSrc = config.lowResSrc;
    this.alt = config.alt || '';
    this.aspectClass = config.aspectClass || 'aspect-video';
    this.shouldAnimate = config.shouldAnimate !== false;
    this.gridConfig = config.gridConfig || { rows: 4, cols: 4, delay: 50 };
    
    this.container = null;
    this.highResImg = null;
    this.overlay = null;
    this.badge = null;
    this.cells = [];
  }

  create() {
    this._buildContainer();
    this._buildHighResImage();
    
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (!this.shouldAnimate || prefersReducedMotion || this.gridConfig.delay === 0) {
      this._setupSimpleLoad();
      return this.container;
    }

    this._buildOverlay();
    this._buildBadge();
    this._setupAnimatedLoad();
    
    return this.container;
  }

  load() {
    if (this.highResImg && this.highResImg.complete) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      if (this.highResImg) {
        this.highResImg.addEventListener('load', () => resolve(), { once: true });
      } else {
        resolve();
      }
    });
  }

  _buildContainer() {
    this.container = document.createElement('div');
    this.container.className = `generative-image ${this.aspectClass}`;
  }

  _buildHighResImage() {
    this.highResImg = new Image();
    this.highResImg.alt = this.alt;
    this.highResImg.className = 'generative-image__high-res';
    this.highResImg.src = this.highResSrc;
    this.container.appendChild(this.highResImg);
  }

  _buildOverlay() {
    const overlaySrc = this.lowResSrc || this.highResSrc;
    
    this.overlay = document.createElement('div');
    this.overlay.className = 'generative-image__overlay';
    this.overlay.style.gridTemplateColumns = `repeat(${this.gridConfig.cols}, 1fr)`;
    this.overlay.style.gridTemplateRows = `repeat(${this.gridConfig.rows}, 1fr)`;

    const totalCells = this.gridConfig.rows * this.gridConfig.cols;

    for (let i = 0; i < totalCells; i++) {
      const cell = this._createCell(i, overlaySrc);
      this.overlay.appendChild(cell);
      this.cells.push(cell);
    }
    
    this.container.appendChild(this.overlay);
  }

  _createCell(index, imageSrc) {
    const cell = document.createElement('div');
    cell.className = 'generative-image__cell';
    cell.style.backgroundImage = `url(${imageSrc})`;
    cell.style.backgroundSize = `${this.gridConfig.cols * 100}% ${this.gridConfig.rows * 100}%`;
    
    const row = Math.floor(index / this.gridConfig.cols);
    const col = index % this.gridConfig.cols;
    
    const xPos = (col / (this.gridConfig.cols - 1)) * 100;
    const yPos = (row / (this.gridConfig.rows - 1)) * 100;
    
    cell.style.backgroundPosition = `${xPos}% ${yPos}%`;
    cell.style.filter = 'blur(2px)';
    
    return cell;
  }

  _buildBadge() {
    this.badge = document.createElement('div');
    this.badge.className = 'generative-image__badge';
    this.badge.textContent = 'Refining...';
    this.container.appendChild(this.badge);
  }

  _setupSimpleLoad() {
    this.highResImg.onload = () => {
      this.highResImg.classList.add('generative-image__high-res--loaded');
    };
  }

  _setupAnimatedLoad() {
    this.highResImg.onload = () => {
      this.highResImg.classList.add('generative-image__high-res--loaded');
      this._startRevealAnimation();
    };
  }

  _startRevealAnimation() {
    const totalCells = this.cells.length;
    const shuffledIndices = Array.from({ length: totalCells }, (_, i) => i)
      .sort(() => Math.random() - 0.5);

    let processedCount = 0;

    const intervalId = setInterval(() => {
      if (processedCount >= totalCells) {
        clearInterval(intervalId);
        this._cleanupAnimation();
        return;
      }

      const cellIndex = shuffledIndices[processedCount];
      const cell = this.cells[cellIndex];
      
      if (cell) {
        cell.style.opacity = '0';
      }

      processedCount++;
    }, this.gridConfig.delay);
  }

  _cleanupAnimation() {
    setTimeout(() => {
      if (this.overlay) {
        this.overlay.remove();
      }
      if (this.badge) {
        this.badge.style.opacity = '0';
        setTimeout(() => this.badge.remove(), 500);
      }
    }, 500);
  }
}

export default GenerativeImage;
