/**
 * Animation Observer
 * Extends ScrollObserver to trigger animations when elements enter viewport
 * Used for progressive message reveals in chat sections
 */

import ScrollObserver from './scroll-observer.js';

class AnimationObserver extends ScrollObserver {
  constructor(options = {}) {
    const defaultOptions = {
      rootMargin: '0px 0px -10% 0px', // Trigger when element is 10% into viewport
      threshold: 0.1,
      selector: options.selector || '.chat-message',
      animationClass: options.animationClass || 'animate-in',
      staggerDelay: options.staggerDelay || 150, // ms between animations
      triggerOnce: options.triggerOnce !== false // Only animate once by default
    };

    super({ ...defaultOptions, ...options });

    this.animationClass = this.options.animationClass;
    this.staggerDelay = this.options.staggerDelay;
    this.triggerOnce = this.options.triggerOnce;
    this.animationIndex = 0;
  }

  /**
   * Called when an element intersects viewport
   * @param {IntersectionObserverEntry} entry - Intersection entry
   * @protected
   * @override
   */
  onIntersect(entry) {
    // Only trigger animation when element enters viewport
    if (!entry.isIntersecting) return;

    const element = entry.target;

    // Skip if already animated and triggerOnce is true
    if (this.triggerOnce && element.classList.contains(this.animationClass)) {
      return;
    }

    // Get animation delay from data attribute or calculate based on index
    const customDelay = parseInt(element.dataset.animationDelay);
    const delay = isNaN(customDelay)
      ? this.animationIndex * this.staggerDelay
      : customDelay;

    // Schedule animation
    setTimeout(() => {
      this.animateElement(element);
    }, delay);

    // Increment animation index for stagger effect
    this.animationIndex++;

    // Unobserve if triggerOnce is enabled
    if (this.triggerOnce) {
      this.unobserve(element);
    }
  }

  /**
   * Applies animation class to element
   * @param {HTMLElement} element - Element to animate
   * @protected
   */
  animateElement(element) {
    if (!element.classList.contains(this.animationClass)) {
      element.classList.add(this.animationClass);

      // Dispatch custom event for animation start
      element.dispatchEvent(new CustomEvent('animation:start', {
        bubbles: true,
        detail: { element }
      }));
    }
  }

  /**
   * Removes animation class from element
   * @param {HTMLElement} element - Element to reset
   */
  resetAnimation(element) {
    element.classList.remove(this.animationClass);

    // Dispatch custom event for animation reset
    element.dispatchEvent(new CustomEvent('animation:reset', {
      bubbles: true,
      detail: { element }
    }));
  }

  /**
   * Resets all animated elements
   */
  resetAllAnimations() {
    this.observedElements.forEach((state, element) => {
      this.resetAnimation(element);
    });
    this.animationIndex = 0;
  }
}

export default AnimationObserver;