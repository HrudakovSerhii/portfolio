import TranslationService from '../../translations.js';

class TemplateBuilder {
  constructor() {
    this.templates = {
      section: null,
      navItem: null,
      loader: null,
      generativeImage: null,
      personalizationModal: null,
      roleChangeModal: null,
    };
  }

  kebabToCamel(str) {
    return str.replace(/-./g, match => match[1].toUpperCase());
  }

  _getTemplate(templateId) {
    const templateName = templateId.replace('-template', '');
    const cacheKey = this.kebabToCamel(templateName)

    if (!this.templates[cacheKey]) {
      const template = document.getElementById(templateId);

      if (!template) {
        throw new Error(`Template with id "${templateId}" not found in DOM`);
      }

      this.templates[cacheKey] = template;
    }

    return this.templates[cacheKey];
  }

  _cloneTemplate(templateId) {
    const template = this._getTemplate(templateId);

    return template.content.cloneNode(true);
  }

  renderSection(sectionId, sectionData) {
    return this._createSectionElement(sectionId, sectionData);
  }

  _createSectionElement(id, sectionData) {
    const fragment = this._cloneTemplate('section-template');
    const section = fragment.querySelector('.section');

    if (!section) {
      throw new Error('Section element not found in template');
    }

    // Add section-specific modifier class
    section.classList.add(`section--${id}`);

    this._setSectionAttributes(section, sectionData);
    this._setSectionHeader(section, sectionData);
    this._setSectionLayout(section, sectionData);
    this._setSectionContent(section, sectionData);

    return section;
  }

  _setSectionAttributes(section, sectionData) {
    section.setAttribute('data-section-id', sectionData.sectionId);
    section.id = `section-${sectionData.sectionId}`;
  }

  _setSectionHeader(section, sectionData) {
    const headerData = sectionData.header || {};

    const titleElement = section.querySelector('.section__title');
    if (titleElement) {
      titleElement.textContent = headerData.text || '';
    }

    const subtitleElement = section.querySelector('.section__subtitle');
    if (subtitleElement) {
      subtitleElement.textContent = headerData.subText || '';
    }
  }

  _setSectionLayout(section, sectionData) {
    const layoutElement = section.querySelector('.section__layout');
    if (!layoutElement) return;

    const contentData = sectionData.content || {};
    const aspectRatio = contentData.image?.aspectRatio;

    if (aspectRatio === 'aspect-landscape') {
      layoutElement.classList.add('section__layout--landscape');
    }
  }

  _setSectionContent(section, sectionData) {
    const contentData = sectionData.content || {};

    const textElement = section.querySelector('.section__text');
    if (textElement) {
      textElement.setAttribute('data-text', contentData.text || '');
    }

    const subTextElement = section.querySelector('.section__subtext');
    if (subTextElement) {
      subTextElement.setAttribute('data-text', contentData.subText || '');
    }
  }

  renderNavigationItem(sectionMetadata) {
    const fragment = this._cloneTemplate('nav-item-template');
    const navItem = fragment.querySelector('.nav-item');

    if (!navItem) {
      throw new Error('Navigation item element not found in template');
    }

    navItem.setAttribute('data-section-id', sectionMetadata.id);
    navItem.href = `#section-${sectionMetadata.id}`;
    navItem.setAttribute('aria-label', `Navigate to ${sectionMetadata.title}`);

    navItem.setAttribute('data-tooltip', sectionMetadata.title);

    const iconElement = navItem.querySelector('.nav-icon');
    if (iconElement) {
      iconElement.textContent = sectionMetadata.icon || '📄';
    }

    const titleElement = navItem.querySelector('.nav-title');
    if (titleElement) {
      titleElement.setAttribute('data-text', sectionMetadata.title);
    }

    return navItem;
  }

  renderLoader() {
    const fragment = this._cloneTemplate('loader-template');
    const loader = fragment.querySelector('.loader');

    if (!loader) {
      throw new Error('Loader element not found in template');
    }

    return loader;
  }

  renderPersonalizationModal() {
    const fragment = this._cloneTemplate('personalization-modal-template');
    const modal = fragment.querySelector('.modal-overlay');

    if (!modal) {
      throw new Error('Modal overlay element not found in template');
    }

    modal.classList.add('modal-overlay--glass');

    const roleButtons = modal.querySelectorAll('.role-button');
    roleButtons.forEach(button => {
      button.addEventListener('click', () => {
        roleButtons.forEach(btn => {
          btn.classList.remove('role-button--selected');
          btn.setAttribute('aria-checked', 'false');
        });

        button.classList.add('role-button--selected');
        button.setAttribute('aria-checked', 'true');
      });
    });

    return modal;
  }

  renderRoleChangeModal(currentRole) {
    const fragment = this._cloneTemplate('role-change-modal-template');
    const modal = fragment.querySelector('.modal-overlay');

    if (!modal) {
      throw new Error('Modal overlay element not found in template');
    }

    TranslationService.applyToElement(modal);

    const currentButton = modal.querySelector(`[data-role="${currentRole}"]`);
    if (currentButton) {
      currentButton.disabled = true;
    }

    return modal;
  }

  cloneMetaItemTemplate(templateId) {
    try {
      return this._cloneTemplate(templateId);
    } catch {
      console.warn(`Meta item template "${templateId}" not found`);
      return null;
    }
  }

  renderGenerativeImage(aspectClass) {
    const fragment = this._cloneTemplate('generative-image-template');
    const container = fragment.querySelector('.generative-image');

    if (!container) {
      throw new Error('Generative image container not found in template');
    }

    if (aspectClass) {
      container.classList.add(aspectClass);
    }

    return {
      container,
      highResImg: container.querySelector('.generative-image__high-res'),
      overlay: container.querySelector('.generative-image__overlay'),
      badge: container.querySelector('.generative-image__badge'),
    };
  }
}

export default TemplateBuilder;

