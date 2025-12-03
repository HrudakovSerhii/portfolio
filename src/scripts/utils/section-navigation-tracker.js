class SectionNavigationTracker {
  /**
   * @param {string} navContainerId - ID of the container holding nav links
   * @param {string} sectionContainerId - ID of the container where sections are rendered
   * @param {Object} options - Configuration options
   */
  constructor(navContainerId, sectionContainerId, options = {}) {
    this.navContainer = document.getElementById(navContainerId);
    this.sectionContainer = document.getElementById(sectionContainerId);

    // Configuration
    this.activeClass = options.activeClass || 'active';
    this.threshold = options.threshold || 0.51; // 51% visibility required
    this.sectionSelector = options.sectionSelector || '.content-section';
    this.navItemSelector = options.navItemSelector || '.header-nav-item';
    this.sectionIdAttribute = options.sectionIdAttribute || 'data-section-id';

    // Bind methods to keep 'this' context
    this.handleMutations = this.handleMutations.bind(this);
    this.handleIntersections = this.handleIntersections.bind(this);

    this.init();
  }

  init() {
    if (!this.navContainer || !this.sectionContainer) {
      console.error('SectionNavigationTracker: Containers not found.');
      return;
    }

    // Setup IntersectionObserver (Checks visibility)
    // rootMargin accounts for fixed header (80px) and requires >50% visibility
    this.observer = new IntersectionObserver(this.handleIntersections, {
      root: null,
      rootMargin: '-80px 0px -50% 0px',
      threshold: [0, 0.1, 0.5, 1.0]
    });

    // Setup MutationObserver (Detects new DOM elements)
    this.domWatcher = new MutationObserver(this.handleMutations);

    // Start watching the section container for new child nodes
    this.domWatcher.observe(this.sectionContainer, { childList: true });

    // Observe any existing sections
    const existingSections = this.sectionContainer.querySelectorAll(this.sectionSelector);
    existingSections.forEach(section => this.observer.observe(section));
  }

  /**
   * Called automatically when elements are added to sectionContainer
   */
  handleMutations(mutations) {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        // Ensure we only observe actual HTML Elements (type 1) that match our selector
        if (node.nodeType === 1 && node.matches(this.sectionSelector)) {
          this.observer.observe(node);
        }
      });
    });
  }

  /**
   * Called automatically when scrolling occurs
   * Only highlights the section with the highest intersection ratio (>10% threshold)
   */
  handleIntersections(entries) {
    // Find the most visible section
    const MIN_VISIBILITY_THRESHOLD = 0.1;
    let mostVisibleEntry = null;
    let highestRatio = 0;

    entries.forEach(entry => {
      if (entry.isIntersecting && 
          entry.intersectionRatio >= MIN_VISIBILITY_THRESHOLD && 
          entry.intersectionRatio > highestRatio) {
        highestRatio = entry.intersectionRatio;
        mostVisibleEntry = entry;
      }
    });

    // Clear all active states first
    const allNavItems = this.navContainer.querySelectorAll(this.navItemSelector);
    allNavItems.forEach(item => item.classList.remove(this.activeClass));

    // Set active state on the most visible section's nav item
    if (mostVisibleEntry) {
      const sectionId = mostVisibleEntry.target.getAttribute(this.sectionIdAttribute);
      const navItem = this.navContainer.querySelector(
        `${this.navItemSelector}[${this.sectionIdAttribute}="${sectionId}"]`
      );

      if (navItem) {
        navItem.classList.add(this.activeClass);
      }
    }
  }

  /**
   * Optional: Cleanup if you destroy the page (SPA navigation)
   */
  disconnect() {
    this.observer.disconnect();
    this.domWatcher.disconnect();
  }
}

export default SectionNavigationTracker;
