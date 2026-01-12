import { GenerativeImage } from '../generative-image/index.js';
import { SECTION_ELEMENTS, DEFAULT_GRID_CONFIG } from './constants.js';

class SectionAnimator {
  constructor(animationController) {
    this.animationController = animationController;
    this.imageInstances = new WeakMap();
  }

  async animateSection(sectionElement, sectionContent) {
    const textElement = sectionElement.querySelector(`.${SECTION_ELEMENTS.text}`);
    const imageContainer = sectionElement.querySelector(`.${SECTION_ELEMENTS.image}`);

    this._createAnimatedImage(imageContainer, sectionContent.image);

    const textPromise = this._animateText(textElement);
    const imagePromise = this._animateImage(imageContainer);

    await Promise.all([textPromise, imagePromise]);
  }

  async _animateText(textElement) {
    if (!textElement) {
      return;
    }

    const textContent = textElement.getAttribute('data-text');
    await this.animationController.typewriterEffect(textElement, textContent);
  }

  async _animateImage(imageContainer) {
    if (!imageContainer) {
      return;
    }

    const generativeImage = this.imageInstances.get(imageContainer);

    if (generativeImage) {
      await generativeImage.load();
    }
  }

  _createAnimatedImage(imageContainer, imageData) {
    if (!imageContainer) {
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const generativeImage = new GenerativeImage({
      highResSrc: imageData.imageUrl,
      lowResSrc: imageData.lowResImageUrl || '',
      alt: imageData.imageAlt,
      aspectClass: imageData.aspectRatio,
      shouldAnimate: !prefersReducedMotion,
      gridConfig: DEFAULT_GRID_CONFIG
    });

    const imageElement = generativeImage.create();
    imageContainer.appendChild(imageElement);
    this.imageInstances.set(imageContainer, generativeImage);
  }
}

export default SectionAnimator;
