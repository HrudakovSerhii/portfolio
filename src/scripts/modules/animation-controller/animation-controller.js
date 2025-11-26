const ANIMATION_CONFIG = {
  typewriter: {
    defaultSpeed: 30,
    navigationSpeed: 50,
    fastSpeed: 15
  },
  image: {
    placeholderDelay: 500,
    transitionDuration: 2000,
    badgeFadeDelay: 1500
  },
  scroll: {
    behavior: 'smooth',
    duration: 800
  }
};

class AnimationController {
  constructor() {
    this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  }

  shouldAnimate() {
    return !this.reducedMotionQuery.matches;
  }

  async typewriterEffect(element, text, speed = ANIMATION_CONFIG.typewriter.defaultSpeed) {
    if (!this.shouldAnimate()) {
      element.textContent = text;
      return Promise.resolve();
    }

    element.textContent = '';

    for (let i = 0; i < text.length; i++) {
      element.textContent += text[i];
      await new Promise(resolve => setTimeout(resolve, speed));
    }

    return Promise.resolve();
  }

  async animateNavigationItem(element) {
    const titleElement = element.querySelector('.nav-title');
    
    if (!titleElement) {
      return Promise.resolve();
    }

    const titleText = titleElement.textContent;
    
    return this.typewriterEffect(
      titleElement, 
      titleText, 
      ANIMATION_CONFIG.typewriter.navigationSpeed
    );
  }
}

export default AnimationController;
export { ANIMATION_CONFIG };
