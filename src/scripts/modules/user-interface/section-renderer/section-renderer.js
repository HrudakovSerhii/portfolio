import { GenerativeImage } from '../generative-image/index.js';

const SCROLL_DELAY = 100;

const SECTION_ELEMENTS = {
  text: 'section-body-content',
  image: 'section-visual-container'
};

class SectionRenderer {
  constructor(stateManager, contentMiddleware, templateBuilder, animationController) {
    this.stateManager = stateManager;
    this.contentMiddleware = contentMiddleware;
    this.templateBuilder = templateBuilder;
    this.animationController = animationController;

    this.sectionsContainer = null;
    this.typingIndicator = null;
    this.sectionOrder = [];
    this.onActionPromptClick = null;
  }

  initialize(sectionsContainerElement, typingIndicatorElement, sectionOrder, onActionPromptClick) {
    this.sectionsContainer = sectionsContainerElement;
    this.typingIndicator = typingIndicatorElement;
    this.sectionOrder = sectionOrder;
    this.onActionPromptClick = onActionPromptClick;
  }

  async reveal(sectionId, role, customQuery = null) {
    this._showTypingIndicator();

    const { sectionContent } = await this._fetchSectionData(sectionId, role, customQuery);

    this._hideTypingIndicator();

    const isZigZagLeft = this._calculateZigZagLayout(sectionId);
    const sectionElement = this._renderSection(sectionContent, isZigZagLeft);

    const nextSectionId = this._getNextSectionId(sectionId);
    if (nextSectionId) {
      await this._renderActionPrompt(sectionElement, nextSectionId);
    }

    this._scrollToSection(sectionElement);

    await this._animateSectionContent(sectionElement, sectionContent);

    if (nextSectionId) {
      this._revealActionPrompt(sectionElement);
    }

    this.stateManager.addRevealedSection(sectionId);
  }

  async restore(sectionId, role) {
    const { sectionContent } = await this._fetchSectionData(sectionId, role);

    const isZigZagLeft = this._calculateZigZagLayout(sectionId);
    const sectionElement = this._renderSection(sectionContent, isZigZagLeft);

    this._populateTextContent(sectionElement, sectionContent.text);

    const imageData = sectionContent.image;
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

  _scrollToSection(sectionElement) {
    if (!sectionElement) {
      return;
    }

    // Small delay to ensure DOM is fully rendered
    setTimeout(() => {
      sectionElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, SCROLL_DELAY);
  }

  async _animateSectionContent(sectionElement, sectionContent) {
    const textElement = sectionElement.querySelector(`.${SECTION_ELEMENTS.text}`);
    const imageContainer = sectionElement.querySelector(`.${SECTION_ELEMENTS.image}`);

    const imageData = sectionContent.image;

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
      lowResSrc: imageData.lowResImageUrl || '',
      alt: imageData.imageAlt,
      aspectClass: imageData.aspectRatio,
      shouldAnimate: enableAnimation,
      gridConfig: { rows: 4, cols: 4, delay: 500 }
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
    const textElement = sectionElement.querySelector(`.${SECTION_ELEMENTS.text}`);

    if (textElement) {
      textElement.textContent = text;
    }
  }

  _populateImageContent(sectionElement, sectionImageContent) {
    const imageContainer = sectionElement.querySelector(`.${SECTION_ELEMENTS.image}`);
    this._createImage(imageContainer, sectionImageContent, false);
  }

  _getNextSectionId(currentSectionId) {
    const currentIndex = this.sectionOrder.indexOf(currentSectionId);
    return this.sectionOrder[currentIndex + 1] || null;
  }

  async _renderActionPrompt(sectionElement, nextSectionId) {
    if (!sectionElement || !nextSectionId) {
      return;
    }

    try {
      await this._tryToRenderActionPrompt(sectionElement, nextSectionId);
    } catch (error) {
      console.error('Failed to render action prompt:', error);
    }
  }

  async _tryToRenderActionPrompt(sectionElement, nextSectionId) {
    const placeholder = await this.contentMiddleware.getActionPromptPlaceholder(nextSectionId);
    const actionPrompt = this.templateBuilder.renderActionPrompt(nextSectionId, placeholder);

    this._setupActionPromptHandler(actionPrompt, nextSectionId);

    sectionElement.appendChild(actionPrompt);
  }

  _setupActionPromptHandler(actionPrompt, nextSectionId) {
    const button = actionPrompt.querySelector('.prompt-button');

    if (!button || !this.onActionPromptClick) {
      return;
    }

    button.addEventListener('click', async () => {
      actionPrompt.remove();
      await this.onActionPromptClick(nextSectionId);
    });
  }

  _revealActionPrompt(sectionElement) {
    if (!sectionElement) {
      return;
    }

    const actionPrompt = sectionElement.querySelector('.action-prompt');
    if (actionPrompt) {
      requestAnimationFrame(() => {
        actionPrompt.classList.add('action-prompt--visible');
      });
    }
  }
}

export default SectionRenderer;
