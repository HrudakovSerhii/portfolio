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

    await this._animateSectionContent(sectionElement);

    this.stateManager.addRevealedSection(sectionId);
  }

  async restore(sectionId, role) {
    const { sectionContent } = await this._fetchSectionData(sectionId, role);
    
    const isZigZagLeft = this._calculateZigZagLayout(sectionId);
    const sectionElement = this._renderSection(sectionContent, isZigZagLeft);

    this._populateTextContent(sectionElement, sectionContent.text);
    this._populateImageContent(sectionElement, sectionContent);
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

  async _animateSectionContent(sectionElement) {
    const textElement = sectionElement.querySelector('.content-text');
    const imageContainer = sectionElement.querySelector('.content-image');

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

    const imageUrl = imageContainer.getAttribute('data-image-url');
    const imageAlt = imageContainer.getAttribute('data-image-alt');
    const aspectRatio = imageContainer.getAttribute('data-aspect-ratio');

    const generativeImage = this.animationController.createGenerativeImage(
      imageUrl,
      imageAlt,
      aspectRatio
    );

    if (generativeImage) {
      imageContainer.appendChild(generativeImage);
    }
  }

  _populateTextContent(sectionElement, text) {
    const textElement = sectionElement.querySelector('.content-text');
    
    if (textElement) {
      textElement.textContent = text;
    }
  }

  _populateImageContent(sectionElement, sectionContent) {
    const imageContainer = sectionElement.querySelector('.content-image');
    
    if (!imageContainer) {
      return;
    }

    const img = document.createElement('img');
    img.src = sectionContent.imageUrl;
    img.alt = sectionContent.imageAlt;
    img.className = `section-image ${sectionContent.aspectRatio}`;
    imageContainer.appendChild(img);
  }
}

export default SectionRenderer;
