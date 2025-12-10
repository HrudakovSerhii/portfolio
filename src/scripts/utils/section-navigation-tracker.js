class SectionNavigationTracker {
  constructor(navContainerId, sectionContainerId, options = {}) {
    this.navContainer = document.getElementById(navContainerId);
    this.sectionContainer = document.getElementById(sectionContainerId);

    this.activeClass = options.activeClass || 'active';
    this.minVisibilityThreshold = 0.1;
    this.sectionSelector = options.sectionSelector || '.content-section';
    this.navItemSelector = options.navItemSelector || '.header-nav-item';
    this.sectionIdAttribute = options.sectionIdAttribute || 'data-section-id';

    this.sectionStates = new Map();
    this.currentActiveSection = null;

    this.handleMutations = this.handleMutations.bind(this);
    this.handleIntersections = this.handleIntersections.bind(this);

    this.init();
  }

  init() {
    if (!this.navContainer || !this.sectionContainer) {
      console.error('SectionNavigationTracker: Containers not found.');
      return;
    }

    this.setupIntersectionObserver();
    this.setupMutationObserver();
    this.observeExistingSections();
  }

  setupIntersectionObserver() {
    this.observer = new IntersectionObserver(this.handleIntersections, {
      root: null,
      rootMargin: '-80px 0px -50% 0px',
      threshold: [0, 0.1, 0.5, 1.0]
    });
  }

  setupMutationObserver() {
    this.domWatcher = new MutationObserver(this.handleMutations);
    this.domWatcher.observe(this.sectionContainer, { childList: true });
  }

  observeExistingSections() {
    const existingSections = this.sectionContainer.querySelectorAll(this.sectionSelector);
    existingSections.forEach(section => this.observer.observe(section));
  }

  handleMutations(mutations) {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && node.matches(this.sectionSelector)) {
          this.observer.observe(node);
        }
      });
    });
  }

  handleIntersections(entries) {
    this.updateSectionStates(entries);
    const mostVisibleSectionId = this.findMostVisibleSection();
    this.updateActiveNavItem(mostVisibleSectionId);
  }

  updateSectionStates(entries) {
    entries.forEach(entry => {
      const sectionId = entry.target.getAttribute(this.sectionIdAttribute);
      
      if (entry.isIntersecting && entry.intersectionRatio >= this.minVisibilityThreshold) {
        this.sectionStates.set(sectionId, {
          ratio: entry.intersectionRatio,
          element: entry.target
        });
      } else {
        this.sectionStates.delete(sectionId);
      }
    });
  }

  findMostVisibleSection() {
    let mostVisibleSectionId = null;
    let highestRatio = 0;

    this.sectionStates.forEach((state, sectionId) => {
      if (state.ratio > highestRatio) {
        highestRatio = state.ratio;
        mostVisibleSectionId = sectionId;
      }
    });

    return mostVisibleSectionId;
  }

  updateActiveNavItem(sectionId) {
    if (sectionId === null && this.currentActiveSection !== null) {
      this.clearAllActiveStates();
    }

    if (sectionId === this.currentActiveSection) {
      return;
    }

    if (sectionId) {
      this.setActiveState(sectionId);
    }

    this.currentActiveSection = sectionId;
  }

  clearAllActiveStates() {
    const allNavItems = this.navContainer.querySelectorAll(this.navItemSelector);
    allNavItems.forEach(item => item.classList.remove(this.activeClass));
  }

  setActiveState(sectionId) {
    const navItem = this.navContainer.querySelector(
      `${this.navItemSelector}[${this.sectionIdAttribute}="${sectionId}"]`
    );

    if (navItem) {
      navItem.classList.add(this.activeClass);
    }
  }

  disconnect() {
    this.observer.disconnect();
    this.domWatcher.disconnect();
  }
}

export default SectionNavigationTracker;
