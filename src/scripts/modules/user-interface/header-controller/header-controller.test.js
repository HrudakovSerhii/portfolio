/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('HeaderController', () => {
  let HeaderController;
  let StateManager;
  let TemplateBuilder;
  let headerController;
  let mockStateManager;
  let mockTemplateBuilder;

  beforeEach(async () => {
    // Load the real HTML file
    const htmlPath = resolve(__dirname, '../../../../index.html');
    const htmlContent = readFileSync(htmlPath, 'utf-8');
    
    // Remove stylesheet links to prevent 404 errors
    const cleanedHtml = htmlContent.replace(/<link[^>]*rel="stylesheet"[^>]*>/g, '');
    
    // Parse and set the full HTML document
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanedHtml, 'text/html');
    document.documentElement.innerHTML = doc.documentElement.innerHTML;

    // Mock window.addEventListener
    window.addEventListener = vi.fn();
    window.removeEventListener = vi.fn();

    // Import modules
    const headerModule = await import('./header-controller.js');
    HeaderController = headerModule.default;

    const stateModule = await import('../../../utils/state-manager.js');
    StateManager = stateModule.default;

    const templateModule = await import('../template-builder/template-builder.js');
    TemplateBuilder = templateModule.default;

    // Create mock instances
    mockStateManager = new StateManager();
    mockTemplateBuilder = new TemplateBuilder();

    // Create controller instance
    headerController = new HeaderController(mockStateManager);
  });

  describe('Constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(headerController.stateManager).toBe(mockStateManager);
    });

    it('should initialize with null elements', () => {
      expect(headerController.ownerName).toBeNull();
      expect(headerController.languageSelector).toBeNull();
      expect(headerController.headerNav).toBeNull();
      expect(headerController.roleBadge).toBeNull();
    });

    it('should initialize with empty arrays and default state', () => {
      expect(headerController.visibleSections).toEqual([]);
      expect(headerController.sectionTracker).toBeNull();
    });
  });

  describe('initialize()', () => {
    it('should cache DOM elements', () => {
      const ownerName = document.createElement('span');
      const languageSelector = document.createElement('select');

      headerController.initialize(ownerName, languageSelector);

      expect(headerController.ownerName).toBe(ownerName);
      expect(headerController.languageSelector).toBe(languageSelector);
      expect(headerController.headerNav).toBeTruthy();
      expect(headerController.roleBadge).toBeTruthy();
      expect(headerController.navToggle).toBeTruthy();
    });

    it('should set language selector to current language', () => {
      const languageSelector = document.createElement('select');
      const option1 = document.createElement('option');
      option1.value = 'en';
      const option2 = document.createElement('option');
      option2.value = 'es';
      languageSelector.appendChild(option1);
      languageSelector.appendChild(option2);
      
      mockStateManager.setLanguage('es');

      headerController.initialize(document.createElement('span'), languageSelector);

      expect(languageSelector.value).toBe('es');
    });

    it('should setup mobile toggle', () => {
      const ownerName = document.createElement('span');
      const languageSelector = document.createElement('select');

      headerController.initialize(ownerName, languageSelector);

      expect(headerController.navToggle).toBeTruthy();
    });
  });

  describe('updateOwnerName()', () => {
    it('should update owner name element', () => {
      const ownerName = document.createElement('span');
      headerController.ownerName = ownerName;

      headerController.updateOwnerName('John Doe');

      expect(ownerName.textContent).toBe('John Doe');
    });

    it('should not update if owner name element is null', () => {
      headerController.ownerName = null;

      expect(() => {
        headerController.updateOwnerName('John Doe');
      }).not.toThrow();
    });
  });

  describe('updateLanguage()', () => {
    beforeEach(() => {
      const languageSelector = document.createElement('select');
      const option1 = document.createElement('option');
      option1.value = 'en';
      const option2 = document.createElement('option');
      option2.value = 'fr';
      const option3 = document.createElement('option');
      option3.value = 'de';
      languageSelector.appendChild(option1);
      languageSelector.appendChild(option2);
      languageSelector.appendChild(option3);
      headerController.languageSelector = languageSelector;
    });

    it('should update language in state manager', () => {
      const setLanguageSpy = vi.spyOn(mockStateManager, 'setLanguage');

      headerController.updateLanguage('fr');

      expect(setLanguageSpy).toHaveBeenCalledWith('fr');
    });

    it('should update language selector value', () => {
      headerController.updateLanguage('de');

      expect(headerController.languageSelector.value).toBe('de');
    });

    it('should not update if language is the same', () => {
      mockStateManager.setLanguage('en');
      const setLanguageSpy = vi.spyOn(mockStateManager, 'setLanguage');

      headerController.updateLanguage('en');

      expect(setLanguageSpy).not.toHaveBeenCalled();
    });

    it('should warn on invalid language code', () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      headerController.updateLanguage(null);

      expect(consoleSpy).toHaveBeenCalledWith('Invalid language code provided');
    });
  });

  describe('updateRoleBadge()', () => {
    beforeEach(() => {
      headerController.roleBadge = document.createElement('div');
      headerController.roleBadgeText = document.createElement('span');
      headerController.roleBadge.style.display = 'none';
      headerController.roleManager = {}; // Set roleManager so updateRoleBadge doesn't return early
    });

    it('should show role badge with correct text', () => {
      headerController.updateRoleBadge('recruiter');

      expect(headerController.roleBadgeText.textContent).toBe('Recruiter View');
      expect(headerController.roleBadge.style.display).toBe('flex');
    });

    it('should capitalize role name', () => {
      headerController.updateRoleBadge('developer');

      expect(headerController.roleBadgeText.textContent).toBe('Developer View');
    });

    it('should hide badge when role is null', () => {
      headerController.roleBadge.style.display = 'flex';

      headerController.updateRoleBadge(null);

      expect(headerController.roleBadge.style.display).toBe('none');
    });
  });

  describe('addNavigationItem()', () => {
    beforeEach(() => {
      headerController.headerNav = document.createElement('nav');
    });

    it('should add navigation item to header', () => {
      headerController.addNavigationItem('about', 'About Me');

      const navItems = headerController.headerNav.querySelectorAll('.header-nav-item');
      expect(navItems.length).toBe(1);
      expect(navItems[0].textContent).toBe('About Me');
    });

    it('should not add duplicate navigation items', () => {
      headerController.addNavigationItem('about', 'About Me');
      headerController.addNavigationItem('about', 'About Me');

      const navItems = headerController.headerNav.querySelectorAll('.header-nav-item');
      expect(navItems.length).toBe(1);
    });

    it('should add section to visible sections', () => {
      headerController.addNavigationItem('about', 'About Me');

      expect(headerController.visibleSections).toContain('about');
    });
  });

  describe('clearNavigation()', () => {
    beforeEach(() => {
      headerController.headerNav = document.createElement('nav');
      headerController.addNavigationItem('about', 'About');
      headerController.addNavigationItem('projects', 'Projects');
    });

    it('should clear all navigation items', () => {
      headerController.clearNavigation();

      expect(headerController.headerNav.innerHTML).toBe('');
    });

    it('should reset visible sections', () => {
      headerController.clearNavigation();

      expect(headerController.visibleSections).toEqual([]);
    });
  });

  describe('Mobile toggle', () => {
    beforeEach(() => {
      headerController.headerNav = document.createElement('nav');
      headerController.navToggle = document.createElement('button');
      headerController.navToggle.setAttribute('aria-expanded', 'false');
    });

    it('should toggle nav open on button click', () => {
      headerController._setupMobileToggle();
      headerController.navToggle.click();

      expect(headerController.headerNav.classList.contains('is-open')).toBe(true);
      expect(headerController.navToggle.getAttribute('aria-expanded')).toBe('true');
    });

    it('should toggle nav closed on second button click', () => {
      headerController._setupMobileToggle();
      headerController.navToggle.click();
      headerController.navToggle.click();

      expect(headerController.headerNav.classList.contains('is-open')).toBe(false);
      expect(headerController.navToggle.getAttribute('aria-expanded')).toBe('false');
    });

    it('should close nav when clicking a nav item', () => {
      headerController._setupMobileToggle();
      headerController.navToggle.click();

      const navItem = document.createElement('a');
      navItem.className = 'header-nav-item';
      headerController.headerNav.appendChild(navItem);

      navItem.click();

      expect(headerController.headerNav.classList.contains('is-open')).toBe(false);
    });
  });

  describe('Role Badge Click', () => {
    it('should call roleManager.showChangeModal when role badge is clicked', () => {
      const mockRoleManager = {
        showChangeModal: vi.fn()
      };

      headerController.initialize(
        document.createElement('span'),
        document.createElement('select'),
        mockRoleManager
      );

      if (headerController.roleBadge) {
        headerController.roleBadge.click();
        expect(mockRoleManager.showChangeModal).toHaveBeenCalled();
      }
    });
  });
});
