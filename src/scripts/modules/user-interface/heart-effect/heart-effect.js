class HeartEffect {
  static DEFAULTS = {
    HEART_PAIRS: 7,
    DURATION: 3000,
    HEART_SYMBOL: '\u2764', // ❤
  };

  static _prefersReducedMotion = null;

  /**
   * Check if user prefers reduced motion (cached)
   */
  static get prefersReducedMotion() {
    if (HeartEffect._prefersReducedMotion === null) {
      HeartEffect._prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return HeartEffect._prefersReducedMotion;
  }

  /**
   * Attach heart effect to a container element
   * @param {HTMLElement} container - The container to attach the effect to
   */
  static attachTo(container) {
    if (HeartEffect.prefersReducedMotion) {
      return;
    }

    container.addEventListener('click', () => {
      HeartEffect._spawnHearts(container);
    });
  }

  static _spawnHearts(container) {
    for (let i = 0; i < HeartEffect.DEFAULTS.HEART_PAIRS; i++) {
      HeartEffect._createHeartPair(container);
    }
  }

  static _createHeartPair(container) {
    // Create yellow and blue hearts with slight position offset
    const baseX = Math.random() * 80 + 10; // 10-90%
    const baseY = Math.random() * 80 + 10;

    HeartEffect._createHeart(container, 'yellow', baseX, baseY);
    HeartEffect._createHeart(container, 'blue', baseX + 5, baseY + 5);
  }

  static _createHeart(container, color, x, y) {
    const heart = document.createElement('span');
    heart.className = `heart-effect heart-effect--${color}`;
    heart.textContent = HeartEffect.DEFAULTS.HEART_SYMBOL;
    heart.setAttribute('aria-hidden', 'true');

    // Position
    heart.style.left = `${x}%`;
    heart.style.top = `${y}%`;

    // Random fly direction via CSS custom properties
    const flyX = (Math.random() - 0.5) * 200; // -100 to +100px
    const flyY = -(Math.random() * 150 + 50); // -50 to -200px (upward)
    heart.style.setProperty('--fly-x', `${flyX}px`);
    heart.style.setProperty('--fly-y', `${flyY}px`);

    container.appendChild(heart);

    // Cleanup after animation
    setTimeout(() => heart.remove(), HeartEffect.DEFAULTS.DURATION);
  }
}

export default HeartEffect;
