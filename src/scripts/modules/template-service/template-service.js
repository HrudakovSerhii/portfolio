/**
 * TemplateService - Manages HTML template cloning and content injection
 * 
 * This service handles all template-based rendering for the portfolio application.
 * It clones HTML template elements, injects content data, and returns populated
 * DOM elements ready for insertion into the page.
 */
class TemplateService {
  constructor() {
    // Cache template references for performance
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

  /**
   * Get template element by ID with caching
   * @private
   * @param {string} templateId - Template element ID
   * @returns {HTMLTemplateElement} Template element
   * @throws {Error} If template not found
   */
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

  /**
   * Clone a template and return its content
   * @private
   * @param {string} templateId - Template element ID
   * @returns {DocumentFragment} Cloned template content
   */
  _cloneTemplate(templateId) {
    const template = this._getTemplate(templateId);
    return template.content.cloneNode(true);
  }

  /**
   * Render a portfolio section with content data
   * @param {Object} sectionData - Section content data
   * @param {string} sectionData.sectionId - Section identifier
   * @param {string} sectionData.title - Section title
   * @param {string} sectionData.text - Section text content
   * @param {string} sectionData.imageUrl - Image URL
   * @param {string} sectionData.imageAlt - Image alt text
   * @param {string} sectionData.aspectRatio - Image aspect ratio class
   * @param {string|null} [sectionData.customQuery] - Optional custom query
   * @param {boolean} isZigZagLeft - Whether image should be on left (true) or right (false)
   * @returns {HTMLElement} Populated section element
   */
  renderSection(sectionData, isZigZagLeft) {
    const fragment = this._cloneTemplate('section-template');
    const section = fragment.querySelector('.portfolio-section');
    
    if (!section) {
      throw new Error('Section element not found in template');
    }

    // Set section ID
    section.setAttribute('data-section-id', sectionData.sectionId);
    section.id = `section-${sectionData.sectionId}`;

    // Set section title
    const titleElement = section.querySelector('.section-title');
    if (titleElement) {
      titleElement.textContent = sectionData.title;
    }

    // Set custom query if provided
    const queryElement = section.querySelector('.section-query');
    if (queryElement) {
      if (sectionData.customQuery) {
        queryElement.textContent = `"${sectionData.customQuery}"`;
        queryElement.style.display = 'block';
      } else {
        queryElement.style.display = 'none';
      }
    }

    // Apply zig-zag layout class
    const contentElement = section.querySelector('.section-content');
    if (contentElement) {
      const layoutClass = isZigZagLeft ? 'zig-zag-left' : 'zig-zag-right';
      contentElement.classList.add(layoutClass);
    }

    // Set text content (will be populated by typewriter animation)
    const textElement = section.querySelector('.content-text');
    if (textElement) {
      textElement.setAttribute('data-text', sectionData.text);
    }

    // Image container will be populated by AnimationEngine with generative image
    const imageContainer = section.querySelector('.content-image');
    if (imageContainer) {
      imageContainer.setAttribute('data-image-url', sectionData.imageUrl);
      imageContainer.setAttribute('data-image-alt', sectionData.imageAlt);
      imageContainer.setAttribute('data-aspect-ratio', sectionData.aspectRatio);
    }

    return section;
  }

  /**
   * Render an action prompt component
   * @param {string} sectionId - Section identifier for next section
   * @param {string} placeholder - Placeholder text for input
   * @returns {HTMLElement} Populated action prompt element
   */
  renderActionPrompt(sectionId, placeholder) {
    const fragment = this._cloneTemplate('action-prompt-template');
    const actionPrompt = fragment.querySelector('.action-prompt');
    
    if (!actionPrompt) {
      throw new Error('Action prompt element not found in template');
    }

    // Set unique ID for this action prompt
    actionPrompt.id = `action-prompt-${sectionId}`;
    actionPrompt.setAttribute('data-section-id', sectionId);

    // Set placeholder text
    const input = actionPrompt.querySelector('.prompt-input');
    if (input) {
      input.placeholder = placeholder;
      input.id = `prompt-input-${sectionId}`;
    }

    // Set button default text with section name
    const button = actionPrompt.querySelector('.prompt-button');
    if (button) {
      const sectionName = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
      const defaultText = `Get to know ${sectionName}`;
      button.textContent = defaultText;
      button.setAttribute('data-default-text', defaultText);
      button.setAttribute('data-section-id', sectionId);
    }

    return actionPrompt;
  }

  /**
   * Render a navigation item
   * @param {Object} sectionMetadata - Section metadata
   * @param {string} sectionMetadata.id - Section identifier
   * @param {string} sectionMetadata.title - Section title
   * @param {string} sectionMetadata.icon - Icon emoji (from content.json)
   * @returns {HTMLElement} Populated navigation item element
   */
  renderNavigationItem(sectionMetadata) {
    const fragment = this._cloneTemplate('nav-item-template');
    const navItem = fragment.querySelector('.nav-item');
    
    if (!navItem) {
      throw new Error('Navigation item element not found in template');
    }

    // Set section ID
    navItem.setAttribute('data-section-id', sectionMetadata.id);
    navItem.href = `#section-${sectionMetadata.id}`;
    navItem.setAttribute('aria-label', `Navigate to ${sectionMetadata.title}`);

    // Set tooltip for collapsed state
    navItem.setAttribute('data-tooltip', sectionMetadata.title);

    // Set icon directly from content data (emoji or text)
    const iconElement = navItem.querySelector('.nav-icon');
    if (iconElement) {
      iconElement.textContent = sectionMetadata.icon || '📄';
    }

    // Set title (will be populated by typewriter animation)
    const titleElement = navItem.querySelector('.nav-title');
    if (titleElement) {
      titleElement.setAttribute('data-text', sectionMetadata.title);
    }

    return navItem;
  }

  /**
   * Render a loader component
   * @returns {HTMLElement} Loader element
   */
  renderLoader() {
    const fragment = this._cloneTemplate('loader-template');
    const loader = fragment.querySelector('.loader');
    
    if (!loader) {
      throw new Error('Loader element not found in template');
    }

    return loader;
  }

  /**
   * Render a typing indicator component
   * @returns {HTMLElement} Typing indicator element (returns existing one from DOM)
   */
  renderTypingIndicator() {
    // The typing indicator already exists in the HTML, just return a reference
    const indicator = document.getElementById('typing-indicator');
    
    if (!indicator) {
      throw new Error('Typing indicator element not found in DOM');
    }

    return indicator;
  }

  /**
   * Render personalization modal with name input and role buttons
   * @returns {HTMLElement} Populated personalization modal element
   */
  renderPersonalizationModal() {
    const fragment = this._cloneTemplate('personalization-modal-template');
    const modal = fragment.querySelector('.modal-overlay');
    
    if (!modal) {
      throw new Error('Modal overlay element not found in template');
    }

    // Add glass effect class
    modal.classList.add('modal-overlay--glass');

    // Set up role button interactions
    const roleButtons = modal.querySelectorAll('.role-button');
    roleButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Remove selected state from all buttons
        roleButtons.forEach(btn => {
          btn.classList.remove('role-button--selected');
          btn.setAttribute('aria-checked', 'false');
        });
        
        // Add selected state to clicked button
        button.classList.add('role-button--selected');
        button.setAttribute('aria-checked', 'true');
      });
    });

    return modal;
  }

  /**
   * Render role change modal with role options
   * @param {string} currentRole - Currently selected role to disable
   * @returns {HTMLElement} Populated role change modal element
   */
  renderRoleChangeModal(currentRole) {
    const fragment = this._cloneTemplate('role-change-modal-template');
    const modal = fragment.querySelector('.modal-overlay');
    
    if (!modal) {
      throw new Error('Modal overlay element not found in template');
    }

    // Add glass effect class
    modal.classList.add('modal-overlay--glass');

    // Set up role buttons with current role disabled
    const roleButtons = modal.querySelectorAll('.role-button');
    roleButtons.forEach(button => {
      const buttonRole = button.getAttribute('data-role');
      
      if (buttonRole === currentRole) {
        // Disable current role button
        button.classList.add('role-button--disabled');
        button.setAttribute('aria-checked', 'true');
        button.setAttribute('aria-disabled', 'true');
        button.disabled = true;
      } else {
        // Enable other role buttons
        button.setAttribute('aria-checked', 'false');
        button.setAttribute('aria-disabled', 'false');
        
        // Add click handler for role selection
        button.addEventListener('click', () => {
          // Remove selected state from all buttons
          roleButtons.forEach(btn => {
            btn.classList.remove('role-button--selected');
            btn.setAttribute('aria-checked', 'false');
          });
          
          // Add selected state to clicked button
          button.classList.add('role-button--selected');
          button.setAttribute('aria-checked', 'true');
        });
      }
    });

    return modal;
  }
}

// Export for use in other modules
export default TemplateService;

