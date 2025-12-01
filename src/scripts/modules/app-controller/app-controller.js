import StateManager, { SECTION_ORDER } from '../../utils/state-manager.js';
import ContentMiddleware from '../content-middleware/content-middleware.js';
import TemplateBuilder from '../user-interface/template-builder/template-builder.js';
import AnimationController from '../animation-controller';
import ThemeSwitcher from '../user-interface/theme-switcher';
import HeaderController from '../user-interface/header-controller';
import SectionRenderer from '../user-interface/section-renderer';
import GenerativeImage from '../user-interface/generative-image/generative-image.js';

const MODAL_FADE_DURATION = 300;
const SCROLL_AFTER_RENDER_DELAY = 100;
const SECTION_SCROLL_DELAY = 100;

const ELEMENT_IDS = {
  initialLoader: 'initial-loader',
  header: 'header',
  ownerName: 'owner-name',
  themeToggle: 'theme-toggle',
  languageSelector: 'language-selector',
  mainContent: 'main-content',
  heroSection: 'hero-section',
  heroRoles: 'hero-roles',
  heroBackgroundImage: 'hero-background-image',
  sectionsContainer: 'sections-container',
  typingIndicator: 'typing-indicator'
};

class AppController {
  constructor() {
    this.stateManager = new StateManager();
    this.contentMiddleware = new ContentMiddleware('/data/portfolio-default-content.json');
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
      mainContent: null,
      heroSection: null,
      heroRoles: null,
      heroBackgroundImage: null,
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
        this.elements.languageSelector
      );

      await this._loadSectionOrder();

      this.sectionRenderer.initialize(
        this.elements.sectionsContainer,
        this.elements.typingIndicator,
        this.sectionOrder,
        (nextSectionId) => this.revealSection(nextSectionId, '')
      );

      await this._loadUserProfile();

      this._initializeHeroBackgroundImage();

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
    this.elements.initialLoader = document.getElementById(ELEMENT_IDS.initialLoader);
    this.elements.header = document.getElementById(ELEMENT_IDS.header);
    this.elements.ownerName = document.getElementById(ELEMENT_IDS.ownerName);
    this.elements.themeToggle = document.getElementById(ELEMENT_IDS.themeToggle);
    this.elements.languageSelector = document.getElementById(ELEMENT_IDS.languageSelector);
    this.elements.mainContent = document.getElementById(ELEMENT_IDS.mainContent);
    this.elements.heroSection = document.getElementById(ELEMENT_IDS.heroSection);
    this.elements.heroRoles = document.getElementById(ELEMENT_IDS.heroRoles);
    this.elements.heroBackgroundImage = document.getElementById(ELEMENT_IDS.heroBackgroundImage);
    this.elements.sectionsContainer = document.getElementById(ELEMENT_IDS.sectionsContainer);
    this.elements.typingIndicator = document.getElementById(ELEMENT_IDS.typingIndicator);

    const criticalElementKeys = [
      'initialLoader',
      'themeToggle',
      'languageSelector',
      'mainContent',
      'heroRoles',
      'heroBackgroundImage',
      'sectionsContainer'
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

    this._setupHeroRoleCardListeners();
  }

  _setupHeroRoleCardListeners() {
    const roleCards = this.elements.heroRoles.querySelectorAll('.button[data-role]');

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

      this.headerController.updateRoleBadge(role, (newRole) => this.handleRoleChange(newRole));

      await this.revealSection(SECTION_ORDER[0]);
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

  _initializeHeroBackgroundImage() {
    try {
      this._tryToInitializeHeroBackgroundImage()
    } catch (error) {
      this._handleInitializeHeroBackgroundImageFailure(error)
    }
  }

  _tryToInitializeHeroBackgroundImage() {
    const container = this.elements.heroBackgroundImage;

    if (!container) {
      console.warn('Hero background image container not found');
      return;
    }

    const existingImg = container.querySelector('img');
    if (existingImg) {
      existingImg.remove();
    }

    const generativeHeroImage = new GenerativeImage({
      highResSrc: './backgrounds/karpaty.full.jpeg',
      lowResSrc: './backgrounds/karpaty.low.jpeg',
      alt: 'Hero background image',
      shouldAnimate: true,
      aspectClass: 'aspect-portrait',
      gridConfig: {
        rows: 8,
        cols: 8
      }
    });

    const imageElement = generativeHeroImage.create();
    container.appendChild(imageElement);
  }

  _handleInitializeHeroBackgroundImageFailure(error) {
    console.error('Failed to initialize hero background image:', error);
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

  _resetPortfolioState() {
    this.stateManager.resetRevealedSections();

    const sections = this.elements.sectionsContainer.querySelectorAll('.content-section');
    sections.forEach(section => section.remove());

    const actionPrompts = this.elements.sectionsContainer.querySelectorAll('.action-prompt');
    actionPrompts.forEach(prompt => prompt.remove());

    this.headerController.clearNavigation();
    this.elements.heroRoles.style.display = 'none';

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  async handleRoleChange(newRole) {
    try {
      this._resetPortfolioState();
      await this.handleRoleSelection(newRole);
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

    // Add navigation item for this section
    const sectionMetadata = await this.contentMiddleware.getSectionMetadata(sectionId);
    if (sectionMetadata && sectionMetadata.title) {
      this.headerController.addNavigationItem(sectionId, sectionMetadata.title);
    }

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

  _getSectionElement(sectionId) {
    return this.elements.sectionsContainer.querySelector(`[data-section-id="${sectionId}"]`);
  }
}

export default AppController;
