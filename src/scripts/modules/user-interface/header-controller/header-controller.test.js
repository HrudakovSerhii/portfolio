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
    
    // Parse and set the full HTML document
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    document.documentElement.innerHTML = doc.documentElement.innerHTML;

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
    headerController = new HeaderController(mockStateManager, mockTemplateBuilder);
  });

  describe('Constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(headerController.stateManager).toBe(mockStateManager);
      expect(headerController.templateBuilder).toBe(mockTemplateBuilder);
    });

    it('should initialize with null elements', () => {
      expect(headerController.ownerName).toBeNull();
      expect(headerController.languageSelector).toBeNull();
      expect(headerController.headerNav).toBeNull();
      expect(headerController.roleBadge).toBeNull();
    });

    it('should initialize with empty arrays and default state', () => {
      expect(headerController.visibleSections).toEqual([]);
      expect(headerController.activeSection).toBeNull();
      expect(headerController.isDropdownOpen).toBe(false);
    });
  });

  describe('initialize()', () => {
    it('should cache DOM elements', () => {
      const ownerName = document.createElement('span');
      const languageSelector = document.createElement('select');

      // Mock window.addEventListener for scroll detection
      window.addEventListener = vi.fn();
      window.requestAnimationFrame = vi.fn();

      headerController.initialize(ownerName, languageSelector);

      expect(headerController.ownerName).toBe(ownerName);
      expect(headerController.languageSelector).toBe(languageSelector);
      expect(headerController.headerNav).toBeTruthy();
      expect(headerController.roleBadge).toBeTruthy();
    });

    it('should set language selector to current language', () => {
      const languageSelector = document.createElement('select');
      // Create option elements for the select
      const option1 = document.createElement('option');
      option1.value = 'en';
      const option2 = document.createElement('option');
      option2.value = 'es';
      languageSelector.appendChild(option1);
      languageSelector.appendChild(option2);
      
      // Mock window.addEventListener for scroll detection
      window.addEventListener = vi.fn();
      window.requestAnimationFrame = vi.fn();
      
      mockStateManager.setLanguage('es');

      headerController.initialize(document.createElement('span'), languageSelector);

      expect(languageSelector.value).toBe('es');
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
      // Create option elements for the select
      const option1 = document.createElement('option');
      option1.value = 'en';
      const option2 = document.createElement('option');
      option2.value = 'de';
      const option3 = document.createElement('option');
      option3.value = 'fr';
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

    it('should store callback function', () => {
      const callback = vi.fn();

      headerController.updateRoleBadge('recruiter', callback);

      expect(headerController.onRoleSelectCallback).toBe(callback);
    });
  });

  describe('addNavigationItem()', () => {
    beforeEach(() => {
      headerController.headerNav = document.createElement('nav');
      headerController.navDropdownMenu = document.createElement('div');
    });

    it('should add navigation item to header', () => {
      headerController.addNavigationItem('about', 'About Me');

      const navItems = headerController.headerNav.querySelectorAll('.header-nav-item');
      expect(navItems.length).toBe(1);
      expect(navItems[0].textContent).toBe('About Me');
    });

    it('should add divider before navigation item', () => {
      headerController.addNavigationItem('about', 'About Me');

      const dividers = headerController.headerNav.querySelectorAll('.header-divider');
      expect(dividers.length).toBe(1);
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

    it('should add item to mobile dropdown', () => {
      headerController.addNavigationItem('about', 'About Me');

      const dropdownItems = headerController.navDropdownMenu.querySelectorAll('.header-nav-dropdown-item');
      expect(dropdownItems.length).toBe(1);
    });
  });

  describe('setActiveSection()', () => {
    beforeEach(() => {
      headerController.headerNav = document.createElement('nav');
      headerController.navDropdownMenu = document.createElement('div');
      
      headerController.addNavigationItem('about', 'About');
      headerController.addNavigationItem('projects', 'Projects');
    });

    it('should set active class on correct nav item', () => {
      headerController.setActiveSection('about');

      const aboutItem = headerController.headerNav.querySelector('[data-section-id="about"]');
      const projectsItem = headerController.headerNav.querySelector('[data-section-id="projects"]');

      expect(aboutItem.classList.contains('active')).toBe(true);
      expect(projectsItem.classList.contains('active')).toBe(false);
    });

    it('should update active section property', () => {
      headerController.setActiveSection('projects');

      expect(headerController.activeSection).toBe('projects');
    });

    it('should remove active class from previous section', () => {
      headerController.setActiveSection('about');
      headerController.setActiveSection('projects');

      const aboutItem = headerController.headerNav.querySelector('[data-section-id="about"]');
      expect(aboutItem.classList.contains('active')).toBe(false);
    });
  });

  describe('clearNavigation()', () => {
    beforeEach(() => {
      headerController.headerNav = document.createElement('nav');
      headerController.navDropdownMenu = document.createElement('div');
      
      headerController.addNavigationItem('about', 'About');
      headerController.addNavigationItem('projects', 'Projects');
      headerController.setActiveSection('about');
    });

    it('should clear all navigation items', () => {
      headerController.clearNavigation();

      expect(headerController.headerNav.innerHTML).toBe('');
    });

    it('should clear mobile dropdown', () => {
      headerController.clearNavigation();

      expect(headerController.navDropdownMenu.innerHTML).toBe('');
    });

    it('should reset visible sections', () => {
      headerController.clearNavigation();

      expect(headerController.visibleSections).toEqual([]);
    });

    it('should reset active section', () => {
      headerController.clearNavigation();

      expect(headerController.activeSection).toBeNull();
    });
  });

  describe('Mobile dropdown', () => {
    beforeEach(() => {
      headerController.headerNavMobile = document.createElement('div');
      headerController.navDropdownToggle = document.createElement('button');
      headerController.navDropdownMenu = document.createElement('div');
      headerController.navDropdownToggle.setAttribute('aria-expanded', 'false');
    });

    it('should open dropdown on toggle click', () => {
      headerController._setupMobileDropdown();
      headerController.navDropdownToggle.click();

      expect(headerController.isDropdownOpen).toBe(true);
      expect(headerController.navDropdownToggle.classList.contains('is-open')).toBe(true);
    });

    it('should close dropdown on second toggle click', () => {
      headerController._setupMobileDropdown();
      headerController.navDropdownToggle.click();
      headerController.navDropdownToggle.click();

      expect(headerController.isDropdownOpen).toBe(false);
      expect(headerController.navDropdownToggle.classList.contains('is-open')).toBe(false);
    });

    it('should update aria-expanded attribute', () => {
      headerController._setupMobileDropdown();
      headerController.navDropdownToggle.click();

      expect(headerController.navDropdownToggle.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('showRoleChangeModal()', () => {
    beforeEach(() => {
      mockStateManager.setRole('recruiter');
      vi.spyOn(mockTemplateBuilder, 'renderRoleChangeModal').mockReturnValue(
        document.createElement('div')
      );
    });

    it('should render modal with current role', () => {
      headerController.showRoleChangeModal(vi.fn());

      expect(mockTemplateBuilder.renderRoleChangeModal).toHaveBeenCalledWith('recruiter');
    });

    it('should not show modal if one already exists', () => {
      const existingModal = document.createElement('div');
      existingModal.className = 'modal-overlay';
      document.body.appendChild(existingModal);

      headerController.showRoleChangeModal(vi.fn());

      const modals = document.querySelectorAll('.modal-overlay');
      expect(modals.length).toBe(1);
    });

    it('should warn if no current role', () => {
      mockStateManager.setRole(null);
      const consoleSpy = vi.spyOn(console, 'warn');

      headerController.showRoleChangeModal(vi.fn());

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('Invalid role');
    });
  });
});
