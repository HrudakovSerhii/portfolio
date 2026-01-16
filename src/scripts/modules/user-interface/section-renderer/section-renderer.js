import { GenerativeImage } from '../generative-image/index.js';
import { SECTION_ELEMENTS, DEFAULT_GRID_CONFIG, SCROLL_DELAY } from './constants.js';
import ActionPromptManager from './action-prompt-manager.js';
import SectionAnimator from './section-animator.js';
import MetaItemRenderer from './meta-item-renderer.js';

class SectionRenderer {
  constructor(stateManager, contentMiddleware, templateBuilder, animationController) {
    this.stateManager = stateManager;
    this.contentMiddleware = contentMiddleware;
    this.templateBuilder = templateBuilder;

    this.sectionsContainer = null;
    this.actionPromptManager = null;
    this.sectionAnimator = new SectionAnimator(animationController);
  }

  initialize(sectionsContainerElement, sectionOrder, onActionPromptClick) {
    this.sectionsContainer = sectionsContainerElement;
    this.actionPromptManager = new ActionPromptManager(this.templateBuilder, sectionOrder);
    this.actionPromptManager.initialize(onActionPromptClick);
  }

  async reveal(sectionId, role, customQuery = '') {
    try {
      const { sectionContent, sectionMetadata } = await this._fetchSectionData(sectionId, role, customQuery);
      const profileData = await this._fetchProfileData();

      const sectionElement = this._renderSection(sectionId, sectionContent);

      this._populateText(sectionElement, sectionContent.text);
      this._populateSubText(sectionElement, sectionContent.subText);
      this._renderMetaItems(sectionElement, sectionId, sectionMetadata, profileData, role);

      this._scrollToSection(sectionElement);

      this.actionPromptManager.showTyping(sectionId);

      await this.sectionAnimator.animateSection(sectionElement, sectionContent);

      this.actionPromptManager.hideTyping(sectionId);

      this.stateManager.addRevealedSection(sectionId);

      this._updateActionPrompt(sectionId);
    } catch (error) {
      console.error(`Failed to reveal section ${sectionId}:`, error);
      this.actionPromptManager.hideTyping(sectionId);
    }
  }

  async restore(sectionId, role) {
    const { sectionContent, sectionMetadata } = await this._fetchSectionData(sectionId, role);
    const profileData = await this._fetchProfileData();

    const sectionElement = this._renderSection(sectionId, sectionContent);

    this._populateText(sectionElement, sectionContent.text);
    this._populateSubText(sectionElement, sectionContent.subText);
    this._populateImage(sectionElement, sectionContent.image);
    this._renderMetaItems(sectionElement, sectionId, sectionMetadata, profileData, role);

    this._updateActionPrompt(sectionId);
  }

  _renderSection(sectionId, sectionContent) {
    const sectionElement = this.templateBuilder.renderSection(sectionId, sectionContent);
    
    // Create and append action prompt to section before mounting to DOM
    const promptElement = this.actionPromptManager.createForSection(sectionId);
    sectionElement.appendChild(promptElement);
    
    const lastSectionElement = this.sectionsContainer.lastChild;
    this.sectionsContainer.insertBefore(sectionElement, lastSectionElement);

    return sectionElement;
  }

  _renderMetaItems(sectionElement, sectionId, sectionMetadata, profileData, role) {
    if (!sectionMetadata?.mainItems) {
      return;
    }

    // Contact section: update existing template links instead of creating new elements
    if (sectionId === 'contact') {
      this._updateContactLinks(sectionElement, sectionMetadata.mainItems, profileData, role);
      return;
    }

    const metaItemRenderer = new MetaItemRenderer(this.templateBuilder, profileData);

    if (sectionId === 'projects') {
      this._renderCarouselItems(metaItemRenderer, sectionElement, sectionId, sectionMetadata);
    } else {
      this._renderDefaultItems(metaItemRenderer, sectionElement, sectionId, sectionMetadata, role);
    }
  }

  _updateContactLinks(sectionElement, mainItems, profileData, role) {
    const emailItem = mainItems.find(item => item.type === 'email');
    if (!emailItem) return;

    const emailLink = sectionElement.querySelector('.contacts-item_email');
    if (!emailLink) return;

    const email = profileData?.email || '';
    const roleData = emailItem.roleItems?.[role] || {};
    const subject = encodeURIComponent(roleData.subject || '');
    const body = encodeURIComponent(roleData.body || '');

    emailLink.href = `mailto:${email}?subject=${subject}&body=${body}`;
  }

  _renderCarouselItems(metaItemRenderer, sectionElement, sectionId, sectionMetadata) {
    const metaItemsContainer = sectionElement.querySelector(`.${SECTION_ELEMENTS.carouselMetaItems}`);

    if (!metaItemsContainer || !sectionMetadata?.mainItems) {
      return;
    }

    metaItemRenderer.renderInCarousel(metaItemsContainer, sectionId, sectionMetadata.mainItems);
  }

  _renderDefaultItems(metaItemRenderer, sectionElement, sectionId, sectionMetadata, role) {
    const metaItemsContainer = sectionElement.querySelector(`.${SECTION_ELEMENTS.metaItems}`);

    if (!metaItemsContainer || !sectionMetadata?.mainItems) {
      return;
    }

    const renderedItems = metaItemRenderer.render(sectionId, sectionMetadata.mainItems, role);

    if (renderedItems) {
      metaItemsContainer.appendChild(renderedItems);
    }
  }

  _updateActionPrompt(sectionId) {
    const revealedSections = this.stateManager.getRevealedSections();
    this.actionPromptManager.update(sectionId, revealedSections);
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

  _scrollToSection(sectionElement) {
    if (!sectionElement) {
      return;
    }

    setTimeout(() => {
      sectionElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, SCROLL_DELAY);
  }

  _populateText(sectionElement, text) {
    const textElement = sectionElement.querySelector(`.${SECTION_ELEMENTS.text}`);

    if (textElement) {
      textElement.textContent = text;
    }
  }

  _populateSubText(sectionElement, text) {
    const textElement = sectionElement.querySelector(`.${SECTION_ELEMENTS.subText}`);

    if (textElement) {
      textElement.textContent = text;
    }
  }

  _populateImage(sectionElement, imageData) {
    const imageContainer = sectionElement.querySelector(`.${SECTION_ELEMENTS.image}`);

    if (!imageContainer) {
      return;
    }

    const generativeImage = new GenerativeImage({
      highResSrc: imageData.imageUrl,
      lowResSrc: imageData.lowResImageUrl || '',
      alt: imageData.imageAlt,
      aspectClass: imageData.aspectRatio,
      shouldAnimate: false,
      gridConfig: DEFAULT_GRID_CONFIG
    });

    const imageElement = generativeImage.create();
    imageContainer.appendChild(imageElement);
  }
}

export default SectionRenderer;
