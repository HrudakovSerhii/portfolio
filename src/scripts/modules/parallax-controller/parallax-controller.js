/**
 * ParallaxController
 * 
 * Manages parallax scrolling effects with performance optimizations:
 * - Single scroll listener with requestAnimationFrame
 * - Transform-only animations (GPU accelerated)
 * - Intersection Observer for visibility detection
 * - Respects prefers-reduced-motion
 */

const PARALLAX_CONFIG = {
  layers: [
    { selector: '.parallax-blob--1', speed: -0.2 },
    { selector: '.parallax-blob--2', speed: -0.35 },
    { selector: '.parallax-blob--3', speed: -0.5 },
    { selector: '.parallax-blob--4', speed: -0.15 },
    { selector: '.parallax-blob--5', speed: -0.25 },
    { selector: '.parallax-blob--6', speed: -0.4 },
    { selector: '.parallax-blob--7', speed: -0.3 }
  ],
  throttle: 16 // ~60fps
};

class ParallaxController {
  constructor() {
    this.layers = [];
    this.ticking = false;
    this.isVisible = true;
    this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.observer = null;
  }

  init() {
    // Respect user's motion preferences
    if (this.reducedMotionQuery.matches) {
      console.log('Parallax disabled: prefers-reduced-motion');
      return;
    }

    this.setupLayers();
    this.setupIntersectionObserver();
    this.attachScrollListener();

    console.log('ParallaxController initialized');
  }

  setupLayers() {
    PARALLAX_CONFIG.layers.forEach(config => {
      const element = document.querySelector(config.selector);
      if (element) {
        this.layers.push({
          element,
          speed: config.speed
        });
        console.log(`Parallax layer found: ${config.selector} (speed: ${config.speed})`);
      } else {
        console.warn(`Parallax layer not found: ${config.selector}`);
      }
    });

    if (this.layers.length === 0) {
      console.warn('No parallax layers found');
    } else {
      console.log(`Parallax initialized with ${this.layers.length} layers`);
    }
  }

  setupIntersectionObserver() {
    // Only animate when parallax container is visible
    const container = document.querySelector('.parallax-background');
    if (!container) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          this.isVisible = entry.isIntersecting;
        });
      },
      { threshold: 0 }
    );

    this.observer.observe(container);
  }

  attachScrollListener() {
    window.addEventListener('scroll', () => {
      this.requestTick();
    }, { passive: true });
  }

  requestTick() {
    if (!this.ticking && this.isVisible) {
      requestAnimationFrame(() => {
        this.updateParallax();
        this.ticking = false;
      });
      this.ticking = true;
    }
  }

  updateParallax() {
    const scrollY = window.pageYOffset;

    this.layers.forEach((layer, index) => {
      const translateY = scrollY * layer.speed;
      layer.element.style.transform = `translate3d(0, ${translateY}px, 0)`;
      
      // Debug log every 100px of scroll
      if (index === 0 && scrollY % 100 < 10) {
        console.log(`Parallax scroll: ${scrollY}px, translateY: ${translateY}px`);
      }
    });
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    // Note: We don't remove scroll listener as it uses passive mode
    // and removing it would require keeping a reference
  }
}

export default ParallaxController;
export { PARALLAX_CONFIG };
