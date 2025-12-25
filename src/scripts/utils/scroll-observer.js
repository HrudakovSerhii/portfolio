/**
 * Base ScrollObserver Class
 * Generic IntersectionObserver wrapper for tracking element visibility
 * Extended by specific observers for different behaviors (navigation, animation, etc.)
 */

class ScrollObserver {
  constructor(options = {}) {
    this.options = {
      root: options.root || null,
      rootMargin: options.rootMargin || '0px',
      threshold: options.threshold || [0, 0.1, 0.5, 1.0],
      selector: options.selector || '.content-section',
      container: options.container || null,
      observeOnInit: options.observeOnInit !== false
    };

    this.observer = null;
    this.mutationObserver = null;
    this.observedElements = new Map(); // Track observed elements and their states

    this.handleIntersections = this.handleIntersections.bind(this);
    this.handleMutations = this.handleMutations.bind(this);

    if (this.options.observeOnInit) {
      this.init();
    }
  }

  /**
   * Initializes the observer
   */
  init() {
    this.setupIntersectionObserver();

    if (this.options.container) {
      this.setupMutationObserver();
      this.observeExistingElements();
    }
  }

  /**
   * Sets up IntersectionObserver
   * @private
   */
  setupIntersectionObserver() {
    const observerOptions = {
      root: this.options.root,
      rootMargin: this.options.rootMargin,
      threshold: this.options.threshold
    };

    this.observer = new IntersectionObserver(this.handleIntersections, observerOptions);
  }

  /**
   * Sets up MutationObserver to watch for new elements
   * @private
   */
  setupMutationObserver() {
    if (!this.options.container) return;

    this.mutationObserver = new MutationObserver(this.handleMutations);
    this.mutationObserver.observe(this.options.container, {
      childList: true,
      subtree: this.options.observeSubtree || false
    });
  }

  /**
   * Observes existing elements in container
   * @private
   */
  observeExistingElements() {
    if (!this.options.container) return;

    const elements = Array.from(this.options.container.children).filter(
      child => child.matches(this.options.selector)
    );

    elements.forEach(element => this.observe(element));
  }

  /**
   * Handles DOM mutations (new elements added)
   * @param {Array} mutations - MutationRecord array
   * @private
   */
  handleMutations(mutations) {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches(this.options.selector)) {
          this.observe(node);
        }
      });

      mutation.removedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          this.unobserve(node);
        }
      });
    });
  }

  /**
   * Handles intersection changes
   * Override this method in subclasses to implement specific behavior
   * @param {Array} entries - IntersectionObserverEntry array
   * @protected
   */
  handleIntersections(entries) {
    // To be overridden by subclasses
    entries.forEach(entry => {
      this.updateElementState(entry);
      this.onIntersect(entry);
    });
  }

  /**
   * Updates internal state for an observed element
   * @param {IntersectionObserverEntry} entry - Intersection entry
   * @protected
   */
  updateElementState(entry) {
    if (entry.isIntersecting) {
      this.observedElements.set(entry.target, {
        ratio: entry.intersectionRatio,
        isIntersecting: entry.isIntersecting,
        boundingClientRect: entry.boundingClientRect
      });
    } else {
      this.observedElements.delete(entry.target);
    }
  }

  /**
   * Called when an element intersects
   * Override in subclasses to implement specific behavior
   * @param {IntersectionObserverEntry} entry - Intersection entry
   * @protected
   */
  onIntersect(entry) {
    // To be overridden by subclasses
  }

  /**
   * Starts observing an element
   * @param {HTMLElement} element - Element to observe
   */
  observe(element) {
    if (this.observer && element) {
      this.observer.observe(element);
    }
  }

  /**
   * Stops observing an element
   * @param {HTMLElement} element - Element to stop observing
   */
  unobserve(element) {
    if (this.observer && element) {
      this.observer.unobserve(element);
      this.observedElements.delete(element);
    }
  }

  /**
   * Gets current state of all observed elements
   * @returns {Map} Map of elements to their states
   */
  getObservedStates() {
    return this.observedElements;
  }

  /**
   * Disconnects all observers
   */
  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    this.observedElements.clear();
  }
}

export default ScrollObserver;