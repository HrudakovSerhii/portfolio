import { GenerativeImage } from '../generative-image/index.js';

class SectionRenderer {
  constructor(stateManager, contentMiddleware, templateBuilder, animationController) {
    this.stateManager = stateManager;
    this.contentMiddleware = contentMiddleware;
    this.templateBuilder = templateBuilder;
    this.animationController = animationController;

    this.sectionsContainer = null;
    this.typingIndicator = null;
    this.sectionOrder = [];
  }

  initialize(sectionsContainerElement, typingIndicatorElement, sectionOrder) {
    this.sectionsContainer = sectionsContainerElement;
    this.typingIndicator = typingIndicatorElement;
    this.sectionOrder = sectionOrder;
  }

  async reveal(sectionId, role, customQuery = null) {
    this._showTypingIndicator();

    const { sectionContent } = await this._fetchSectionData(sectionId, role, customQuery);

    this._hideTypingIndicator();

    const isZigZagLeft = this._calculateZigZagLayout(sectionId);
    const sectionElement = this._renderSection(sectionContent, isZigZagLeft);

    await this._animateSectionContent(sectionElement, sectionContent);

    this.stateManager.addRevealedSection(sectionId);
  }

  async restore(sectionId, role) {
    const { sectionContent } = await this._fetchSectionData(sectionId, role);

    const isZigZagLeft = this._calculateZigZagLayout(sectionId);
    const sectionElement = this._renderSection(sectionContent, isZigZagLeft);

    this._populateTextContent(sectionElement, sectionContent.text);
    
    const imageData = sectionContent.image[role] || sectionContent.image.default;
    this._populateImageContent(sectionElement, imageData);
  }

  _showTypingIndicator() {
    if (this.typingIndicator) {
      this.typingIndicator.style.display = 'flex';
    }
  }

  _hideTypingIndicator() {
    if (this.typingIndicator) {
      this.typingIndicator.style.display = 'none';
    }
  }

  async _fetchSectionData(sectionId, role, customQuery = null) {
    const sectionContent = await this.contentMiddleware.fetchSectionContent(
      sectionId,
      role,
      customQuery
    );
    const sectionMetadata = await this.contentMiddleware.getSectionMetadata(sectionId);

    return { sectionContent, sectionMetadata };
  }

  _calculateZigZagLayout(sectionId) {
    const sectionIndex = this.sectionOrder.indexOf(sectionId);
    return sectionIndex % 2 === 0;
  }

  _renderSection(sectionContent, isZigZagLeft) {
    const sectionElement = this.templateBuilder.renderSection(sectionContent, isZigZagLeft);
    this.sectionsContainer.appendChild(sectionElement);
    return sectionElement;
  }

  async _animateSectionContent(sectionElement, sectionContent) {
    const textElement = sectionElement.querySelector('.content-text');
    const imageContainer = sectionElement.querySelector('.content-image');

    const role = this.stateManager.getRole();
    const imageData = sectionContent.image[role] || sectionContent.image.default;
    
    this._createImage(imageContainer, imageData, true);

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

  _createImage(imageContainer, imageData, shouldAnimate = false) {
    if (!imageContainer) {
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const enableAnimation = shouldAnimate && !prefersReducedMotion;

    const generativeImage = new GenerativeImage({
      highResSrc: imageData.imageUrl,
      lowResSrc: imageData.lowResImageUrl,
      alt: imageData.imageAlt,
      aspectClass: imageData.aspectRatio,
      shouldAnimate: enableAnimation,
      gridConfig: { rows: 4, cols: 4, delay: 50 }
    });

    const imageElement = generativeImage.create();
    imageContainer.appendChild(imageElement);
    imageContainer.generativeImage = generativeImage;
  }

  async _animateImage(imageContainer) {
    if (!imageContainer || !imageContainer.generativeImage) {
      return;
    }

    await imageContainer.generativeImage.load();
  }

  _populateTextContent(sectionElement, text) {
    const textElement = sectionElement.querySelector('.content-text');

    if (textElement) {
      textElement.textContent = text;
    }
  }

  _populateImageContent(sectionElement, sectionImageContent) {
    const imageContainer = sectionElement.querySelector('.content-image');
    this._createImage(imageContainer, sectionImageContent, false);
  }
}

export default SectionRenderer;
