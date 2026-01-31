import StateManager from '../../utils/state-manager.js';
import ContentMiddleware from '../content-middleware/content-middleware.js';
import TranslationService from '../translations.js';
import TemplateBuilder from '../user-interface/template-builder/template-builder.js';
import AnimationController from '../animation-controller';
import ParallaxController from '../parallax-controller';
import ThemeSwitcher from '../user-interface/theme-switcher';
import HeaderController from '../user-interface/header-controller';
import SectionRenderer from '../user-interface/section-renderer';
import RoleManager from '../user-interface/role-manager';

import { trackRoleSelect, initCVDownloadTracking } from '../analytics';

import {
  SECTION_ORDER,
  MODAL_FADE_DURATION,
  INTRO_TRANSITION_DURATION,
  APP_CRITICAL_ELEMENT_IDS,
  APP_APP_CRITICAL_ELEMENT_KEYS,
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
} from "../../constants.js";

class AppController {
  constructor() {
    this.stateManager = new StateManager();
    this.contentMiddleware = new ContentMiddleware('/portfolio/data/content-structure.json');
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
      // Header language selector
      headerLanguageToggle: null,
      headerLanguageText: null,
      headerLanguageDropdown: null,
      // Mobile language
      mobileLanguageToggle: null,
      mobileLanguageText: null,
      mobileLanguageDropdown: null,
      mainContent: null,
      introSection: null,
    };

    this._handleLanguageDropdownClickOutside = this._handleLanguageDropdownClickOutside.bind(this);

    this.initialized = false;
  }

  async init() {
    if (this.initialized) {
      return;
    }

    try {
      const savedLanguage = this.stateManager.getLanguage();

      await this.contentMiddleware.initialize();

      await TranslationService.initialize(savedLanguage);

      const actualLanguage = TranslationService.getCurrentLanguage();

      if (actualLanguage !== savedLanguage) {
        this.stateManager.setLanguage(actualLanguage);
      }

      this._cacheElements();
      this._validateCachedElements(APP_APP_CRITICAL_ELEMENT_KEYS);

      TranslationService.applyToDOM();

      this._setupEventListeners();

      this.themeSwitcher.initialize(this.elements.themeToggle, this.elements.mobileThemeToggle);

      this.roleManager.onRoleSelect((role, isRoleChange) => this.handleRoleSelect(role, isRoleChange));

      this.headerController.initialize(
        this.elements.ownerName,
        this.roleManager,
        { onMenuToggleClick: () => this._closeLanguageDropdown() }
      );

      this.parallaxController.init();

      this.sectionRenderer.initialize(
        this.elements.mainContent,
        SECTION_ORDER,
          () => this.revealNextAvailableSection()
      );

      this._updateLanguageLabels(actualLanguage);
      this._hideInitialLoader();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize application:', error);
      this._showErrorState(error);
    }
  }

  async loadAppState() {
    await this._loadUserProfile();

    if (this.stateManager.hasCompletedPersonalization() && this.stateManager.hasRevealedSections()) {
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
    // Header language selector
    this.elements.headerLanguageToggle = document.getElementById(APP_CRITICAL_ELEMENT_IDS.headerLanguageToggle);
    this.elements.headerLanguageText = document.getElementById(APP_CRITICAL_ELEMENT_IDS.headerLanguageText);
    this.elements.headerLanguageDropdown = document.getElementById(APP_CRITICAL_ELEMENT_IDS.headerLanguageDropdown);
    // Mobile language
    this.elements.mobileLanguageToggle = document.getElementById(APP_CRITICAL_ELEMENT_IDS.mobileLanguageToggle);
    this.elements.mobileLanguageText = document.getElementById(APP_CRITICAL_ELEMENT_IDS.mobileLanguageText);
    this.elements.mobileLanguageDropdown = document.getElementById(APP_CRITICAL_ELEMENT_IDS.mobileLanguageDropdown);
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

    // Header language dropdown toggle
    if (this.elements.headerLanguageToggle) {
      this.elements.headerLanguageToggle.addEventListener('click', () => {
        this._toggleLanguageDropdown();
      });

      // Click outside to close
      document.addEventListener('click', this._handleLanguageDropdownClickOutside);

      // Close on Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.elements.headerLanguageDropdown?.classList.contains('is-open')) {
          this._closeLanguageDropdown();
        }
      });
    }

    // Header language options
    if (this.elements.headerLanguageDropdown) {
      this.elements.headerLanguageDropdown.querySelectorAll('.header-language-option').forEach(option => {
        option.addEventListener('click', async () => {
          const lang = option.getAttribute('data-lang');
          if (lang) {
            await this._switchLanguage(lang);
            this._closeLanguageDropdown();
          }
        });
      });
    }

    if (this.elements.mobileLanguageToggle) {
      this.elements.mobileLanguageToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleMobileLanguageDropdown();
      });
    }

    if (this.elements.mobileLanguageDropdown) {
      this.elements.mobileLanguageDropdown.querySelectorAll('.mobile-language-option').forEach(option => {
        option.addEventListener('click', async () => {
          const lang = option.getAttribute('data-lang');
          if (lang) {
            await this._switchLanguage(lang);
            this._closeMobileLanguageDropdown();
          }
        });
      });
    }

    this.elements.introSectionCTA.querySelectorAll('.button[data-role]').forEach(storyPathBtn => {
      storyPathBtn.addEventListener('click', async () => {
        const role = storyPathBtn.getAttribute('data-role');

        if (role) {
          trackRoleSelect(role, false);
          await this.roleManager.selectRole(role);
        }
      });
    });

    initCVDownloadTracking();
  }

  _toggleLanguageDropdown() {
    if (this.elements.headerLanguageDropdown?.classList.contains('is-open')) {
      this._closeLanguageDropdown();
    } else {
      this._openLanguageDropdown();
    }
  }

  _openLanguageDropdown() {
    if (!this.elements.headerLanguageDropdown || !this.elements.headerLanguageToggle) return;

    this.elements.headerLanguageDropdown.classList.add('is-open');
    this.elements.headerLanguageDropdown.setAttribute('aria-hidden', 'false');
    this.elements.headerLanguageToggle.setAttribute('aria-expanded', 'true');
  }

  _closeLanguageDropdown() {
    if (!this.elements.headerLanguageDropdown || !this.elements.headerLanguageToggle) return;

    this.elements.headerLanguageDropdown.classList.remove('is-open');
    this.elements.headerLanguageDropdown.setAttribute('aria-hidden', 'true');
    this.elements.headerLanguageToggle.setAttribute('aria-expanded', 'false');
  }

  _handleLanguageDropdownClickOutside(e) {
    if (!this.elements.headerLanguageDropdown || !this.elements.headerLanguageToggle) return;

    const wrapper = this.elements.headerLanguageToggle.parentElement;
    if (wrapper && !wrapper.contains(e.target) && this.elements.headerLanguageDropdown.classList.contains('is-open')) {
      this._closeLanguageDropdown();
    }

    if (this.elements.mobileLanguageDropdown && this.elements.mobileLanguageToggle) {
      const mobileWrapper = this.elements.mobileLanguageToggle.parentElement;
      if (mobileWrapper && !mobileWrapper.contains(e.target) && this.elements.mobileLanguageDropdown.classList.contains('is-open')) {
        this._closeMobileLanguageDropdown();
      }
    }
  }

  _toggleMobileLanguageDropdown() {
    if (this.elements.mobileLanguageDropdown?.classList.contains('is-open')) {
      this._closeMobileLanguageDropdown();
    } else {
      this._openMobileLanguageDropdown();
    }
  }

  _openMobileLanguageDropdown() {
    if (!this.elements.mobileLanguageDropdown || !this.elements.mobileLanguageToggle) return;

    this.elements.mobileLanguageDropdown.classList.add('is-open');
    this.elements.mobileLanguageDropdown.setAttribute('aria-hidden', 'false');
    this.elements.mobileLanguageToggle.setAttribute('aria-expanded', 'true');
  }

  _closeMobileLanguageDropdown() {
    if (!this.elements.mobileLanguageDropdown || !this.elements.mobileLanguageToggle) return;

    this.elements.mobileLanguageDropdown.classList.remove('is-open');
    this.elements.mobileLanguageDropdown.setAttribute('aria-hidden', 'true');
    this.elements.mobileLanguageToggle.setAttribute('aria-expanded', 'false');
  }

  async _switchLanguage(language) {
    try {
      this.stateManager.setLanguage(language);

      await TranslationService.switchLanguage(language);

      this._updateLanguageLabels(language);

      await this._reRenderSectionsForLanguage();
      await this._loadUserProfile();
      await this._refreshNavigationItems();
    } catch (error) {
      console.error('Failed to switch language:', error);
    }
  }

  _updateLanguageLabels(language) {
    const label = LANGUAGE_LABELS[language] || language.toUpperCase();

    // Update header language text
    if (this.elements.headerLanguageText) {
      this.elements.headerLanguageText.textContent = label;
    }

    // Update active state in header language dropdown
    if (this.elements.headerLanguageDropdown) {
      this.elements.headerLanguageDropdown.querySelectorAll('.header-language-option').forEach(option => {
        const optionLang = option.getAttribute('data-lang');
        option.classList.toggle('is-active', optionLang === language);
      });
    }

    if (this.elements.mobileLanguageText) {
      this.elements.mobileLanguageText.textContent = label;
    }

    if (this.elements.mobileLanguageDropdown) {
      this.elements.mobileLanguageDropdown.querySelectorAll('.mobile-language-option').forEach(option => {
        const optionLang = option.getAttribute('data-lang');
        option.classList.toggle('is-active', optionLang === language);
      });
    }
  }

  async _reRenderSectionsForLanguage() {
    const revealedSections = this.stateManager.getRevealedSections();
    const role = this.stateManager.getRole();

    if (!role || revealedSections.length === 0) {
      return;
    }

    for (const sectionId of revealedSections) {
      await this.sectionRenderer.updateContent(sectionId, role);
    }
  }

  async _refreshNavigationItems() {
    const revealedSections = this.stateManager.getRevealedSections();

    this.headerController.clearNavigation();

    for (const sectionId of revealedSections) {
      const sectionMetadata = await this.contentMiddleware.getSectionMetadata(sectionId);
      if (sectionMetadata && sectionMetadata.title) {
        const translatedTitle = TranslationService.t(sectionMetadata.title);
        this.headerController.addNavigationItem(sectionId, translatedTitle);
      }
    }
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

  _showErrorState() {
    if (this.elements.initialLoader) {
      const loaderText = this.elements.initialLoader.querySelector('.loader-text');
      if (loaderText) {
        loaderText.textContent = TranslationService.t('loader.failed');
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

    if (revealedSections.length < SECTION_ORDER.length) {
      this._scrollToElementById('next-section-prompt');
    } else {
      this._scrollToElementById(`section-${revealedSections[revealedSections.length - 1]}`);
    }
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

    await Promise.all([
      this._handleRevealNavigationItem(sectionId),
      this.sectionRenderer.reveal(sectionId, role, customQuery)
    ]);
  }

  async _handleRevealNavigationItem(sectionId) {
    const sectionMetadata = await this.contentMiddleware.getSectionMetadata(sectionId);

    if (sectionMetadata && sectionMetadata.title) {
      const translatedTitle = TranslationService.t(sectionMetadata.title);

      this.headerController.addNavigationItem(sectionId, translatedTitle);
    }
  }

  _handleRevealSectionFailure(sectionId, error) {
    console.error(`Failed to reveal section "${sectionId}":`, error);
  }
}

export default AppController;
