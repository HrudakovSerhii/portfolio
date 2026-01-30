import { GenerativeImage } from '../generative-image/index.js';

import SectionAnimator from './section-animator.js';
import MetaItemRenderer from './meta-item-renderer.js';
import Drawer from './drawer.js';

import TranslationService from '../../translations.js';

import { trackSectionView } from '../../analytics';

import { SECTION_ELEMENTS, DEFAULT_GRID_CONFIG, SCROLL_DELAY } from './constants.js';

export function translateDeep(data) {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return translateValue(data);
  }

  if (Array.isArray(data)) {
    return data.map(item => translateDeep(item));
  }

  if (typeof data === 'object') {
    const result = {};
    for (const key of Object.keys(data)) {
      result[key] = translateDeep(data[key]);
    }
    return result;
  }

  return data;
}

function translateValue(value) {
  if (typeof value !== 'string' || !value) {
    return value;
  }
  return TranslationService.t(value);
}

class SectionRenderer {
  constructor(stateManager, contentMiddleware, templateBuilder, animationController) {
    this.stateManager = stateManager;
    this.contentMiddleware = contentMiddleware;
    this.templateBuilder = templateBuilder;

    this.nextSectionPrompt = null;
    this.sectionsContainer = null;
    this.sectionAnimator = new SectionAnimator(animationController, templateBuilder);
  }

  initialize(sectionsContainerElement, sectionOrder, onActionPromptClick) {
    this.sectionsContainer = sectionsContainerElement;

    this._initNextSectionPrompts(onActionPromptClick);
  }

  _updateNextSectionPromptButton(promptText = `Read next: sectionId`) {
    const button = this.nextSectionPrompt.querySelector('.prompt-button');

    button.textContent = promptText;
    button.setAttribute('data-default-text', promptText);
  }

  _initNextSectionPrompts(onNextSectionClick) {
    this.nextSectionPrompt = document.getElementById('next-section-prompt');

    if (!this.nextSectionPrompt) {
      console.warn('No next section prompt found');
      return;
    }

    const button = this.nextSectionPrompt.querySelector('.prompt-button');

    if (button) {
      button.addEventListener('click', (event) => {
        event.preventDefault();

        this._hideActionPrompt();

        if (onNextSectionClick) {
          onNextSectionClick();
        }
      });
    }
  }

  async reveal(sectionId, role, customQuery = '') {
    try {
      const { sectionContent, sectionMetadata } = await this._fetchSectionData(sectionId, role, customQuery);
      const profileData = await this._fetchProfileData();

      const sectionElement = this._renderSection(sectionId, sectionContent);

      this._populateHeader(sectionElement, sectionContent.header);
      this._populateContent(sectionElement, sectionContent.content, sectionMetadata);

      this._scrollToElement(sectionElement, {
        behavior: 'smooth',
        block: 'end'
      });

      await this.sectionAnimator.animateSection(sectionElement, sectionContent);

      this._renderMetaItems(sectionElement, sectionId, sectionMetadata, profileData, role);
      this._revealMetaItems(sectionElement);

      this.stateManager.addRevealedSection(sectionId);
      trackSectionView(sectionId);

      this._updateActionPrompt();

      this._scrollToElement(sectionElement, {
        behavior: 'smooth',
        block: 'start'
      });
    } catch (error) {
      console.error(`Failed to reveal section ${sectionId}:`, error);
    }
  }

  async restore(sectionId, role) {
    const { sectionContent, sectionMetadata } = await this._fetchSectionData(sectionId, role);
    const profileData = await this._fetchProfileData();

    const sectionElement = this._renderSection(sectionId, sectionContent);

    this._populateHeader(sectionElement, sectionContent.header);
    this._populateContent(sectionElement, sectionContent.content, sectionMetadata);

    if (sectionContent.content?.image) {
      this._populateImage(sectionElement, sectionContent.content.image);
    }

    this._renderMetaItems(sectionElement, sectionId, sectionMetadata, profileData, role);
    this._revealMetaItems(sectionElement);

    this._updateActionPrompt();
  }

  removeRevealedSections() {
    const sections = this.sectionsContainer.querySelectorAll(`.${SECTION_ELEMENTS.section}`);

    sections.forEach(section => {
      if (!section.classList.contains('section--intro')) {
        section.remove()
      }
    });
  }

  async updateContent(sectionId, role) {
    try {
      const sectionElement = this.sectionsContainer.querySelector(`#section-${sectionId}`);

      if (!sectionElement) {
        return;
      }

      const { sectionContent, sectionMetadata } = await this._fetchSectionData(sectionId, role);
      const profileData = await this._fetchProfileData();

      // Update header and content text
      this._populateHeader(sectionElement, sectionContent.header);
      this._populateContent(sectionElement, sectionContent.content, sectionMetadata);

      // Clear and re-render meta items
      const metaItemsContainer = sectionElement.querySelector(`.${SECTION_ELEMENTS.metaItems}`);
      const carouselContainer = sectionElement.querySelector(`.${SECTION_ELEMENTS.carouselItems}`);

      if (metaItemsContainer) {
        metaItemsContainer.innerHTML = '';
      }

      if (carouselContainer) {
        carouselContainer.innerHTML = '';
      }

      // Re-render meta items with new language content
      this._renderMetaItems(sectionElement, sectionId, sectionMetadata, profileData, role);
      this._revealMetaItems(sectionElement);

      // Update action prompt
      this._updateActionPrompt();
    } catch (error) {
      console.error(`Failed to update section ${sectionId}:`, error);
    }
  }

  _renderSection(sectionId, sectionContent) {
    const sectionElement = this.templateBuilder.renderSection(sectionId, sectionContent);

    this.nextSectionPrompt.setAttribute('data-section-id', sectionId);

    this.sectionsContainer.insertBefore(sectionElement, this.nextSectionPrompt);

    return sectionElement;
  }

  _renderMetaItems(sectionElement, sectionId, sectionMetadata, profileData, role) {
    if (!sectionMetadata?.mainItems) {
      return;
    }

    const metaItemRenderer = new MetaItemRenderer(this.templateBuilder, profileData);

    if (sectionId === 'projects') {
      this._renderCarouselItems(metaItemRenderer, sectionElement, sectionId, sectionMetadata);
    } else if (sectionId === 'experience') {
      this._renderCollapsibleMetaItems(metaItemRenderer, sectionElement, sectionId, sectionMetadata, role, ["hidden", "non-displayed"]);
    } else {
      this._renderDefaultItems(metaItemRenderer, sectionElement, sectionId, sectionMetadata, role);
    }
  }

  _renderCarouselItems(metaItemRenderer, sectionElement, sectionId, sectionMetadata) {
    const metaItemsContainer = sectionElement.querySelector(`.${SECTION_ELEMENTS.carouselItems}`);

    if (!metaItemsContainer || !sectionMetadata?.mainItems) {
      return;
    }

    metaItemsContainer.classList.add('hidden');

    metaItemRenderer.renderInCarousel(metaItemsContainer, sectionId, sectionMetadata.mainItems);
  }

  _renderDefaultItems(metaItemRenderer, sectionElement, sectionId, sectionMetadata, role, classNames = ['hidden']) {
    const metaItemsContainer = sectionElement.querySelector(`.${SECTION_ELEMENTS.metaItems}`);

    if (!metaItemsContainer || !sectionMetadata?.mainItems) {
      return;
    }

    // This is temp fix to pass additional class when render meta items
    metaItemsContainer.classList.add(...classNames);

    const renderedItems = metaItemRenderer.render(sectionId, sectionMetadata.mainItems, role);

    if (renderedItems) {
      metaItemsContainer.appendChild(renderedItems);
    }
  }

  _renderCollapsibleMetaItems(metaItemRenderer, sectionElement, sectionId, sectionMetadata, role, classNames = ['hidden']) {
    const metaItemsContainer = sectionElement.querySelector(`.${SECTION_ELEMENTS.metaItems}`);

    if (!metaItemsContainer || !sectionMetadata?.mainItems) {
      return;
    }

    metaItemsContainer.classList.add(...classNames);

    const renderedItems = metaItemRenderer.render(sectionId, sectionMetadata.mainItems, role);

    if (!renderedItems) {
      return;
    }

    const drawer = new Drawer(this.templateBuilder);
    const drawerElement = drawer.wrapContent(renderedItems, sectionMetadata.title );

    if (drawerElement) {
      metaItemsContainer.appendChild(drawerElement);
    } else {
      metaItemsContainer.appendChild(renderedItems);
    }
  }

  _revealMetaItems(sectionElement) {
    const metaItemsContainer = sectionElement.querySelector(`.${SECTION_ELEMENTS.metaItems}`);
    const carouselContainer = sectionElement.querySelector(`.${SECTION_ELEMENTS.carouselItems}`);

    if (metaItemsContainer) {
      metaItemsContainer.classList.remove('non-displayed');
      metaItemsContainer.classList.remove('hidden');
    }

    if (carouselContainer) {
      carouselContainer.classList.remove('hidden');
    }
  }

  _hideActionPrompt() {
    requestAnimationFrame(() => {
      this.nextSectionPrompt.classList.remove('action-prompt--visible');
    });
  }

  _showActionPrompt() {
    requestAnimationFrame(() => {
      this.nextSectionPrompt.classList.add('action-prompt--visible');
    });
  }

  _updateActionPrompt() {
    const nextSectionId = this.stateManager.getNextAvailableSection();

    if (nextSectionId) {
      const readNextLabel = TranslationService.t('section.readNext');
      const nextSectionLabel = TranslationService.t(`generic.title.${nextSectionId}`);

      this._updateNextSectionPromptButton(`${readNextLabel} ${nextSectionLabel}`);
      this._showActionPrompt();
    } else {
      this._hideActionPrompt();
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

    // Translate metadata (title, mainItems) for current language
    const translatedMetadata = {
      ...sectionMetadata,
      title: translateValue(sectionMetadata.title),
      mainItems: sectionMetadata.mainItems ? translateDeep(sectionMetadata.mainItems) : undefined
    };

    return { sectionContent, sectionMetadata: translatedMetadata };
  }

  _scrollToElement(sectionElement, scrollProps = {
                                    behavior: 'smooth',
                                    block: 'center'
                                  }) {
    if (!sectionElement) {
      return;
    }

    setTimeout(() => {
      sectionElement.scrollIntoView(scrollProps);
    }, SCROLL_DELAY);
  }

  _populateContent(sectionElement, contentData) {
    const textElement = sectionElement.querySelector(`.${SECTION_ELEMENTS.text}`);

    if (textElement && contentData?.text) {
      textElement.textContent = translateValue(contentData.text);
    }

    const subTextElement = sectionElement.querySelector(`.${SECTION_ELEMENTS.subText}`);

    if (subTextElement && contentData?.subText) {
      subTextElement.textContent = translateValue(contentData.subText);
    }
  }

  _populateHeader(sectionElement, headerData) {
    const headerTitleElement = sectionElement.querySelector(`.${SECTION_ELEMENTS.title}`);

    if (headerTitleElement && headerData.text) {
      headerTitleElement.textContent = translateValue(headerData.text);
    }

    const headerSubtitleElement = sectionElement.querySelector(`.${SECTION_ELEMENTS.subTitle}`);

    if (headerSubtitleElement && headerData.subText) {
      headerSubtitleElement.textContent = translateValue(headerData.subText);
    }
  }

  _populateImage(sectionElement, imageData) {
    const imageContainer = sectionElement.querySelector(`.${SECTION_ELEMENTS.image}`);

    if (!imageContainer) {
      return;
    }

    const generativeImage = new GenerativeImage({
      templateBuilder: this.templateBuilder,
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
