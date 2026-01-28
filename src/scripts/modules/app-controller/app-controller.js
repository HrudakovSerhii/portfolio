import StateManager from '../../utils/state-manager.js';
import ContentMiddleware from '../content-middleware/content-middleware.js';
import TemplateBuilder from '../user-interface/template-builder/template-builder.js';
import AnimationController from '../animation-controller';
import ParallaxController from '../parallax-controller';
import ThemeSwitcher from '../user-interface/theme-switcher';
import HeaderController from '../user-interface/header-controller';
import SectionRenderer from '../user-interface/section-renderer';
import RoleManager from '../user-interface/role-manager';

import {
  SECTION_ORDER,
  MODAL_FADE_DURATION,
  INTRO_TRANSITION_DURATION,
  APP_CRITICAL_ELEMENT_IDS,
  APP_APP_CRITICAL_ELEMENT_KEYS,
} from "../../constants.js";

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
      mobileThemeToggle: null,
      // languageSelector: null,
      mainContent: null,
      introSection: null,
    };

    this.initialized = false;
  }

  async init() {
    if (this.initialized) {
      return;
    }

    try {
      this._cacheElements();
      this._validateCachedElements(APP_APP_CRITICAL_ELEMENT_KEYS);
      this._setupEventListeners();

      this.themeSwitcher.initialize(this.elements.themeToggle, this.elements.mobileThemeToggle);

      this.roleManager.onRoleSelect((role, isRoleChange) => this.handleRoleSelect(role, isRoleChange));

      this.headerController.initialize(
        this.elements.ownerName,
        // this.elements.languageSelector,
        this.roleManager
      );

      this.parallaxController.init();

      this.sectionRenderer.initialize(
        this.elements.mainContent,
        SECTION_ORDER,
          () => this.revealNextAvailableSection()
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

      await Promise.all([this._hideIntroSectionCTA(), this.restoreState()]);
    }
  }

  _cacheElements() {
    this.elements.initialLoader = document.getElementById(APP_CRITICAL_ELEMENT_IDS.initialLoader);
    this.elements.header = document.getElementById(APP_CRITICAL_ELEMENT_IDS.header);
    this.elements.ownerName = document.getElementById(APP_CRITICAL_ELEMENT_IDS.ownerName);
    this.elements.themeToggle = document.getElementById(APP_CRITICAL_ELEMENT_IDS.themeToggle);
    this.elements.mobileThemeToggle = document.getElementById(APP_CRITICAL_ELEMENT_IDS.mobileThemeToggle);
    // this.elements.languageSelector = document.getElementById(APP_CRITICAL_ELEMENT_IDS.languageSelector);
    this.elements.mainContent = document.getElementById(APP_CRITICAL_ELEMENT_IDS.mainContent);
    this.elements.introSection = document.getElementById(APP_CRITICAL_ELEMENT_IDS.introSection);
    this.elements.introSectionCTA = document.getElementById(APP_CRITICAL_ELEMENT_IDS.introSectionCTA);
  }

  _validateCachedElements(criticalElementKeys) {
    for (const key of criticalElementKeys) {
      if (!this.elements[key]) {
        throw new Error(`Critical element not found: ${key} (ID: ${APP_CRITICAL_ELEMENT_IDS[key]})`);
      }
    }
  }

  _setupEventListeners() {
    this.elements.themeToggle.addEventListener('click', () => {
      this.themeSwitcher.toggle();
    });

    if (this.elements.mobileThemeToggle) {
      this.elements.mobileThemeToggle.addEventListener('click', () => {
        this.themeSwitcher.toggle();
      });
    }

    // this.elements.languageSelector.addEventListener('change', (e) => {
    //   this.headerController.updateLanguage(e.target.value);
    // });

    this.elements.introSectionCTA.querySelectorAll('.button[data-role]').forEach(storyPathBtn => {
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
        block: 'center'
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

    this._scrollToElementById('next-section-prompt');
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

      await Promise.all([this._hideIntroSectionCTA(), this.revealSection(SECTION_ORDER[0])]);
    } catch (error) {
      console.error('Failed to handle role selection:', error);
      this._showErrorState(error);
    }
  }

  _hideIntroSectionCTA() {
    return new Promise((resolve) => {
      if (!this.elements.introSectionCTA) {
        resolve();
        return;
      }

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        this.elements.introSectionCTA.classList.add('hidden');
        resolve();
        return;
      }

      this.elements.introSectionCTA.classList.add('sqwizzed');

      setTimeout(() => {
        this.elements.introSectionCTA.classList.add('hidden');
        resolve();
      }, INTRO_TRANSITION_DURATION);
    });
  }

  _resetPortfolioState() {
    this.stateManager.resetRevealedSections();
    this.sectionRenderer.removeRevealedSections();
    this.headerController.clearNavigation();
  }

  async revealNextAvailableSection() {
    const nextAvailableSection = this.stateManager.getNextAvailableSection();

    if (nextAvailableSection) {
      await this.revealSection(nextAvailableSection);
    }
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
  }
}

export default AppController;
