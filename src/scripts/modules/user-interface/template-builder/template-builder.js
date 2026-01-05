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
      roleChangeModal: null,
      pathSelection: null,
      heroCtaButton: null,
      // Chat templates
      chatMessage: null,
      chatDivider: null,
      chatContextBadge: null,
      chatTyping: null,
      chatAboutSection: null,
      chatExperienceSection: null,
      chatExperienceItem: null,
      chatProjectsSection: null,
      chatProjectCard: null,
      chatSkillsSection: null,
      chatSkillGroup: null,
      chatSkillProgress: null,
      chatActionButtons: null
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

  renderSection(sectionData, isZigZagLeft, profileData = null) {
    const sectionId = sectionData.sectionId;
    const templateId = sectionId === 'contact' ? 'contact-section-template' : 'section-template';

    const section = this._createSectionElement(templateId, sectionData, isZigZagLeft);

    if (sectionId === 'contact') {
      this._populateContactActions(section, sectionData, profileData);
    }

    return section;
  }

  _createSectionElement(templateId, sectionData, isZigZagLeft) {
    const fragment = this._cloneTemplate(templateId);
    const section = fragment.querySelector('.content-section');

    if (!section) {
      throw new Error(`Section element not found in template: ${templateId}`);
    }

    this._setSectionAttributes(section, sectionData);
    this._setSectionHeader(section, sectionData);
    this._setSectionLayout(section, sectionData, isZigZagLeft);
    this._setSectionContent(section, sectionData);

    return section;
  }

  _setSectionAttributes(section, sectionData) {
    section.setAttribute('data-section-id', sectionData.sectionId);
    section.id = `section-${sectionData.sectionId}`;
  }

  _setSectionHeader(section, sectionData) {
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
  }

  _setSectionLayout(section, sectionData, isZigZagLeft) {
    const layoutElement = section.querySelector('.section-layout');
    if (!layoutElement) return;

    const aspectRatio = sectionData.image.aspectRatio;
    const isLandscape = aspectRatio === 'aspect-landscape';

    if (isLandscape) {
      layoutElement.classList.add('non-square-image');
    } else {
      const layoutClass = isZigZagLeft ? 'zig-zag-left' : 'zig-zag-right';
      layoutElement.classList.add(layoutClass);
      section.style.justifyContent = 'center';
    }
  }

  _setSectionContent(section, sectionData) {
    const textElement = section.querySelector('.section-body-content');
    if (textElement) {
      textElement.setAttribute('data-text', sectionData.text);
    }

    const imageContainer = section.querySelector('.content-image');
    if (imageContainer && sectionData.image) {
      imageContainer.setAttribute('data-image-url', sectionData.image.imageUrl);
      imageContainer.setAttribute('data-image-alt', sectionData.image.imageAlt);
      imageContainer.setAttribute('data-aspect-ratio', sectionData.image.aspectRatio);
    }
  }

  _populateContactActions(section, sectionData, profileData) {
    if (!profileData) return;

    const emailLink = section.querySelector('.contact-email-link');
    if (emailLink && profileData.email) {
      const subject = encodeURIComponent(sectionData.emailSubject || 'Hello');
      const body = encodeURIComponent(sectionData.emailBody || '');
      emailLink.href = `mailto:${profileData.email}?subject=${subject}&body=${body}`;
      emailLink.setAttribute('data-email', profileData.email);
      emailLink.setAttribute('data-name', profileData.name);
    }

    const linkedinLink = section.querySelector('.contact-linkedin-link');
    if (linkedinLink && profileData.socialLinks?.linkedin) {
      linkedinLink.href = profileData.socialLinks.linkedin;
    }
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
    }

    return modal;
  }

  /**
   * Renders path selection section with role cards
   * @returns {DocumentFragment} Path selection section element
   */
  renderPathSelection() {
    const fragment = this._cloneTemplate('path-selection-template');
    const section = fragment.querySelector('.path-selection');

    if (!section) {
      throw new Error('Path selection section element not found in template');
    }

    return section;
  }

  renderHeroCtaButton(buttonData) {
    const fragment = this._cloneTemplate('hero-cta-button-template');
    const button = fragment.querySelector('.hero-cta-button');

    if (!button) {
      throw new Error('Hero CTA button element not found in template');
    }

    const iconElement = button.querySelector('.hero-cta-button__icon');
    if (iconElement && buttonData.icon) {
      iconElement.textContent = buttonData.icon;
    }

    const textElement = button.querySelector('.hero-cta-button__text');
    if (textElement && buttonData.text) {
      textElement.textContent = buttonData.text;
    }

    if (buttonData.onClick) {
      button.addEventListener('click', buttonData.onClick);
    }

    return fragment;
  }

  // ============================================
  // Chat Section Rendering Methods
  // ============================================

  /**
   * Renders a chat message bubble
   * @param {Object} messageData - Message content and metadata
   * @param {string} messageData.text - Message text content
   * @param {string} messageData.sender - Sender name (e.g., "Portfolio Bot")
   * @param {string} messageData.avatarUrl - URL for avatar image
   * @param {boolean} messageData.isUser - Whether this is a user message
   * @returns {DocumentFragment} Chat message element
   */
  renderChatMessage(messageData) {
    const fragment = this._cloneTemplate('chat-message-template');
    const message = fragment.querySelector('.chat-message');

    if (!message) {
      throw new Error('Chat message element not found in template');
    }

    // Add user message variant class
    if (messageData.isUser) {
      message.classList.add('chat-message--user');
    }

    // Set avatar
    const avatar = message.querySelector('.chat-message__avatar');
    if (avatar && messageData.avatarUrl) {
      avatar.style.backgroundImage = `url(${messageData.avatarUrl})`;
    }

    // Set sender name
    const sender = message.querySelector('.chat-message__sender');
    if (sender && messageData.sender) {
      sender.textContent = messageData.sender;
    }

    // Set message text
    const textElement = message.querySelector('.chat-message__text');
    if (textElement) {
      // Support HTML content for rich text (bold, tags, etc.)
      if (messageData.html) {
        textElement.innerHTML = messageData.html;
      } else {
        textElement.textContent = messageData.text;
      }
    }

    return fragment;
  }

  /**
   * Renders a date/time divider
   * @param {string} text - Divider text (e.g., "Today, 10:42 AM")
   * @returns {DocumentFragment} Chat divider element
   */
  renderChatDivider(text) {
    const fragment = this._cloneTemplate('chat-divider-template');
    const divider = fragment.querySelector('.chat-divider__text');

    if (divider) {
      divider.textContent = text;
    }

    return fragment;
  }

  /**
   * Renders role context badge
   * @param {string} role - Current user role (recruiter, developer, friend)
   * @returns {DocumentFragment} Context badge element
   */
  renderChatContextBadge(role) {
    const fragment = this._cloneTemplate('chat-context-badge-template');
    const badge = fragment.querySelector('.chat-context-badge');

    if (!badge) {
      throw new Error('Chat context badge element not found in template');
    }

    const roleText = badge.querySelector('strong');
    if (roleText) {
      const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
      roleText.textContent = roleLabel;
    }

    return fragment;
  }

  /**
   * Renders typing indicator
   * @param {string} avatarUrl - Avatar image URL
   * @returns {DocumentFragment} Typing indicator element
   */
  renderChatTypingIndicator(avatarUrl) {
    const fragment = this._cloneTemplate('chat-typing-template');
    const typing = fragment.querySelector('.chat-typing');

    if (!typing) {
      throw new Error('Chat typing element not found in template');
    }

    const avatar = typing.querySelector('.chat-typing__avatar');
    if (avatar && avatarUrl) {
      avatar.style.backgroundImage = `url(${avatarUrl})`;
    }

    return fragment;
  }

  /**
   * Renders experience item card (job/role)
   * @param {Object} experienceData - Experience details
   * @param {string} experienceData.role - Job title
   * @param {string} experienceData.company - Company name
   * @param {string} experienceData.period - Time period (e.g., "2022 - Present")
   * @param {string} experienceData.description - Role description
   * @param {Array} experienceData.techStack - Array of technologies
   * @param {Object} experienceData.visual - Optional visual attachment
   * @returns {DocumentFragment} Experience card element
   */
  renderChatExperienceItem(experienceData) {
    const fragment = this._cloneTemplate('chat-experience-item-template');
    const card = fragment.querySelector('.chat-experience__card');

    if (!card) {
      throw new Error('Chat experience card element not found in template');
    }

    // Set role/title
    const roleElement = card.querySelector('.chat-experience__role');
    if (roleElement) {
      roleElement.textContent = experienceData.role;
    }

    // Set company
    const companyElement = card.querySelector('.chat-experience__company');
    if (companyElement) {
      companyElement.textContent = experienceData.company;
    }

    // Set time period
    const periodElement = card.querySelector('.chat-experience__period');
    if (periodElement) {
      periodElement.textContent = experienceData.period;
    }

    // Set description (support HTML for bold, etc.)
    const descElement = card.querySelector('.chat-experience__description');
    if (descElement) {
      if (experienceData.descriptionHtml) {
        descElement.innerHTML = experienceData.descriptionHtml;
      } else {
        descElement.textContent = experienceData.description;
      }
    }

    // Add visual if provided
    if (experienceData.visual) {
      const visualElement = card.querySelector('.chat-experience__visual');
      if (visualElement) {
        visualElement.style.display = 'block';

        const img = visualElement.querySelector('.chat-experience__visual-image');
        if (img) {
          img.src = experienceData.visual.imageUrl;
          img.alt = experienceData.visual.alt || '';
        }

        const caption = visualElement.querySelector('.chat-experience__visual-caption-text');
        if (caption && experienceData.visual.caption) {
          caption.textContent = experienceData.visual.caption;
        }

        // Add compact class for older items
        if (experienceData.visual.compact) {
          visualElement.classList.add('chat-experience__visual--compact');
        }
      }
    }

    // Add tech stack tags
    const techStackContainer = card.querySelector('.chat-experience__tech-stack');
    if (techStackContainer && experienceData.techStack) {
      experienceData.techStack.forEach(tech => {
        const tag = document.createElement('span');
        tag.className = 'chat-experience__tech-tag';
        tag.textContent = tech;
        techStackContainer.appendChild(tag);
      });
    }

    return fragment;
  }

  /**
   * Renders project card
   * @param {Object} projectData - Project details
   * @param {string} projectData.title - Project name
   * @param {string} projectData.category - Project category/type
   * @param {string} projectData.description - Project description
   * @param {string} projectData.imageUrl - Project screenshot/image
   * @param {Array} projectData.techStack - Array of technologies
   * @param {Object} projectData.links - Demo and code links
   * @returns {DocumentFragment} Project card element
   */
  renderChatProjectCard(projectData) {
    const fragment = this._cloneTemplate('chat-project-card-template');
    const card = fragment.querySelector('.chat-projects__card');

    if (!card) {
      throw new Error('Chat project card element not found in template');
    }

    // Set image
    const img = card.querySelector('.chat-projects__image-section-img');
    if (img && projectData.imageUrl) {
      img.src = projectData.imageUrl;
      img.alt = projectData.imageAlt || projectData.title;
    }

    // Set title
    const titleElement = card.querySelector('.chat-projects__title');
    if (titleElement) {
      titleElement.textContent = projectData.title;
    }

    // Set category
    const categoryElement = card.querySelector('.chat-projects__category');
    if (categoryElement) {
      categoryElement.textContent = projectData.category;
    }

    // Set description
    const descElement = card.querySelector('.chat-projects__description');
    if (descElement) {
      descElement.textContent = projectData.description;
    }

    // Add tech stack chips
    const techStackContainer = card.querySelector('.chat-projects__tech-stack');
    if (techStackContainer && projectData.techStack) {
      projectData.techStack.forEach(tech => {
        const chip = document.createElement('div');
        chip.className = 'chat-projects__tech-chip';

        // Add color dot indicator
        const dot = document.createElement('span');
        dot.className = `chat-projects__tech-chip-dot chat-projects__tech-chip-dot--${tech.toLowerCase().replace('.', '')}`;
        chip.appendChild(dot);

        // Add tech name
        const name = document.createElement('span');
        name.textContent = tech;
        chip.appendChild(name);

        techStackContainer.appendChild(chip);
      });
    }

    // Set up action buttons
    if (projectData.links) {
      const demoButton = card.querySelector('.chat-projects__action-button--primary');
      if (demoButton && projectData.links.demo) {
        demoButton.onclick = () => window.open(projectData.links.demo, '_blank');
      }

      const codeButton = card.querySelector('.chat-projects__action-button--secondary');
      if (codeButton && projectData.links.code) {
        codeButton.onclick = () => window.open(projectData.links.code, '_blank');
      }
    }

    return fragment;
  }

  /**
   * Renders skill group with progress bars or chips
   * @param {Object} skillGroupData - Skill group details
   * @param {string} skillGroupData.title - Group title (e.g., "Core Languages")
   * @param {string} skillGroupData.icon - Icon/emoji for the group
   * @param {string} skillGroupData.type - 'progress' or 'chips'
   * @param {Array} skillGroupData.skills - Array of skill objects
   * @returns {DocumentFragment} Skill group element
   */
  renderChatSkillGroup(skillGroupData) {
    const fragment = this._cloneTemplate('chat-skill-group-template');
    const group = fragment.querySelector('.chat-skills__group');

    if (!group) {
      throw new Error('Chat skill group element not found in template');
    }

    // Set icon
    const iconElement = group.querySelector('.chat-skills__header-icon');
    if (iconElement && skillGroupData.icon) {
      iconElement.textContent = skillGroupData.icon;
    }

    // Set title
    const titleElement = group.querySelector('.chat-skills__header-title');
    if (titleElement) {
      titleElement.textContent = skillGroupData.title;
    }

    // Add skills based on type
    const contentContainer = group.querySelector('.chat-skills__content');
    if (contentContainer && skillGroupData.skills) {
      if (skillGroupData.type === 'progress') {
        // Create progress bar list
        const progressList = document.createElement('div');
        progressList.className = 'chat-skills__progress-list';

        skillGroupData.skills.forEach(skill => {
          const skillFragment = this.renderChatSkillProgress(skill);
          progressList.appendChild(skillFragment);
        });

        contentContainer.appendChild(progressList);
      } else if (skillGroupData.type === 'chips') {
        // Create chip grid
        const chipGrid = document.createElement('div');
        chipGrid.className = 'chat-skills__chip-grid';

        skillGroupData.skills.forEach(skill => {
          const chip = document.createElement('div');
          chip.className = 'chat-skills__chip';

          // Add indicator dot
          const indicator = document.createElement('span');
          indicator.className = `chat-skills__chip-indicator chat-skills__chip-indicator--${skill.toLowerCase().replace('.', '')}`;
          chip.appendChild(indicator);

          // Add skill name
          const name = document.createElement('span');
          name.textContent = skill;
          chip.appendChild(name);

          chipGrid.appendChild(chip);
        });

        contentContainer.appendChild(chipGrid);
      } else if (skillGroupData.type === 'tools') {
        // Create tool grid
        const toolGrid = document.createElement('div');
        toolGrid.className = 'chat-skills__tool-grid';

        skillGroupData.skills.forEach(tool => {
          const card = document.createElement('div');
          card.className = 'chat-skills__tool-card';

          const icon = document.createElement('span');
          icon.className = 'chat-skills__tool-card-icon';
          icon.textContent = tool.icon || '🔧';
          card.appendChild(icon);

          const name = document.createElement('span');
          name.className = 'chat-skills__tool-card-name';
          name.textContent = tool.name;
          card.appendChild(name);

          toolGrid.appendChild(card);
        });

        contentContainer.appendChild(toolGrid);
      }
    }

    return fragment;
  }

  /**
   * Renders individual skill with progress bar
   * @param {Object} skillData - Skill details
   * @param {string} skillData.name - Skill name
   * @param {string} skillData.level - Level (expert, advanced, intermediate)
   * @param {number} skillData.percentage - Progress percentage (0-100)
   * @returns {DocumentFragment} Skill progress element
   */
  renderChatSkillProgress(skillData) {
    const fragment = this._cloneTemplate('chat-skill-progress-template');
    const skillItem = fragment.querySelector('.chat-skills__skill-item');

    if (!skillItem) {
      throw new Error('Chat skill progress element not found in template');
    }

    // Set skill name
    const nameElement = skillItem.querySelector('.chat-skills__skill-name');
    if (nameElement) {
      nameElement.textContent = skillData.name;
    }

    // Set level
    const levelElement = skillItem.querySelector('.chat-skills__skill-header-level');
    if (levelElement) {
      levelElement.textContent = skillData.level;
    }

    // Set progress bar width
    const progressFill = skillItem.querySelector('.chat-skills__progress-fill');
    if (progressFill) {
      // Add level-based class
      const levelClass = `chat-skills__progress-fill--${skillData.level.toLowerCase()}`;
      progressFill.classList.add(levelClass);

      // Set custom width if provided
      if (skillData.percentage) {
        progressFill.style.width = `${skillData.percentage}%`;
      }
    }

    return fragment;
  }

  /**
   * Renders action buttons for chat sections
   * @param {Array} buttons - Array of button objects
   * @param {string} buttons[].text - Button text
   * @param {boolean} buttons[].primary - Whether this is primary button
   * @param {Function} buttons[].onClick - Click handler
   * @returns {DocumentFragment} Action buttons element
   */
  renderChatActionButtons(buttons) {
    const fragment = this._cloneTemplate('chat-action-buttons-template');
    const actionsElement = fragment.querySelector('.chat-actions');

    if (!actionsElement) {
      throw new Error('Chat actions element not found in template');
    }

    const buttonsContainer = actionsElement.querySelector('.chat-actions__buttons');
    if (buttonsContainer && buttons) {
      buttons.forEach(buttonData => {
        const button = document.createElement('button');
        button.className = buttonData.primary
          ? 'chat-action-button chat-action-button--primary'
          : 'chat-action-button';

        const text = document.createElement('span');
        text.textContent = buttonData.text;
        button.appendChild(text);

        if (buttonData.icon) {
          const icon = document.createElement('span');
          icon.className = 'chat-action-button__icon';
          icon.textContent = buttonData.icon;
          button.appendChild(icon);
        }

        if (buttonData.onClick) {
          button.onclick = buttonData.onClick;
        }

        buttonsContainer.appendChild(button);
      });
    }

    return fragment;
  }
}

export default TemplateBuilder;

