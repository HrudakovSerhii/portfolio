/**
 * AnimationEngine - Handles typewriter effects and image loading animations
 * Provides smooth, AI-like text generation and image reveal effects
 * Respects user's motion preferences for accessibility
 */

// Animation configuration constants
const ANIMATION_CONFIG = {
  typewriter: {
    defaultSpeed: 30,      // milliseconds per character
    navigationSpeed: 50,   // slower for navigation items
    fastSpeed: 15          // faster option for future use
  },
  image: {
    placeholderDelay: 500,    // delay before starting image load
    transitionDuration: 2000, // blur and opacity transition time
    badgeFadeDelay: 1500      // delay before removing badge
  },
  scroll: {
    behavior: 'smooth',
    duration: 800
  }
};

class AnimationEngine {
  constructor() {
    // Cache the prefers-reduced-motion query
    this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  }

  /**
   * Check if animations should be enabled
   * @returns {boolean} True if animations should run
   */
  shouldAnimate() {
    return !this.reducedMotionQuery.matches;
  }

  /**
   * Typewriter effect - inserts characters one-by-one into element
   * @param {HTMLElement} element - Target element to insert text into
   * @param {string} text - Text content to animate
   * @param {number} speed - Milliseconds per character (default: 30ms)
   * @returns {Promise<void>} Resolves when animation completes
   */
  async typewriterEffect(element, text, speed = ANIMATION_CONFIG.typewriter.defaultSpeed) {
    // Skip animation if user prefers reduced motion
    if (!this.shouldAnimate()) {
      element.textContent = text;

      return Promise.resolve();
    }

    // Clear existing content
    element.textContent = '';

    // Insert characters one by one
    for (let i = 0; i < text.length; i++) {
      element.textContent += text[i];
      
      // Wait for the specified speed before next character
      await new Promise(resolve => setTimeout(resolve, speed));
    }

    return Promise.resolve();
  }

  /**
   * Create generative image component with loading animation
   * @param {string} src - Image source URL
   * @param {string} alt - Image alt text
   * @param {string} aspectClass - CSS class for aspect ratio (e.g., 'aspect-video')
   * @returns {HTMLElement} Container element with placeholder, image, and badge
   */
  createGenerativeImage(src, alt, aspectClass = '') {
    // Get template from DOM
    const template = document.getElementById('generative-image-template');

    if (!template) {
      console.error('Generative image template not found');
      return null;
    }

    // Clone template content
    const container = template.content.cloneNode(true).querySelector('.generative-image');
    
    // Add aspect ratio class if provided
    if (aspectClass) {
      container.classList.add(aspectClass);
    }

    // Set image attributes
    const img = container.querySelector('.generative-image__img');
    const badge = container.querySelector('.generative-image__badge');
    
    img.src = src;
    img.alt = alt;

    // Handle animations based on user preference
    if (!this.shouldAnimate()) {
      // Skip animations - show image immediately
      img.classList.add('loaded');
      badge.remove();

      return container;
    }

    // Delay image load by 500ms
    setTimeout(() => {
      // Start loading the image
      img.onload = () => {
        // Add loaded class to trigger CSS transitions
        img.classList.add('loaded');

        // Fade out and remove badge after 1500ms
        setTimeout(() => {
          badge.classList.add('fade-out');
          setTimeout(() => {
            badge.remove();
          }, 300); // Wait for fade transition to complete
        }, ANIMATION_CONFIG.image.badgeFadeDelay);
      };

      // Handle image load errors
      img.onerror = () => {
        console.warn(`Failed to load image: ${src}`);
        img.classList.add('loaded', 'error');
        badge.textContent = 'Image unavailable';
        setTimeout(() => {
          badge.classList.add('fade-out');
          setTimeout(() => badge.remove(), 300);
        }, 1000);
      };
    }, ANIMATION_CONFIG.image.placeholderDelay);

    return container;
  }

  /**
   * Animate navigation item appearance
   * @param {HTMLElement} element - Navigation item element
   * @returns {Promise<void>} Resolves when animation completes
   */
  async animateNavigationItem(element) {
    const titleElement = element.querySelector('.nav-title');
    
    if (!titleElement) {
      return Promise.resolve();
    }

    const titleText = titleElement.textContent;
    
    // Use typewriter effect with navigation speed
    return this.typewriterEffect(
      titleElement, 
      titleText, 
      ANIMATION_CONFIG.typewriter.navigationSpeed
    );
  }
}

// Export the class and configuration for testing
export default AnimationEngine;
export { ANIMATION_CONFIG };
