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
  createGenerativeImage(src, alt, aspectClass) {
    // Create container
    const container = document.createElement('div');
    container.className = `image-container ${aspectClass}`;
    container.style.position = 'relative';
    container.style.overflow = 'hidden';

    // Create animated gradient placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'image-placeholder';
    placeholder.style.position = 'absolute';
    placeholder.style.top = '0';
    placeholder.style.left = '0';
    placeholder.style.width = '100%';
    placeholder.style.height = '100%';
    placeholder.style.background = 'linear-gradient(45deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)';
    placeholder.style.backgroundSize = '200% 200%';
    placeholder.style.animation = 'gradient-shift 2s ease infinite';
    container.appendChild(placeholder);

    // Create image element
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.position = 'relative';
    img.style.zIndex = '1';

    // Create "Generating image..." badge
    const badge = document.createElement('div');
    badge.className = 'generation-badge';
    badge.textContent = 'Generating image...';
    badge.style.position = 'absolute';
    badge.style.bottom = '1rem';
    badge.style.right = '1rem';
    badge.style.padding = '0.5rem 1rem';
    badge.style.background = 'rgba(0, 0, 0, 0.7)';
    badge.style.color = 'white';
    badge.style.borderRadius = '0.5rem';
    badge.style.fontSize = '0.875rem';
    badge.style.zIndex = '2';
    badge.style.transition = 'opacity 0.3s ease';
    container.appendChild(badge);

    // Handle animations based on user preference
    if (!this.shouldAnimate()) {
      // Skip animations - show image immediately
      img.style.filter = 'none';
      img.style.opacity = '1';
      container.appendChild(img);
      badge.remove();
      return container;
    }

    // Apply initial blur and opacity for animation
    img.style.filter = 'blur(20px)';
    img.style.opacity = '0';
    img.style.transition = `filter ${ANIMATION_CONFIG.image.transitionDuration}ms ease, opacity ${ANIMATION_CONFIG.image.transitionDuration}ms ease`;

    // Delay image load by 500ms
    setTimeout(() => {
      // Start loading the image
      img.onload = () => {
        // Transition from blurred/transparent to sharp/opaque
        img.style.filter = 'blur(0px)';
        img.style.opacity = '1';

        // Fade out and remove badge after 1500ms
        setTimeout(() => {
          badge.style.opacity = '0';
          setTimeout(() => {
            badge.remove();
          }, 300); // Wait for fade transition to complete
        }, ANIMATION_CONFIG.image.badgeFadeDelay);
      };

      // Handle image load errors
      img.onerror = () => {
        console.warn(`Failed to load image: ${src}`);
        img.style.filter = 'none';
        img.style.opacity = '1';
        badge.textContent = 'Image unavailable';
        setTimeout(() => {
          badge.style.opacity = '0';
          setTimeout(() => badge.remove(), 300);
        }, 1000);
      };

      container.appendChild(img);
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
