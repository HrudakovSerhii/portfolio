import { GenerativeImage } from '../generative-image/index.js';
import { Carousel } from '../carousel/index.js';
import ChatSectionRenderer from '../chat-section-renderer/index.js';
import { getMessagesForSection } from '../../../../data/chat-content.js';

const SCROLL_DELAY = 30;

const SECTIONS_WITH_ITEMS = ["experience", "projects"];
const SECTION_ELEMENTS = {
  text: 'section-body-content',
  image: 'section-visual-container'
};

// Sections that use chat-based layout
const CHAT_SECTIONS = ['about', 'experience', 'projects', 'skills'];

class SectionRenderer {
  constructor(stateManager, contentMiddleware, templateBuilder, animationController) {
    this.stateManager = stateManager;
    this.contentMiddleware = contentMiddleware;
    this.templateBuilder = templateBuilder;
    this.animationController = animationController;
    this.chatSectionRenderer = new ChatSectionRenderer(templateBuilder, stateManager);

    this.sectionsContainer = null;
    this.typingIndicator = null;
    this.sectionOrder = [];
    this.onActionPromptClick = null;
    this.actionPromptElement = null;
  }

  initialize(sectionsContainerElement, typingIndicatorElement, sectionOrder, onActionPromptClick) {
    this.sectionsContainer = sectionsContainerElement;
    this.typingIndicator = typingIndicatorElement;
    this.sectionOrder = sectionOrder;
    this.onActionPromptClick = onActionPromptClick;
    this._initializeActionPrompt();
  }

  _initializeActionPrompt() {
    this.actionPromptElement = this.templateBuilder.renderActionPrompt('placeholder', '');
    this.actionPromptElement.style.display = 'none';
    this.sectionsContainer.appendChild(this.actionPromptElement);
  }

  async reveal(sectionId, role, customQuery = '') {
    this._showTypingIndicator();

    // Check if this section should use chat layout
    if (CHAT_SECTIONS.includes(sectionId)) {
      await this._revealChatSection(sectionId, role);
    } else {
      await this._revealTraditionalSection(sectionId, role, customQuery);
    }

    this._hideTypingIndicator();
    this.stateManager.addRevealedSection(sectionId);
    await this._updateActionPrompt(sectionId);
  }

  async _revealChatSection(sectionId, role) {
    const sectionElement = this._createChatSectionContainer(sectionId);
    const messages = getMessagesForSection(sectionId, role);
    const messagesContainer = sectionElement.querySelector('.chat-messages-container');

    if (messagesContainer) {
      this.chatSectionRenderer.renderMessages(messagesContainer, messages, role);
    }

    if (sectionElement && SECTIONS_WITH_ITEMS.includes(sectionId)) {
      await this._renderSectionDetails(sectionId, sectionElement);
    }

    this._scrollToSection(sectionElement);
  }

  async _renderSectionDetails(sectionId, sectionElement) {
    const itemsContainer = sectionElement.querySelector(`#${sectionId}-items`);
    const items = await this._renderSectionItems(sectionId);

    if (sectionId === 'projects') {
      const carousel = new Carousel(itemsContainer, items, {
        loop: false,
        navigation: true,
        gap: 16
      });

      carousel.render();
    } else {
      itemsContainer.append(items);
    }
  }

  async _revealTraditionalSection(sectionId, role, customQuery) {
    const sectionData = await this._fetchSectionData(sectionId, role, customQuery);
    const profileData = await this._fetchProfileData();

    const sectionElement = await this._renderSectionWithContent(sectionData.sectionContent, profileData);

    this._scrollToSection(sectionElement);

    await this._animateSectionContent(sectionElement, sectionData.sectionContent);
  }

  async restore(sectionId, role) {
    // Check if this section should use chat layout
    if (CHAT_SECTIONS.includes(sectionId)) {
      await this._revealChatSection(sectionId, role);
    } else {
      await this._restoreTraditionalSection(sectionId, role);
    }

    await this._updateActionPrompt(sectionId);
  }

  async _restoreTraditionalSection(sectionId, role) {
    const sectionData = await this._fetchSectionData(sectionId, role);
    const profileData = await this._fetchProfileData();

    const sectionElement = await this._renderSectionWithContent(sectionData.sectionContent, profileData);

    this._populateTextContent(sectionElement, sectionData.sectionContent.text);
    this._populateImageContent(sectionElement, sectionData.sectionContent.image);
  }

  async _renderSectionWithContent(sectionContent, profileData) {
    const sectionId = sectionContent.sectionId;
    const isZigZagLeft = this._calculateZigZagLayout(sectionId);

    return this._renderSection(sectionContent, profileData, isZigZagLeft);
  }

  async _updateActionPrompt(currentSectionId) {
    const nextSectionId = this._getNextSectionId(currentSectionId);
    const isLastRevealed = this._isLastRevealedSection(currentSectionId);

    if (nextSectionId && isLastRevealed) {
      await this._showActionPrompt(nextSectionId);
    } else {
      this._hideActionPrompt();
    }
  }

  _isLastRevealedSection(sectionId) {
    const revealedSections = this.stateManager.getRevealedSections();
    const lastRevealedId = revealedSections[revealedSections.length - 1];
    return lastRevealedId === sectionId;
  }

  async _showActionPrompt(nextSectionId) {
    if (!this.actionPromptElement) {
      return;
    }

    try {
      // TODO: placeholder will be used for custom query input in next version
      // const placeholder = await this.contentMiddleware.getActionPromptPlaceholder(nextSectionId);
      const button = this.actionPromptElement.querySelector('.prompt-button');

      if (button) {
        const sectionName = nextSectionId.charAt(0).toUpperCase() + nextSectionId.slice(1);
        const buttonText = `Read next: ${sectionName}`;
        button.textContent = buttonText;
        button.setAttribute('data-default-text', buttonText);
        button.setAttribute('data-section-id', nextSectionId);
      }

      this.actionPromptElement.setAttribute('data-section-id', nextSectionId);
      this.actionPromptElement.id = `action-prompt-${nextSectionId}`;

      this._setupActionPromptHandler(nextSectionId);

      this.actionPromptElement.style.display = 'flex';

      requestAnimationFrame(() => {
        this.actionPromptElement.classList.add('action-prompt--visible');
      });
    } catch (error) {
      console.error('Failed to show action prompt:', error);
    }
  }

  _hideActionPrompt() {
    if (!this.actionPromptElement) {
      return;
    }

    this.actionPromptElement.classList.remove('action-prompt--visible');
    this.actionPromptElement.style.display = 'none';
  }

  _setupActionPromptHandler(nextSectionId) {
    const button = this.actionPromptElement.querySelector('.prompt-button');

    if (!button || !this.onActionPromptClick) {
      return;
    }

    // Remove old listeners by cloning the button
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);

    newButton.addEventListener('click', async () => {
      this._hideActionPrompt();
      await this.onActionPromptClick(nextSectionId);
    });
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

  async _fetchProfileData() {
    return await this.contentMiddleware.getUserProfile();
  }

  async _fetchSectionData(sectionId, role, customQuery = '') {
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

  async _renderSection(sectionContent, profileData, isZigZagLeft) {
    const sectionElement = this.templateBuilder.renderSection(sectionContent, isZigZagLeft, profileData);
    const lastSectionElement = this.sectionsContainer.lastChild;

    this.sectionsContainer.insertBefore(sectionElement, lastSectionElement);

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

  /**
   * Renders section items from metadata main_items
   * @param {String} sectionId - Section id
   * @return {Promise<Array[HTMLElement]>} items - List of HTML elements
   * @private
   */
  async _renderSectionItems(sectionId) {
    const metadata = await this.contentMiddleware.getSectionMetadata(sectionId);
    if (!metadata?.mainItems) return;

    const items = [];

    metadata.mainItems.forEach(item => {
      if (item.type === sectionId) {
        const itemFragment = this.templateBuilder.renderSectionItem(sectionId, item);
        items.push(itemFragment);
      }
    });

    return items;
  }

  /**
   * Creates a chat section container using the appropriate template
   * @param {string} sectionId - Section identifier
   * @returns {HTMLElement} Chat section element
   * @private
   */
  _createChatSectionContainer(sectionId) {
    // Map section IDs to template IDs
    const templateIdMap = {
      about: 'chat-about-section-template',
      experience: 'chat-experience-section-template',
      projects: 'chat-projects-section-template',
      skills: 'chat-skills-section-template'
    };

    const templateId = templateIdMap[sectionId];

    if (!templateId) {
      console.error(`No chat template found for section: ${sectionId}`);
      // Fallback to creating a simple container
      const section = document.createElement('section');
      section.className = 'content-section chat-section';
      section.setAttribute('data-section-id', sectionId);
      section.id = `section-${sectionId}`;

      const messagesContainer = document.createElement('div');
      messagesContainer.className = 'chat-messages-container';
      section.appendChild(messagesContainer);

      const lastSectionElement = this.sectionsContainer.lastChild;
      this.sectionsContainer.insertBefore(section, lastSectionElement);

      return section;
    }

    // Use template
    const template = document.getElementById(templateId);
    if (!template) {
      throw new Error(`Template with id "${templateId}" not found in DOM`);
    }

    const fragment = template.content.cloneNode(true);
    const section = fragment.querySelector('.content-section');

    if (!section) {
      throw new Error(`Section element not found in template: ${templateId}`);
    }

    // Set section ID attributes
    section.setAttribute('data-section-id', sectionId);
    section.id = `section-${sectionId}`;

    // Insert before action prompt
    const lastSectionElement = this.sectionsContainer.lastChild;
    this.sectionsContainer.insertBefore(section, lastSectionElement);

    return section;
  }
}

export default SectionRenderer;
