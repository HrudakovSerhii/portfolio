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

const ELEMENT_IDS = {
  initialLoader: 'initial-loader',
  header: 'header',
  ownerName: 'owner-name',
  themeToggle: 'theme-toggle',
  languageSelector: 'language-selector',
  mainContent: 'main-content',
  typingIndicator: 'typing-indicator',
  introSection: 'intro-section',
};

const CRITICAL_ELEMENT_KEYS = [
  'initialLoader',
  'themeToggle',
  'languageSelector',
  'mainContent',
  'introSection',
];

class AppController {
  constructor() {
    this.stateManager = new StateManager();
    this.contentMiddleware = new ContentMiddleware('/portfolio/data/portfolio-content.json');
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
      introSection: null,
      typingIndicator: null,
    };

    this.initialized = false;
  }

  async init() {
    if (this.initialized) {
      return;
    }

    try {
      this._cacheElements();
      this._validateCachedElements(CRITICAL_ELEMENT_KEYS);
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
      const role = this.stateManager.getRole();

      this.headerController.updateRoleBadge(role);
      this.elements.introSection.classList.add('hidden');

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
    this.elements.introSection = document.getElementById(ELEMENT_IDS.introSection);
    this.elements.typingIndicator = document.getElementById(ELEMENT_IDS.typingIndicator);
  }

  _validateCachedElements(criticalElementKeys) {
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

    this.elements.introSection.querySelectorAll('.button[data-role]').forEach(storyPathBtn => {
      storyPathBtn.addEventListener('click', async () => {
        const role = storyPathBtn.getAttribute('data-role');

        if (role) {
          await this.roleManager.selectRole(role);
        }
      });
    });
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

      if (this.elements.introSection) {
        this.elements.introSection.classList.add('hidden');
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
