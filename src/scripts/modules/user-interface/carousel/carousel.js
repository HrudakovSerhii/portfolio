class Carousel {
  constructor(container, items, options = {}) {
    this.container = container;
    this.items = items;
    this.options = {
      itemsPerView: options.itemsPerView || 'auto',
      gap: options.gap || 16,
      loop: options.loop !== false,
      navigation: options.navigation !== false,
      swipeThreshold: options.swipeThreshold || 50,
      ...options
    };

    this.currentIndex = 0;
    this.track = null;
    this.prevButton = null;
    this.nextButton = null;
    this.navContainer = null;

    // Touch/swipe state
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchCurrentX = 0;
    this.isDragging = false;
    this.startOffset = 0;

    // Bound event handlers for proper removal
    this._handleTouchStart = this._handleTouchStart.bind(this);
    this._handleTouchMove = this._handleTouchMove.bind(this);
    this._handleTouchEnd = this._handleTouchEnd.bind(this);
    this._handleResize = this._handleResize.bind(this);
  }

  render() {
    this.container.classList.add('carousel');

    this.track = document.createElement('div');
    this.track.className = 'carousel__track';

    this.items.forEach(item => {
      const wrapper = document.createElement('div');
      wrapper.className = 'carousel__item';
      wrapper.appendChild(item);
      this.track.appendChild(wrapper);
    });

    if (this.options.loop && this.items.length > 1) {
      this._setupInfiniteLoop();
    }

    this.container.appendChild(this.track);

    if (this.options.navigation) {
      this._createNavigationButtons();
    }

    this._setupTouchEvents();
    this._setupResizeListener();

    requestAnimationFrame(() => {
      this._updatePosition(false);
      this._updateNavigation();
      this._updateNavigationVisibility();
    });
  }

  _setupInfiniteLoop() {
    const firstClones = this.items.slice(0, 3).map(item => {
      const wrapper = document.createElement('div');
      wrapper.className = 'carousel__item carousel__item--clone';
      wrapper.appendChild(item.cloneNode(true));
      return wrapper;
    });

    const lastClones = this.items.slice(-3).map(item => {
      const wrapper = document.createElement('div');
      wrapper.className = 'carousel__item carousel__item--clone';
      wrapper.appendChild(item.cloneNode(true));
      return wrapper;
    });

    lastClones.reverse().forEach(clone => this.track.insertBefore(clone, this.track.firstChild));
    firstClones.forEach(clone => this.track.appendChild(clone));

    this.currentIndex = 3;
    this._updatePosition(false);
  }

  _createNavigationButtons() {
    this.navContainer = document.createElement('div');
    this.navContainer.className = 'carousel__navigation';

    this.prevButton = document.createElement('button');
    this.prevButton.className = 'carousel__nav-button carousel__nav-button--prev';
    this.prevButton.setAttribute('aria-label', 'Previous item');
    this.prevButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`;
    this.prevButton.addEventListener('click', () => this.prev());

    this.nextButton = document.createElement('button');
    this.nextButton.className = 'carousel__nav-button carousel__nav-button--next';
    this.nextButton.setAttribute('aria-label', 'Next item');
    this.nextButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;
    this.nextButton.addEventListener('click', () => this.next());

    this.navContainer.appendChild(this.prevButton);
    this.navContainer.appendChild(this.nextButton);
    this.container.appendChild(this.navContainer);
  }

  next() {
    this.currentIndex++;
    this._updatePosition();

    if (this.options.loop && this.currentIndex > this.items.length + 2) {
      setTimeout(() => {
        this.currentIndex = 3;
        this._updatePosition(false);
      }, 300);
    }

    this._updateNavigation();
  }

  prev() {
    this.currentIndex--;
    this._updatePosition();

    if (this.options.loop && this.currentIndex < 3) {
      setTimeout(() => {
        this.currentIndex = this.items.length + 2;
        this._updatePosition(false);
      }, 300);
    }

    this._updateNavigation();
  }

  _updatePosition(animate = true) {
    const firstItem = this.track.querySelector('.carousel__item');
    if (!firstItem) return;

    const containerWidth = this.container.offsetWidth;
    const itemWidth = firstItem.offsetWidth;
    const gap = parseFloat(getComputedStyle(this.track).gap) || 0;
    const totalItemWidth = itemWidth + gap;

    // Center the active card in the viewport
    const centerOffset = (containerWidth - itemWidth) / 2;
    const offset = centerOffset - (this.currentIndex * totalItemWidth);

    if (animate) {
      this.track.style.transition = 'transform 300ms ease-in-out';
    } else {
      this.track.style.transition = 'none';
    }

    this.track.style.transform = `translateX(${offset}px)`;
  }

  _updateNavigation() {
    if (!this.options.navigation) return;

    if (!this.options.loop) {
      this.prevButton.disabled = this.currentIndex === 0;
      this.nextButton.disabled = this.currentIndex >= this.items.length - 1;
    }
  }

  _setupTouchEvents() {
    this.track.addEventListener('touchstart', this._handleTouchStart, { passive: true });
    this.track.addEventListener('touchmove', this._handleTouchMove, { passive: false });
    this.track.addEventListener('touchend', this._handleTouchEnd);
    this.track.addEventListener('touchcancel', this._handleTouchEnd);
  }

  _handleTouchStart(e) {
    this.isDragging = true;
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    this.touchCurrentX = this.touchStartX;

    // Get current transform offset
    const transform = getComputedStyle(this.track).transform;
    if (transform !== 'none') {
      const matrix = new DOMMatrix(transform);
      this.startOffset = matrix.m41;
    } else {
      this.startOffset = 0;
    }

    this.track.style.transition = 'none';
  }

  _handleTouchMove(e) {
    if (!this.isDragging) return;

    this.touchCurrentX = e.touches[0].clientX;
    const touchCurrentY = e.touches[0].clientY;

    const deltaX = this.touchCurrentX - this.touchStartX;
    const deltaY = touchCurrentY - this.touchStartY;

    // If scrolling more vertically than horizontally, don't handle
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }

    // Prevent vertical scroll while swiping horizontally
    e.preventDefault();

    const newOffset = this.startOffset + deltaX;
    this.track.style.transform = `translateX(${newOffset}px)`;
  }

  _handleTouchEnd() {
    if (!this.isDragging) return;

    this.isDragging = false;
    const deltaX = this.touchCurrentX - this.touchStartX;

    if (Math.abs(deltaX) > this.options.swipeThreshold) {
      if (deltaX > 0) {
        this.prev();
      } else {
        this.next();
      }
    } else {
      // Snap back to current position
      this._updatePosition(true);
    }
  }

  _setupResizeListener() {
    window.addEventListener('resize', this._handleResize);
  }

  _handleResize() {
    this._updatePosition(false);
    this._updateNavigationVisibility();
  }

  _updateNavigationVisibility() {
    if (!this.navContainer) return;

    // Hide navigation on mobile/tablet (< 1024px), show on desktop
    const isDesktop = window.innerWidth >= 1024;
    this.navContainer.style.display = isDesktop ? '' : 'none';
  }

  destroy() {
    // Remove touch events
    if (this.track) {
      this.track.removeEventListener('touchstart', this._handleTouchStart);
      this.track.removeEventListener('touchmove', this._handleTouchMove);
      this.track.removeEventListener('touchend', this._handleTouchEnd);
      this.track.removeEventListener('touchcancel', this._handleTouchEnd);
    }

    // Remove resize listener
    window.removeEventListener('resize', this._handleResize);

    // Remove button listeners
    if (this.prevButton) {
      this.prevButton.removeEventListener('click', this.prev);
    }
    if (this.nextButton) {
      this.nextButton.removeEventListener('click', this.next);
    }

    this.container.innerHTML = '';
  }
}

export default Carousel;
