class GenerativeImage {
  static DEFAULTS = {
    ANIMATION_CLEANUP_DELAY: 100,
    BADGE_FADE_DELAY: 50,
    OVERLAY_CELL_TRANSITION_DELAY: 100,
  };

  constructor(config = {}) {
    this.highResSrc = config.highResSrc;
    this.lowResSrc = config.lowResSrc;
    this.alt = config.alt;
    this.aspectClass = config.aspectClass;
    this.shouldAnimate = config.shouldAnimate !== false;
    this.gridConfig = config.gridConfig;

    this.container = null;
    this.highResImg = null;
    this.overlay = null;
    this.badge = null;
    this.cells = [];
  }

  create() {
    this._buildFromTemplate();
    this._configureImage();

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shouldSkipAnimation = !this.shouldAnimate || prefersReducedMotion;

    if (shouldSkipAnimation) {
      this._setupSimpleLoad();
      this._removeAnimationElements();
      return this.container;
    }

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

  _buildFromTemplate() {
    const template = document.getElementById('generative-image-template');
    if (!template) {
      throw new Error('GenerativeImage: Template not found');
    }

    const clone = template.content.cloneNode(true);
    this.container = clone.querySelector('.generative-image');
    this.highResImg = clone.querySelector('.generative-image__high-res');
    this.overlay = clone.querySelector('.generative-image__overlay');
    this.badge = clone.querySelector('.generative-image__badge');

    if (this.aspectClass) {
      this.container.classList.add(this.aspectClass);
    }
  }

  _configureImage() {
    this.highResImg.alt = this.alt;
    this.highResImg.src = this.highResSrc;
  }

  _removeAnimationElements() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.badge) {
      this.badge.remove();
      this.badge = null;
    }
  }

  _setupOverlay() {
    const overlaySrc = this.lowResSrc || this.highResSrc;
    const img = new Image();
    img.src = overlaySrc;

    img.onload = () => {
      const dimensions = this._calculateImageDimensions(img);
      this._positionOverlay(dimensions);
      this._configureOverlayGrid();
      this._createGridCells(overlaySrc, dimensions);

      // If high-res image already loaded, start animation now
      if (this.highResImg.complete && this.highResImg.classList.contains('generative-image__high-res--loaded')) {
        this._startRevealAnimation();
      }
    };
  }

  _calculateImageDimensions(img) {
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

    return { renderedWidth, renderedHeight, offsetX, offsetY };
  }

  _positionOverlay(dimensions) {
    this.overlay.style.left = `${dimensions.offsetX}px`;
    this.overlay.style.top = `${dimensions.offsetY}px`;
  }

  _configureOverlayGrid() {
    this.overlay.style.gridTemplateColumns = `repeat(${this.gridConfig.cols}, 1fr)`;
    this.overlay.style.gridTemplateRows = `repeat(${this.gridConfig.rows}, 1fr)`;
  }

  _createGridCells(imageSrc, dimensions) {
    const totalCells = this.gridConfig.rows * this.gridConfig.cols;
    const cellWidth = dimensions.renderedWidth / this.gridConfig.cols;
    const cellHeight = dimensions.renderedHeight / this.gridConfig.rows;

    for (let i = 0; i < totalCells; i++) {
      const cell = this._createCell(i, imageSrc, cellWidth, cellHeight, dimensions);
      this.overlay.appendChild(cell);
      this.cells.push(cell);
    }
  }

  _createCell(index, imageSrc, cellWidth, cellHeight, dimensions) {
    const row = Math.floor(index / this.gridConfig.cols);
    const col = index % this.gridConfig.cols;

    const cell = document.createElement('div');
    cell.className = 'generative-image__cell';
    cell.style.backgroundImage = `url(${imageSrc})`;
    cell.style.backgroundSize = `${dimensions.renderedWidth}px ${dimensions.renderedHeight}px`;
    cell.style.backgroundPosition = `-${col * cellWidth}px -${row * cellHeight}px`;
    cell.dataset.cellIndex = index; // For debugging

    return cell;
  }

  _setupSimpleLoad() {
    this.highResImg.onload = () => {
      this.highResImg.classList.add('generative-image__high-res--loaded');
    };
  }

  _setupAnimatedLoad() {
    this.highResImg.onload = () => {
      this.highResImg.classList.add('generative-image__high-res--loaded');

      if (this.cells.length > 0) {
        this._startRevealAnimation();
      }
    };

    this._setupOverlay();
  }

  _startRevealAnimation() {
    const shuffledIndices = this._generateShuffledIndices();
    this._revealNextCell(shuffledIndices, 0);
  }

  _generateShuffledIndices() {
    const totalCells = this.cells.length;
    return Array.from({ length: totalCells }, (_, i) => i)
      .sort(() => Math.random() - 0.5);
  }

  _revealNextCell(shuffledIndices, position) {
    if (position >= shuffledIndices.length) {
      this._cleanupAnimation();
      return;
    }

    const cellIndex = shuffledIndices[position];
    this._hideCell(cellIndex);

    setTimeout(() => {
      this._revealNextCell(shuffledIndices, position + 1);
    }, GenerativeImage.DEFAULTS.OVERLAY_CELL_TRANSITION_DELAY);
  }

  _hideCell(cellIndex) {
    const cell = this.cells[cellIndex];
    if (cell) {
      cell.classList.add('generative-image__cell--hidden');
    }
  }

  _cleanupAnimation() {
    this._removeOverlay();
    this._fadeBadge();
  }

  _removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  _fadeBadge() {
    if (this.badge) {
      this.badge.classList.add('generative-image__badge--hidden');
      setTimeout(() => {
        this.badge.remove();
        this.badge = null;
      }, GenerativeImage.DEFAULTS.BADGE_FADE_DELAY);
    }
  }
}

export default GenerativeImage;
