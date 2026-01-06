class Carousel {
  constructor(container, items, options = {}) {
    this.container = container;
    this.items = items;
    this.options = {
      itemsPerView: options.itemsPerView || 'auto',
      gap: options.gap || 16,
      loop: options.loop !== false,
      navigation: options.navigation !== false,
      ...options
    };

    this.currentIndex = 0;
    this.track = null;
    this.prevButton = null;
    this.nextButton = null;
  }

  render() {
    this.container.classList.add('carousel');

    this.track = document.createElement('div');
    this.track.className = 'carousel__track';
    this.track.style.gap = `${this.options.gap}px`;

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

    this._updateNavigation();
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

    lastClones.forEach(clone => this.track.insertBefore(clone, this.track.firstChild));
    firstClones.forEach(clone => this.track.appendChild(clone));

    this.currentIndex = 3;
    this._updatePosition(false);
  }

  _createNavigationButtons() {
    const navContainer = document.createElement('div');
    navContainer.className = 'carousel__navigation';

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

    navContainer.appendChild(this.prevButton);
    navContainer.appendChild(this.nextButton);
    this.container.appendChild(navContainer);
  }

  next() {
    this.currentIndex++;
    this._updatePosition();

    if (this.options.loop && this.currentIndex >= this.items.length + 3) {
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
    const itemWidth = this.track.querySelector('.carousel__item')?.offsetWidth || 0;
    const gap = this.options.gap;
    const offset = -(this.currentIndex * (itemWidth + gap));

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

  destroy() {
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
