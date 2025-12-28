import StateManager, { SECTION_ORDER } from '../../utils/state-manager.js';
import ContentMiddleware from '../content-middleware/content-middleware.js';
import TemplateBuilder from '../user-interface/template-builder/template-builder.js';
import AnimationController from '../animation-controller';
import ParallaxController from '../parallax-controller';
import ThemeSwitcher from '../user-interface/theme-switcher';
import HeaderController from '../user-interface/header-controller';
import SectionRenderer from '../user-interface/section-renderer';
import RoleManager from '../user-interface/role-manager';

const MODAL_FADE_DURATION = 300;
const RENDER_TIMEOUT = 100;

const ELEMENT_IDS = {
  initialLoader: 'initial-loader',
  header: 'header',
  ownerName: 'owner-name',
  themeToggle: 'theme-toggle',
  languageSelector: 'language-selector',
  mainContent: 'main-content',
  heroSection: 'hero-section',
  pathSelection: 'path-selection',
  typingIndicator: 'typing-indicator',
  startConversationBtn: 'start-conversation-btn',
};

class AppController {
  constructor() {
    this.stateManager = new StateManager();
    this.contentMiddleware = new ContentMiddleware('/portfolio/data/portfolio-default-content.json');
    this.templateBuilder = new TemplateBuilder();
    this.animationController = new AnimationController();
    this.parallaxController = new ParallaxController();
    this.themeSwitcher = new ThemeSwitcher(this.stateManager);
    this.roleManager = new RoleManager(this.stateManager, this.templateBuilder);
    this.headerController = new HeaderController(this.stateManager);
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
      mainContent: null,
      heroSection: null,
      pathSelection: null,
      typingIndicator: null,
      startConversationBtn: null,
    };

    this.initialized = false;
  }

  async init() {
    if (this.initialized) {
      return;
    }

    try {
      this._cacheElements();
      this._setupEventListeners();

      this.themeSwitcher.initialize(this.elements.themeToggle);

      this.roleManager.onRoleSelect((role, isRoleChange) => this.handleRoleSelect(role, isRoleChange));

      this.headerController.initialize(
        this.elements.ownerName,
        this.elements.languageSelector,
        this.roleManager
      );

      this.parallaxController.init();

      this.sectionRenderer.initialize(
        this.elements.mainContent,
        this.elements.typingIndicator,
        SECTION_ORDER,
        (nextSectionId) => this.revealSection(nextSectionId, '')
      );

      this._hideInitialLoader();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize application:', error);
      this._showErrorState(error);
    }
  }

  async loadAppState() {
    await this._loadUserProfile();

    if (this.stateManager.hasCompletedPersonalization()) {
      this.headerController.updateRoleBadge(this.stateManager.getRole());

      await this.restoreState();
    }
  }

  _cacheElements() {
    this.elements.initialLoader = document.getElementById(ELEMENT_IDS.initialLoader);
    this.elements.header = document.getElementById(ELEMENT_IDS.header);
    this.elements.ownerName = document.getElementById(ELEMENT_IDS.ownerName);
    this.elements.themeToggle = document.getElementById(ELEMENT_IDS.themeToggle);
    this.elements.languageSelector = document.getElementById(ELEMENT_IDS.languageSelector);
    this.elements.mainContent = document.getElementById(ELEMENT_IDS.mainContent);
    this.elements.heroSection = document.getElementById(ELEMENT_IDS.heroSection);
    this.elements.pathSelection = document.getElementById(ELEMENT_IDS.pathSelection);
    this.elements.typingIndicator = document.getElementById(ELEMENT_IDS.typingIndicator);
    this.elements.startConversationBtn = document.getElementById(ELEMENT_IDS.startConversationBtn);

    const criticalElementKeys = [
      'initialLoader',
      'themeToggle',
      'languageSelector',
      'mainContent',
      'startConversationBtn'
    ];

    for (const key of criticalElementKeys) {
      if (!this.elements[key]) {
        throw new Error(`Critical element not found: ${key} (ID: ${ELEMENT_IDS[key]})`);
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

    this.elements.startConversationBtn.addEventListener('click', () => {
      this._startConversation();
    })
  }

  _startConversation() {
    if (this._isPathSelectionRendered()) {
      this._scrollToElementById('path-selection');
    } else if (this._isHeroSectionRendered()) {
      this._scrollToElementById('section-hero');
      this._updateStartConversationButtonText( 'Read below');
    } else {
      this._revealRoleSelectorSection();
      this._setupHeroRoleCardListeners();
      this._updateStartConversationButtonText( 'Scroll down to proceed');
    }
  }

  _isPathSelectionRendered() {
    const pathSelection = this.elements.mainContent.querySelector('#path-selection');
    return pathSelection !== null;
  }

  _isHeroSectionRendered() {
    const pathSelection = this.elements.mainContent.querySelector('#section-hero');
    return pathSelection !== null;
  }

  _scrollToElementById(id) {
    const element = this.elements.mainContent.querySelector(`#${id}`);

    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

  _revealRoleSelectorSection() {
    const pathSelectionSection = this.templateBuilder.renderPathSelection();
    this.elements.mainContent.appendChild(pathSelectionSection);

    this.elements.pathSelection = document.getElementById('path-selection');

    setTimeout(() => {
      this._scrollToElementById('path-selection');
    }, RENDER_TIMEOUT);
  }

  _updateStartConversationButtonText(text) {
    if (!this.elements.startConversationBtn) {
      return;
    }

    const textElement = this.elements.startConversationBtn.querySelector('.hero-start-conversation__text');
    if (textElement) {
      textElement.textContent = text;
    }
  }

  _setupHeroRoleCardListeners() {
    const roleCards = this.elements.pathSelection.querySelectorAll('.button[data-role]');

    roleCards.forEach(card => {
      card.addEventListener('click', async () => {
        const role = card.getAttribute('data-role');

        if (role) {
          await this.roleManager.selectRole(role);
        }
      });
    });
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
  }

  async _restoreRevealedSections(revealedSections, role) {
    for (const sectionId of revealedSections) {
      await Promise.all([
        this._handleRevealNavigationItem(sectionId),
        this._restoreSingleSection(sectionId, role)
      ]);
    }

    const sectionId = `section-${revealedSections[revealedSections.length - 1]}`;

    this._scrollToElementById(sectionId);
  }

  async _restoreSingleSection(sectionId, role) {
    try {
      await this.sectionRenderer.restore(sectionId, role);
    } catch (error) {
      console.error(`Failed to restore section "${sectionId}":`, error);
    }
  }

  _handleRestoreStateFailure(error) {
    console.error('Failed to restore state:', error);
  }

  async handleRoleSelect(role, isRoleChange) {
    try {
      if (isRoleChange) {
        this._resetPortfolioState();
      }

      this.stateManager.setRole(role);
      this.headerController.updateRoleBadge(role);

      // TODO: check if removal and reveal of 1st section can be done in parallel using Promise.all
      if (this.elements.pathSelection) {
        this.elements.pathSelection.classList.add('invisible');

        // Wait for animation to complete, then remove from DOM
        setTimeout(() => {
          if (this.elements.pathSelection) {
            this.elements.pathSelection.remove();
            this.elements.pathSelection = null;
          }
        }, MODAL_FADE_DURATION);
      }

      await this.revealSection(SECTION_ORDER[0]);
    } catch (error) {
      console.error('Failed to handle role selection:', error);
      this._showErrorState(error);
    }
  }

  _resetPortfolioState() {
    this.stateManager.resetRevealedSections();

    const sections = this.elements.mainContent.querySelectorAll('.content-section');
    sections.forEach(section => section.remove());

    this.headerController.clearNavigation();

    this.revealSection(SECTION_ORDER[0]).finally();
  }

  async revealSection(sectionId, customQuery = '') {
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

    await this._handleRevealNavigationItem(sectionId);

    await this.sectionRenderer.reveal(sectionId, role, customQuery);
  }

  async _handleRevealNavigationItem(sectionId) {
    const sectionMetadata = await this.contentMiddleware.getSectionMetadata(sectionId);

    if (sectionMetadata && sectionMetadata.title) {
      this.headerController.addNavigationItem(sectionId, sectionMetadata.title);
    }
  }

  _handleRevealSectionFailure(sectionId, error) {
    console.error(`Failed to reveal section "${sectionId}":`, error);

    if (this.elements.typingIndicator) {
      this.elements.typingIndicator.style.display = 'none';
    }
  }
}

export default AppController;
