class TemplateBuilder {
  constructor() {
    this.templates = {
      section: null,
      actionPrompt: null,
      navItem: null,
      loader: null,
      typingIndicator: null,
      generativeImage: null,
      personalizationModal: null,
      roleChangeModal: null
    };
  }

  _getTemplate(templateId) {
    const cacheKey = templateId.replace('-template', '').replace(/-/g, '');

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

  renderSection(sectionData, isZigZagLeft) {
    const fragment = this._cloneTemplate('section-template');
    const section = fragment.querySelector('.content-section');

    if (!section) {
      throw new Error('Section element not found in template');
    }

    section.setAttribute('data-section-id', sectionData.sectionId);
    section.id = `section-${sectionData.sectionId}`;

    const titleElement = section.querySelector('.section-title');
    if (titleElement) {
      titleElement.textContent = sectionData.title;
    }

    const queryElement = section.querySelector('.section-query');
    if (queryElement) {
      if (sectionData.customQuery) {
        queryElement.textContent = `"${sectionData.customQuery}"`;
        queryElement.style.display = 'block';
      } else {
        queryElement.style.display = 'none';
      }
    }

    const layoutElement = section.querySelector('.section-layout');
    if (layoutElement) {
      const aspectRatio = sectionData.image.aspectRatio;
      const isSquare = aspectRatio === 'aspect-square';

      if (isSquare) {
        // Apply zig-zag positioning for square images
        const layoutClass = isZigZagLeft ? 'zig-zag-left' : 'zig-zag-right';
        layoutElement.classList.add(layoutClass);
      } else {
        // Stack vertically for non-square images (landscape, portrait, wide)
        layoutElement.classList.add('non-square-image');
      }
    }

    const textElement = section.querySelector('.section-body-content');
    if (textElement) {
      textElement.setAttribute('data-text', sectionData.text);
    }

    const imageContainer = section.querySelector('.content-image');
    if (imageContainer) {
      imageContainer.setAttribute('data-image-url', sectionData.image.imageUrl);
      imageContainer.setAttribute('data-image-alt', sectionData.image.imageAlt);
      imageContainer.setAttribute('data-aspect-ratio', sectionData.image.aspectRatio);
    }

    return section;
  }

  renderActionPrompt(sectionId, placeholder) {
    // TODO: move usage of placeholder to chat feature that can be called on each section.
    const fragment = this._cloneTemplate('action-prompt-template');
    const actionPrompt = fragment.querySelector('.action-prompt');

    if (!actionPrompt) {
      throw new Error('Action prompt element not found in template');
    }

    actionPrompt.id = `action-prompt-${sectionId}`;
    actionPrompt.setAttribute('data-section-id', sectionId);

    const button = actionPrompt.querySelector('.prompt-button');
    if (button) {
      const sectionName = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
      const defaultText = `Read next: ${sectionName}`;
      button.textContent = defaultText;
      button.setAttribute('data-default-text', defaultText);
      button.setAttribute('data-section-id', sectionId);
    }

    return actionPrompt;
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

  renderTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');

    if (!indicator) {
      throw new Error('Typing indicator element not found in DOM');
    }

    return indicator;
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

    const currentButton = modal.querySelector(`[data-role="${currentRole}"]`);
    if (currentButton) {
      currentButton.disabled = true;
      currentButton.style.opacity = '0.5';
      currentButton.style.cursor = 'not-allowed';
      currentButton.style.pointerEvents = 'none';
    }

    return modal;
  }
}

export default TemplateBuilder;

