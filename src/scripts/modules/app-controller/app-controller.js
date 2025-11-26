import StateManager from '../../utils/state-manager.js';
import ContentMiddleware from '../content-middleware/content-middleware.js';
import TemplateBuilder from '../user-interface/template-builder/index.js';
import AnimationController from '../animation-controller/index.js';
import ThemeSwitcher from '../user-interface/theme-switcher/index.js';
import HeaderController from '../user-interface/header-controller/index.js';
import SectionRenderer from '../user-interface/section-renderer/index.js';

const MODAL_FADE_DURATION = 300;
const SCROLL_AFTER_RENDER_DELAY = 100;
const SECTION_SCROLL_DELAY = 100;

class AppController {
  constructor() {
    this.stateManager = new StateManager();
    this.contentMiddleware = new ContentMiddleware('/data/content.json');
    this.templateBuilder = new TemplateBuilder();
    this.animationController = new AnimationController();

    this.themeSwitcher = new ThemeSwitcher(this.stateManager);
    this.headerController = new HeaderController(this.stateManager, this.templateBuilder);
    this.sectionRenderer = new SectionRenderer(
      this.stateManager,
      this.contentMiddleware,
      this.templateBuilder,
      this.animationController
    );

    this.elements = {
      initialLoader: null,
      header: null,
      ownerName: null,
      themeToggle: null,
      languageSelector: null,
      changeRoleButton: null,
      mainContent: null,
      heroSection: null,
      heroRoles: null,
      sectionsContainer: null,
      typingIndicator: null
    };

    this.sectionOrder = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) {
      console.warn('AppController already initialized');
      return;
    }

    try {
      this._cacheElements();
      this._setupEventListeners();

      this.themeSwitcher.initialize(this.elements.themeToggle);
      this.headerController.initialize(
        this.elements.ownerName,
        this.elements.languageSelector,
        this.elements.changeRoleButton
      );

      await this._loadSectionOrder();

      this.sectionRenderer.initialize(
        this.elements.sectionsContainer,
        this.elements.typingIndicator,
        this.sectionOrder
      );

      await this._loadUserProfile();

      if (this.stateManager.hasCompletedPersonalization()) {
        await this.restoreState();
      }

      this._hideInitialLoader();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize application:', error);
      this._showErrorState(error);
    }
  }

  _cacheElements() {
    this.elements.initialLoader = document.getElementById('initial-loader');
    this.elements.header = document.querySelector('.header');
    this.elements.ownerName = document.getElementById('owner-name');
    this.elements.themeToggle = document.getElementById('theme-toggle');
    this.elements.languageSelector = document.getElementById('language-selector');
    this.elements.changeRoleButton = document.getElementById('change-role-button');
    this.elements.mainContent = document.getElementById('main-content');
    this.elements.heroSection = document.getElementById('hero');
    this.elements.heroRoles = document.getElementById('hero-roles');
    this.elements.sectionsContainer = document.getElementById('sections-container');
    this.elements.typingIndicator = document.getElementById('typing-indicator');

    const criticalElements = [
      'initialLoader',
      'themeToggle',
      'languageSelector',
      'changeRoleButton',
      'heroSection',
      'heroRoles',
      'sectionsContainer'
    ];

    for (const key of criticalElements) {
      if (!this.elements[key]) {
        throw new Error(`Critical element not found: ${key}`);
      }
    }
  }

  _setupEventListeners() {
    this.elements.themeToggle.addEventListener('click', () => {
      this.themeSwitcher.toggle();
    });

    this.elements.languageSelector.addEventListener('change', (e) => {
      this.headerController.updateLanguage(e.target.value);
    });

    this.elements.changeRoleButton.addEventListener('click', () => {
      this.headerController.showRoleChangeModal((newRole) => this.handleRoleChange(newRole));
    });

    this._setupHeroRoleCardListeners();
  }

  _setupHeroRoleCardListeners() {
    const roleCards = this.elements.heroRoles.querySelectorAll('.role-card');

    roleCards.forEach(card => {
      card.addEventListener('click', async () => {
        const role = card.getAttribute('data-role');

        if (role) {
          await this.handleRoleSelection(role);
        }
      });
    });
  }

  async handleRoleSelection(role) {
    try {
      this.stateManager.setRole(role);

      this.elements.heroRoles.style.display = 'none';

      await this.revealSection('about');
    } catch (error) {
      console.error('Failed to handle role selection:', error);
      this._showErrorState(error);
    }
  }

  async _loadSectionOrder() {
    try {
      const sections = await this.contentMiddleware.getAllSections();
      this.sectionOrder = sections.map(section => section.id);

      if (this.sectionOrder.length === 0) {
        throw new Error('No sections found in content.json');
      }
    } catch (error) {
      console.error('Failed to load section order:', error);
      this.sectionOrder = ['hero', 'about', 'skills', 'experience', 'projects', 'contact'];
    }
  }

  async _loadUserProfile() {
    try {
      const profile = await this.contentMiddleware.getUserProfile();
      this.headerController.updateOwnerName(profile.name);
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  }

  _hideInitialLoader() {
    if (this.elements.initialLoader) {
      this.elements.initialLoader.style.opacity = '0';
      setTimeout(() => {
        this.elements.initialLoader.style.display = 'none';
      }, MODAL_FADE_DURATION);
    }
  }

  _showErrorState(error) {
    if (this.elements.initialLoader) {
      const loaderText = this.elements.initialLoader.querySelector('.loader-text');
      if (loaderText) {
        loaderText.textContent = `Failed to load: ${error.message}`;
      }
    }
  }

  async restoreState() {
    try {
      await this._tryRestorePreviousSession();
    } catch (error) {
      this._handleRestoreStateFailure(error);
    }
  }

  async _tryRestorePreviousSession() {
    const revealedSections = this.stateManager.getRevealedSections();
    const role = this.stateManager.getRole();

    if (revealedSections.length === 0) {
      return;
    }

    await this._restoreRevealedSections(revealedSections, role);
    this._applyStoredScrollPosition();

    if (this.stateManager.hasRevealedAllSections()) {
      this.headerController.showChangeRoleButton();
    }
  }

  async _restoreRevealedSections(revealedSections, role) {
    for (const sectionId of revealedSections) {
      await this._restoreSingleSection(sectionId, role);
    }
  }

  async _restoreSingleSection(sectionId, role) {
    try {
      await this.sectionRenderer.restore(sectionId, role);
    } catch (error) {
      console.error(`Failed to restore section "${sectionId}":`, error);
    }
  }

  _applyStoredScrollPosition() {
    setTimeout(() => {
      const scrollPosition = this.stateManager.getScrollPosition();
      if (scrollPosition > 0) {
        window.scrollTo({
          top: scrollPosition,
          behavior: 'instant'
        });
      }
    }, SCROLL_AFTER_RENDER_DELAY);
  }

  _handleRestoreStateFailure(error) {
    console.error('Failed to restore state:', error);
  }

  async handleRoleChange(newRole) {
    try {
      this.stateManager.setRole(newRole);

      this.stateManager.resetRevealedSections();

      const sections = this.elements.sectionsContainer.querySelectorAll('.portfolio-section');
      sections.forEach(section => section.remove());

      const actionPrompts = this.elements.sectionsContainer.querySelectorAll('.action-prompt');
      actionPrompts.forEach(prompt => prompt.remove());

      this.headerController.hideChangeRoleButton();

      this.elements.heroRoles.style.display = 'block';

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } catch (error) {
      console.error('Failed to handle role change:', error);
      throw error;
    }
  }

  async revealSection(sectionId, customQuery = null) {
    try {
      await this._tryRevealSection(sectionId, customQuery);
    } catch (error) {
      this._handleRevealSectionFailure(sectionId, error);
      throw error;
    }
  }

  async _tryRevealSection(sectionId, customQuery) {
    const role = this.stateManager.getRole();

    if (!role) {
      throw new Error('No role selected. Cannot reveal section.');
    }

    await this.sectionRenderer.reveal(sectionId, role, customQuery);
    await this._displayNextPromptOrCompletion(sectionId);

    setTimeout(() => {
      const lastSection = this.elements.sectionsContainer.lastElementChild;
      if (lastSection) {
        lastSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, SECTION_SCROLL_DELAY);
  }

  _handleRevealSectionFailure(sectionId, error) {
    console.error(`Failed to reveal section "${sectionId}":`, error);

    if (this.elements.typingIndicator) {
      this.elements.typingIndicator.style.display = 'none';
    }
  }

  async _displayNextPromptOrCompletion(currentSectionId) {
    try {
      const currentIndex = this.sectionOrder.indexOf(currentSectionId);

      if (currentIndex === this.sectionOrder.length - 1) {
        this.headerController.showChangeRoleButton();
        return;
      }

      const nextSectionId = this.sectionOrder[currentIndex + 1];
      const placeholder = await this.contentMiddleware.getActionPromptPlaceholder(nextSectionId);
      const actionPrompt = this.templateBuilder.renderActionPrompt(nextSectionId, placeholder);

      this.elements.sectionsContainer.appendChild(actionPrompt);
      this._setupActionPromptHandlers(actionPrompt, nextSectionId);
    } catch (error) {
      console.error('Failed to display next prompt:', error);
    }
  }

  _setupActionPromptHandlers(actionPrompt, nextSectionId) {
    const input = actionPrompt.querySelector('.prompt-input');
    const button = actionPrompt.querySelector('.prompt-button');

    if (!input || !button) {
      return;
    }

    const defaultText = button.getAttribute('data-default-text');

    input.addEventListener('input', () => {
      if (input.value.trim()) {
        button.textContent = 'Ask';
      } else {
        button.textContent = defaultText;
      }
    });

    button.addEventListener('click', async () => {
      const customQuery = input.value.trim() || null;
      actionPrompt.remove();
      await this.revealSection(nextSectionId, customQuery);
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        button.click();
      }
    });
  }
}

export default AppController;
