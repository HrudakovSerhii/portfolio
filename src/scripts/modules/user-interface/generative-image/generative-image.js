class GenerativeImage {
  constructor(config = {}) {
    this.highResSrc = config.highResSrc;
    this.lowResSrc = config.lowResSrc;
    this.alt = config.alt;
    this.aspectClass = config.aspectClass;
    this.shouldAnimate = config.shouldAnimate !== false;
    this.gridConfig = config.gridConfig

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

    this.container.appendChild(this.overlay);

    // Build overlay after image loads to get actual dimensions
    this._adjustOverlaySizing(overlaySrc);
  }

  _adjustOverlaySizing(imageSrc) {
    const img = new Image();
    img.src = imageSrc;

    img.onload = () => {
      // Calculate rendered image dimensions (after object-fit: contain)
      const containerRect = this.container.getBoundingClientRect();
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const containerAspect = containerRect.width / containerRect.height;

      let renderedWidth, renderedHeight, offsetX, offsetY;

      if (imgAspect > containerAspect) {
        // Image is wider - fits to container width
        renderedWidth = containerRect.width;
        renderedHeight = containerRect.width / imgAspect;
        offsetX = 0;
        offsetY = (containerRect.height - renderedHeight) / 2;
      } else {
        // Image is taller - fits to container height
        renderedHeight = containerRect.height;
        renderedWidth = containerRect.height * imgAspect;
        offsetX = (containerRect.width - renderedWidth) / 2;
        offsetY = 0;
      }

      // Size and position overlay to match rendered image
      this.overlay.style.width = `${renderedWidth}px`;
      this.overlay.style.height = `${renderedHeight}px`;
      this.overlay.style.left = `${offsetX}px`;
      this.overlay.style.top = `${offsetY}px`;
      this.overlay.style.display = 'grid';
      this.overlay.style.gridTemplateColumns = `repeat(${this.gridConfig.cols}, 1fr)`;
      this.overlay.style.gridTemplateRows = `repeat(${this.gridConfig.rows}, 1fr)`;

      // Create cells with proper sizing
      const totalCells = this.gridConfig.rows * this.gridConfig.cols;
      const cellWidth = renderedWidth / this.gridConfig.cols;
      const cellHeight = renderedHeight / this.gridConfig.rows;

      for (let i = 0; i < totalCells; i++) {
        const row = Math.floor(i / this.gridConfig.cols);
        const col = i % this.gridConfig.cols;

        const cell = document.createElement('div');
        cell.className = 'generative-image__cell';
        cell.style.backgroundImage = `url(${imageSrc})`;
        cell.style.backgroundSize = `${renderedWidth}px ${renderedHeight}px`;
        cell.style.backgroundPosition = `-${col * cellWidth}px -${row * cellHeight}px`;
        cell.style.filter = 'blur(2px)';

        this.overlay.appendChild(cell);
        this.cells.push(cell);
      }
    };
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
    }, 5000);
  }
}

export default GenerativeImage;
