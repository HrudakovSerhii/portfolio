/**
 * AppController - Main application orchestrator
 *
 * Coordinates all components and manages the application flow including:
 * - Initialization and state restoration
 * - Personalization flow
 * - Section revelation
 * - Navigation
 * - Role changes
 * - Theme and language switching
 */

import StateManager from '../../utils/state-manager.js';
import ContentMiddleware from '../content-middleware/content-middleware.js';
import TemplateService from '../template-service/template-service.js';
import AnimationEngine from '../animation-engine.js';

class AppController {
  constructor() {
    // Initialize core services
    this.stateManager = new StateManager();
    this.contentMiddleware = new ContentMiddleware('/data/content.json');
    this.templateService = new TemplateService();
    this.animationEngine = new AnimationEngine();

    // DOM element references (will be set in init)
    this.elements = {
      initialLoader: null,
      header: null,
      ownerName: null,
      themeToggle: null,
      languageSelector: null,
      changeRoleButton: null,
      navToggle: null,
      navItems: null,
      mainContent: null,
      sectionsContainer: null,
      typingIndicator: null
    };

    // Section order (will be loaded from content.json)
    this.sectionOrder = [];

    // Track initialization state
    this.initialized = false;
  }

  /**
   * Initialize the application
   * Checks for existing state and either restores or shows personalization
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) {
      console.warn('AppController already initialized');
      return;
    }

    try {
      // Cache DOM element references
      this._cacheElements();

      // Set up event listeners
      this._setupEventListeners();

      // Initialize theme based on stored preference or system default
      this._initializeTheme();

      // Initialize navigation panel state
      this._initializeNavigationPanel();

      // Load section order from content.json
      await this._loadSectionOrder();

      // Load user profile and update header
      await this._loadUserProfile();

      // Check if user has completed personalization
      if (this.stateManager.hasCompletedPersonalization()) {
        // Restore previous state
        await this.restoreState();
      } else {
        // Show personalization modal for first-time visitors
        this.showPersonalizationModal();
      }

      // Hide initial loader
      this._hideInitialLoader();

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize application:', error);
      this._showErrorState(error);
    }
  }

  /**
   * Cache references to DOM elements
   * @private
   */
  _cacheElements() {
    this.elements.initialLoader = document.getElementById('initial-loader');
    this.elements.header = document.querySelector('.header');
    this.elements.ownerName = document.getElementById('owner-name');
    this.elements.themeToggle = document.getElementById('theme-toggle');
    this.elements.languageSelector = document.getElementById('language-selector');
    this.elements.changeRoleButton = document.getElementById('change-role-button');
    this.elements.navToggle = document.getElementById('nav-toggle');
    this.elements.navItems = document.getElementById('nav-items');
    this.elements.mainContent = document.getElementById('main-content');
    this.elements.sectionsContainer = document.getElementById('sections-container');
    this.elements.typingIndicator = document.getElementById('typing-indicator');

    // Validate critical elements
    const criticalElements = [
      'initialLoader', 'themeToggle', 'languageSelector',
      'changeRoleButton', 'navToggle', 'navItems', 'sectionsContainer'
    ];

    for (const key of criticalElements) {
      if (!this.elements[key]) {
        throw new Error(`Critical element not found: ${key}`);
      }
    }
  }

  /**
   * Set up event listeners for UI controls
   * @private
   */
  _setupEventListeners() {
    // Theme toggle
    this.elements.themeToggle.addEventListener('click', () => {
      this.handleThemeChange();
    });

    // Language selector
    this.elements.languageSelector.addEventListener('change', (e) => {
      this.handleLanguageChange(e.target.value);
    });

    // Navigation toggle
    this.elements.navToggle.addEventListener('click', () => {
      this.toggleNavigationPanel();
    });

    // Change role button
    this.elements.changeRoleButton.addEventListener('click', () => {
      this.showRoleChangeModal();
    });
  }

  /**
   * Initialize theme based on stored preference or system default
   * @private
   */
  _initializeTheme() {
    let theme = this.stateManager.getTheme();

    // If no stored theme, check system preference
    if (!theme || (theme !== 'light' && theme !== 'dark')) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = prefersDark ? 'dark' : 'light';
      this.stateManager.setTheme(theme);
    }

    // Apply theme
    this._applyTheme(theme);
  }

  /**
   * Apply theme to the document
   * @private
   * @param {string} theme - Theme name ('light' or 'dark')
   */
  _applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.elements.themeToggle.setAttribute('data-theme', theme);
    this.elements.themeToggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');

    // Update icon
    const icon = this.elements.themeToggle.querySelector('.control-icon');
    if (icon) {
      icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  /**
   * Initialize navigation panel state based on stored preference
   * @private
   */
  _initializeNavigationPanel() {
    const isExpanded = this.stateManager.getNavigationExpanded();
    const navPanel = document.querySelector('.navigation-panel');
    const navToggle = this.elements.navToggle;
    const navToggleIcon = navToggle?.querySelector('.nav-toggle-icon');

    if (!navPanel) {
      return;
    }

    // Apply initial state
    if (isExpanded) {
      navPanel.classList.add('navigation-panel--expanded');
      navPanel.classList.remove('navigation-panel--collapsed');
      if (navToggleIcon) {
        navToggleIcon.textContent = '◀';
      }
    } else {
      navPanel.classList.add('navigation-panel--collapsed');
      navPanel.classList.remove('navigation-panel--expanded');
      if (navToggleIcon) {
        navToggleIcon.textContent = '▶';
      }
    }

    // Update ARIA attribute
    if (navToggle) {
      navToggle.setAttribute('aria-expanded', isExpanded.toString());
    }
  }

  /**
   * Load section order from content.json
   * @private
   * @returns {Promise<void>}
   */
  async _loadSectionOrder() {
    try {
      const sections = await this.contentMiddleware.getAllSections();
      this.sectionOrder = sections.map(section => section.id);

      if (this.sectionOrder.length === 0) {
        throw new Error('No sections found in content.json');
      }
    } catch (error) {
      console.error('Failed to load section order:', error);
      // Fallback to default order
      this.sectionOrder = ['hero', 'about', 'skills', 'experience', 'projects', 'contact'];
    }
  }

  /**
   * Load user profile and update header
   * @private
   * @returns {Promise<void>}
   */
  async _loadUserProfile() {
    try {
      const profile = await this.contentMiddleware.getUserProfile();

      if (this.elements.ownerName && profile.name) {
        this.elements.ownerName.textContent = profile.name;
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
      // Continue with default header text
    }
  }

  /**
   * Hide initial loader
   * @private
   */
  _hideInitialLoader() {
    if (this.elements.initialLoader) {
      this.elements.initialLoader.style.opacity = '0';
      setTimeout(() => {
        this.elements.initialLoader.style.display = 'none';
      }, 300);
    }
  }

  /**
   * Show error state when initialization fails
   * @private
   * @param {Error} error - Error that occurred
   */
  _showErrorState(error) {
    if (this.elements.initialLoader) {
      const loaderText = this.elements.initialLoader.querySelector('.loader-text');
      if (loaderText) {
        loaderText.textContent = `Failed to load: ${error.message}`;
      }
    }
  }

  /**
   * Restore state from previous session
   * Renders all previously revealed sections without animations
   * @returns {Promise<void>}
   */
  async restoreState() {
    try {
      const revealedSections = this.stateManager.getRevealedSections();
      const role = this.stateManager.getRole();

      if (revealedSections.length === 0) {
        // No sections to restore, show personalization
        this.showPersonalizationModal();
        return;
      }

      // Render each revealed section without animations
      for (const sectionId of revealedSections) {
        await this._restoreSection(sectionId, role);
      }

      // Restore scroll position after content renders
      setTimeout(() => {
        const scrollPosition = this.stateManager.getScrollPosition();
        if (scrollPosition > 0) {
          window.scrollTo({
            top: scrollPosition,
            behavior: 'instant'
          });
        }
      }, 100);

      // Show "Change Role" button if all sections were revealed
      if (this.stateManager.hasRevealedAllSections()) {
        this.elements.changeRoleButton.style.display = 'block';
      }
    } catch (error) {
      console.error('Failed to restore state:', error);
      // Fall back to showing personalization modal
      this.showPersonalizationModal();
    }
  }

  /**
   * Restore a single section without animations
   * @private
   * @param {string} sectionId - Section identifier
   * @param {string} role - User role
   * @returns {Promise<void>}
   */
  async _restoreSection(sectionId, role) {
    try {
      // Fetch section content
      const sectionContent = await this.contentMiddleware.fetchSectionContent(sectionId, role);
      const sectionMetadata = await this.contentMiddleware.getSectionMetadata(sectionId);

      // Determine zig-zag layout
      const sectionIndex = this.sectionOrder.indexOf(sectionId);
      const isZigZagLeft = sectionIndex % 2 === 0;

      // Render section
      const sectionElement = this.templateService.renderSection(sectionContent, isZigZagLeft);

      // Insert text content immediately (no typewriter)
      const textElement = sectionElement.querySelector('.content-text');
      if (textElement) {
        textElement.textContent = sectionContent.text;
      }

      // Insert image immediately (no generation effect)
      const imageContainer = sectionElement.querySelector('.content-image');
      if (imageContainer) {
        const img = document.createElement('img');
        img.src = sectionContent.imageUrl;
        img.alt = sectionContent.imageAlt;
        img.className = `section-image ${sectionContent.aspectRatio}`;
        imageContainer.appendChild(img);
      }

      // Add section to DOM
      this.elements.sectionsContainer.appendChild(sectionElement);

      // Restore navigation item
      await this._restoreNavigationItem(sectionMetadata);
    } catch (error) {
      console.error(`Failed to restore section "${sectionId}":`, error);
    }
  }

  /**
   * Restore a navigation item without animations
   * @private
   * @param {Object} sectionMetadata - Section metadata
   * @returns {Promise<void>}
   */
  async _restoreNavigationItem(sectionMetadata) {
    try {
      const navItem = this.templateService.renderNavigationItem(sectionMetadata);

      // Set title immediately (no typewriter)
      const titleElement = navItem.querySelector('.nav-title');
      if (titleElement) {
        titleElement.textContent = sectionMetadata.title;
      }

      // Add to navigation panel
      this.elements.navItems.appendChild(navItem);

      // Set up click handler for navigation scrolling
      navItem.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleNavigationClick(sectionMetadata.id);
      });
    } catch (error) {
      console.error(`Failed to restore navigation item for "${sectionMetadata.id}":`, error);
    }
  }

  /**
   * Show personalization modal for first-time visitors
   * Renders modal with name input and role selection buttons
   */
  showPersonalizationModal() {
    try {
      // Render personalization modal
      const modal = this.templateService.renderPersonalizationModal();

      // Add modal to DOM
      document.body.appendChild(modal);

      // Get form elements
      const nameInput = modal.querySelector('#user-name-input');
      const roleButtons = modal.querySelectorAll('.role-button');
      const modalContent = modal.querySelector('.modal-content');

      // Focus on name input
      setTimeout(() => {
        nameInput?.focus();
      }, 100);

      // Track selected role
      let selectedRole = null;

      // Handle role button clicks
      roleButtons.forEach(button => {
        button.addEventListener('click', () => {
          selectedRole = button.getAttribute('data-role');
        });
      });

      // Handle form submission (when role is selected)
      roleButtons.forEach(button => {
        button.addEventListener('click', async () => {
          const name = nameInput?.value.trim();
          const role = button.getAttribute('data-role');

          // Validate name input
          if (!name) {
            nameInput?.focus();
            nameInput?.classList.add('form-input--error');
            return;
          }

          // Remove error state if present
          nameInput?.classList.remove('form-input--error');

          // Handle personalization
          await this.handlePersonalization(name, role);
        });
      });

      // Handle Enter key on name input
      nameInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && selectedRole) {
          const name = nameInput.value.trim();
          if (name) {
            const selectedButton = modal.querySelector(`.role-button[data-role="${selectedRole}"]`);
            selectedButton?.click();
          }
        }
      });

      // Prevent modal close on content click
      modalContent?.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    } catch (error) {
      console.error('Failed to show personalization modal:', error);
      this._showErrorState(error);
    }
  }

  /**
   * Handle personalization completion
   * Stores user name and role, then triggers first section revelation
   * @param {string} name - User's name
   * @param {string} role - Selected role (recruiter, developer, friend)
   * @returns {Promise<void>}
   */
  async handlePersonalization(name, role) {
    try {
      // Store name and role in state
      this.stateManager.setUserName(name);
      this.stateManager.setRole(role);

      // Hide personalization modal
      const modal = document.querySelector('.modal-overlay');
      if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
          modal.remove();
        }, 300);
      }

      // Trigger first section revelation (Hero)
      await this.revealSection('hero');
    } catch (error) {
      console.error('Failed to handle personalization:', error);
      this._showErrorState(error);
    }
  }

  /**
   * Handle navigation click
   * Scrolls to the target section with smooth behavior
   * @param {string} sectionId - Section identifier
   */
  handleNavigationClick(sectionId) {
    try {
      // Find the target section element
      const targetSection = document.querySelector(`[data-section-id="${sectionId}"]`);

      if (!targetSection) {
        console.warn(`Section "${sectionId}" not found in DOM`);
        return;
      }

      // Scroll to the section with smooth behavior
      targetSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

      // Update scroll position in state after scrolling completes
      // Use setTimeout to wait for scroll animation (800ms duration)
      setTimeout(() => {
        const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        this.stateManager.setScrollPosition(scrollPosition);
      }, 800);
    } catch (error) {
      console.error(`Failed to handle navigation click for "${sectionId}":`, error);
    }
  }

  /**
   * Toggle navigation panel between expanded and collapsed states
   * Updates CSS classes and maintains scroll position
   */
  toggleNavigationPanel() {
    try {
      // Get current state
      const isExpanded = this.stateManager.getNavigationExpanded();
      const newState = !isExpanded;

      // Get navigation panel element
      const navPanel = document.querySelector('.navigation-panel');
      const navToggle = this.elements.navToggle;
      const navToggleIcon = navToggle?.querySelector('.nav-toggle-icon');

      if (!navPanel) {
        console.warn('Navigation panel not found');
        return;
      }

      // Update CSS classes
      if (newState) {
        // Expand navigation
        navPanel.classList.remove('navigation-panel--collapsed');
        navPanel.classList.add('navigation-panel--expanded');
        if (navToggleIcon) {
          navToggleIcon.textContent = '◀';
        }
      } else {
        // Collapse navigation
        navPanel.classList.remove('navigation-panel--expanded');
        navPanel.classList.add('navigation-panel--collapsed');
        if (navToggleIcon) {
          navToggleIcon.textContent = '▶';
        }
      }

      // Update ARIA attribute
      if (navToggle) {
        navToggle.setAttribute('aria-expanded', newState.toString());
      }

      // Update state
      this.stateManager.setNavigationExpanded(newState);

      // Scroll position is maintained automatically by the browser
      // No need to manually save/restore scroll position
    } catch (error) {
      console.error('Failed to toggle navigation panel:', error);
    }
  }

  /**
   * Show role change modal
   * Displays modal with role options, current role disabled
   */
  showRoleChangeModal() {
    try {
      // Check if modal already exists
      const existingModal = document.querySelector('.modal-overlay');
      if (existingModal) {
        return;
      }

      const currentRole = this.stateManager.getRole();

      if (!currentRole) {
        console.warn('No current role found. Cannot show role change modal.');
        return;
      }

      // Render role change modal
      const modal = this.templateService.renderRoleChangeModal(currentRole);

      // Add modal to body (not sections container)
      document.body.appendChild(modal);

      // Get modal elements
      const modalContent = modal.querySelector('.modal-content');
      const closeButton = modal.querySelector('.modal-close');
      const roleButtons = modal.querySelectorAll('.role-button:not([disabled])');

      // Focus on modal content
      setTimeout(() => {
        modalContent?.focus();
      }, 100);

      // Handle role button clicks
      roleButtons.forEach(button => {
        button.addEventListener('click', async () => {
          const newRole = button.getAttribute('data-role');
          
          if (newRole && newRole !== currentRole) {
            // Close modal
            this._closeModal(modal);
            
            // Handle role change
            await this.handleRoleChange(newRole);
          }
        });
      });

      // Handle close button click
      closeButton?.addEventListener('click', () => {
        this._closeModal(modal);
      });

      // Handle outside click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this._closeModal(modal);
        }
      });

      // Handle Escape key
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          this._closeModal(modal);
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);

      // Store escape handler for cleanup
      modal.setAttribute('data-escape-handler', 'attached');
    } catch (error) {
      console.error('Failed to show role change modal:', error);
    }
  }

  /**
   * Close modal with animation
   * @private
   * @param {HTMLElement} modal - Modal element to close
   */
  _closeModal(modal) {
    if (!modal) return;

    modal.style.opacity = '0';
    setTimeout(() => {
      modal.remove();
    }, 300);
  }

  /**
   * Handle role change
   * Resets state and restarts flow with new role
   * @param {string} newRole - New role to switch to
   * @returns {Promise<void>}
   */
  async handleRoleChange(newRole) {
    try {
      // Update role in state
      this.stateManager.setRole(newRole);

      // Clear all revealed sections except Hero
      const revealedSections = this.stateManager.getRevealedSections();
      this.stateManager.resetRevealedSections();
      this.stateManager.addRevealedSection('hero');

      // Remove all section elements from DOM except Hero
      const sections = this.elements.sectionsContainer.querySelectorAll('.portfolio-section');
      sections.forEach(section => {
        const sectionId = section.getAttribute('data-section-id');
        if (sectionId !== 'hero') {
          section.remove();
        }
      });

      // Remove any action prompts
      const actionPrompts = this.elements.sectionsContainer.querySelectorAll('.action-prompt');
      actionPrompts.forEach(prompt => prompt.remove());

      // Reset navigation panel to show only Hero item
      const navItems = this.elements.navItems.querySelectorAll('.nav-item');
      navItems.forEach(navItem => {
        const sectionId = navItem.getAttribute('data-section-id');
        if (sectionId !== 'hero') {
          navItem.remove();
        }
      });

      // Hide "Change Role" button
      if (this.elements.changeRoleButton) {
        this.elements.changeRoleButton.style.display = 'none';
      }

      // Fetch and render Hero content with new role
      const heroSection = this.elements.sectionsContainer.querySelector('[data-section-id="hero"]');
      if (heroSection) {
        // Remove existing Hero section
        heroSection.remove();
      }

      // Remove Hero navigation item to re-render it
      const heroNavItem = this.elements.navItems.querySelector('[data-section-id="hero"]');
      if (heroNavItem) {
        heroNavItem.remove();
      }

      // Reveal Hero section with new role
      await this.revealSection('hero');

      // Scroll to top
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } catch (error) {
      console.error('Failed to handle role change:', error);
      throw error;
    }
  }

  /**
   * Handle theme change
   * Toggles between light and dark themes
   * Updates theme in StateManager, applies CSS classes, and persists preference
   */
  handleThemeChange() {
    try {
      // Get current theme and toggle
      const currentTheme = this.stateManager.getTheme();
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';

      // Update theme in StateManager (persists to session storage)
      this.stateManager.setTheme(newTheme);

      // Apply theme to document
      this._applyTheme(newTheme);

      console.log(`Theme changed from ${currentTheme} to ${newTheme}`);
    } catch (error) {
      console.error('Failed to change theme:', error);
    }
  }

  /**
   * Handle language change
   * Updates language in StateManager and reloads visible content
   * @param {string} lang - Language code (e.g., 'en', 'es')
   */
  async handleLanguageChange(lang) {
    try {
      // Validate language code
      if (!lang || typeof lang !== 'string') {
        console.warn('Invalid language code provided');
        return;
      }

      const currentLanguage = this.stateManager.getLanguage();

      // Check if language is already selected
      if (lang === currentLanguage) {
        console.log(`Language already set to ${lang}`);
        return;
      }

      // Update language in StateManager (persists to session storage)
      this.stateManager.setLanguage(lang);

      // Update language selector UI to reflect current language
      if (this.elements.languageSelector) {
        this.elements.languageSelector.value = lang;
      }

      // Reload visible content with new language (placeholder for future i18n)
      // In the future, this will fetch translated content from the middleware
      // For now, we just log the change as the content structure doesn't support i18n yet
      console.log(`Language changed to ${lang}. Content reload will be implemented with i18n support.`);

      // Future implementation will include:
      // 1. Fetch translated content for all revealed sections
      // 2. Re-render sections with new language content
      // 3. Update navigation items with translated titles
      // 4. Update header controls with translated labels
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  }

  /**
   * Reveal a section with content and animations
   * Orchestrates content fetching, rendering, and animation for a single section
   * @param {string} sectionId - Section identifier
   * @param {string} [customQuery] - Optional custom query from action prompt
   * @returns {Promise<void>}
   */
  async revealSection(sectionId, customQuery = null) {
    try {
      const role = this.stateManager.getRole();

      if (!role) {
        throw new Error('No role selected. Cannot reveal section.');
      }

      // Show typing indicator
      if (this.elements.typingIndicator) {
        this.elements.typingIndicator.style.display = 'flex';
      }

      // Fetch section content and metadata
      const sectionContent = await this.contentMiddleware.fetchSectionContent(
        sectionId,
        role,
        customQuery
      );
      const sectionMetadata = await this.contentMiddleware.getSectionMetadata(sectionId);

      // Hide typing indicator
      if (this.elements.typingIndicator) {
        this.elements.typingIndicator.style.display = 'none';
      }

      // Determine zig-zag layout
      const sectionIndex = this.sectionOrder.indexOf(sectionId);
      const isZigZagLeft = sectionIndex % 2 === 0;

      // Render section
      const sectionElement = this.templateService.renderSection(sectionContent, isZigZagLeft);

      // Add section to DOM
      this.elements.sectionsContainer.appendChild(sectionElement);

      // Apply typewriter animation to text content
      const textElement = sectionElement.querySelector('.content-text');
      if (textElement) {
        const textContent = textElement.getAttribute('data-text');
        await this.animationEngine.typewriterEffect(textElement, textContent);
      }

      // Add generative image component
      const imageContainer = sectionElement.querySelector('.content-image');
      if (imageContainer) {
        const imageUrl = imageContainer.getAttribute('data-image-url');
        const imageAlt = imageContainer.getAttribute('data-image-alt');
        const aspectRatio = imageContainer.getAttribute('data-aspect-ratio');

        const generativeImage = this.animationEngine.createGenerativeImage(
          imageUrl,
          imageAlt,
          aspectRatio
        );

        if (generativeImage) {
          imageContainer.appendChild(generativeImage);
        }
      }

      // Add navigation item with typewriter animation
      await this._addNavigationItem(sectionMetadata);

      // Store revealed section in state
      this.stateManager.addRevealedSection(sectionId);

      // Display action prompt for next section or show "Change Role" button
      await this._displayNextPromptOrCompletion(sectionId);

      // Scroll to the new section
      setTimeout(() => {
        sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error) {
      console.error(`Failed to reveal section "${sectionId}":`, error);

      // Hide typing indicator on error
      if (this.elements.typingIndicator) {
        this.elements.typingIndicator.style.display = 'none';
      }

      throw error;
    }
  }

  /**
   * Add navigation item with typewriter animation
   * @private
   * @param {Object} sectionMetadata - Section metadata
   * @returns {Promise<void>}
   */
  async _addNavigationItem(sectionMetadata) {
    try {
      const navItem = this.templateService.renderNavigationItem(sectionMetadata);

      // Add to navigation panel
      this.elements.navItems.appendChild(navItem);

      // Apply typewriter animation to title
      const titleElement = navItem.querySelector('.nav-title');
      if (titleElement) {
        const titleText = titleElement.getAttribute('data-text');
        await this.animationEngine.typewriterEffect(
          titleElement,
          titleText,
          50 // Navigation speed
        );
      }

      // Set up click handler for navigation scrolling
      navItem.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleNavigationClick(sectionMetadata.id);
      });
    } catch (error) {
      console.error(`Failed to add navigation item for "${sectionMetadata.id}":`, error);
    }
  }

  /**
   * Display next action prompt or completion state
   * @private
   * @param {string} currentSectionId - Current section identifier
   * @returns {Promise<void>}
   */
  async _displayNextPromptOrCompletion(currentSectionId) {
    try {
      // Find current section index
      const currentIndex = this.sectionOrder.indexOf(currentSectionId);

      // Check if this is the last section
      if (currentIndex === this.sectionOrder.length - 1) {
        // Show "Change Role" button
        if (this.elements.changeRoleButton) {
          this.elements.changeRoleButton.style.display = 'block';
        }
        return;
      }

      // Get next section
      const nextSectionId = this.sectionOrder[currentIndex + 1];

      // Get placeholder for next section
      const placeholder = await this.contentMiddleware.getActionPromptPlaceholder(nextSectionId);

      // Render action prompt
      const actionPrompt = this.templateService.renderActionPrompt(nextSectionId, placeholder);

      // Add to sections container
      this.elements.sectionsContainer.appendChild(actionPrompt);

      // Set up action prompt interaction handlers
      this._setupActionPromptHandlers(actionPrompt, nextSectionId);
    } catch (error) {
      console.error('Failed to display next prompt:', error);
    }
  }

  /**
   * Set up event handlers for action prompt
   * @private
   * @param {HTMLElement} actionPrompt - Action prompt element
   * @param {string} nextSectionId - Next section identifier
   */
  _setupActionPromptHandlers(actionPrompt, nextSectionId) {
    const input = actionPrompt.querySelector('.prompt-input');
    const button = actionPrompt.querySelector('.prompt-button');

    if (!input || !button) {
      return;
    }

    const defaultText = button.getAttribute('data-default-text');

    // Change button text when input has value
    input.addEventListener('input', () => {
      if (input.value.trim()) {
        button.textContent = 'Ask';
      } else {
        button.textContent = defaultText;
      }
    });

    // Handle button click
    button.addEventListener('click', async () => {
      const customQuery = input.value.trim() || null;

      // Remove action prompt
      actionPrompt.remove();

      // Reveal next section
      await this.revealSection(nextSectionId, customQuery);
    });

    // Handle Enter key
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        button.click();
      }
    });
  }
}

export default AppController;
