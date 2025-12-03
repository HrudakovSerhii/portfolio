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

    // Mock IntersectionObserver
    global.IntersectionObserver = class IntersectionObserver {
      constructor(callback) {
        this.callback = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    };

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
      expect(headerController.intersectionObserver).toBeNull();
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

    it('should setup IntersectionObserver', () => {
      const ownerName = document.createElement('span');
      const languageSelector = document.createElement('select');

      headerController.initialize(ownerName, languageSelector);

      expect(headerController.intersectionObserver).toBeTruthy();
      expect(headerController.intersectionObserver.observe).toBeDefined();
      expect(headerController.intersectionObserver.disconnect).toBeDefined();
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
      headerController.intersectionObserver = {
        observe: vi.fn(),
        disconnect: vi.fn()
      };
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

    it('should observe section with IntersectionObserver', () => {
      const section = document.createElement('section');
      section.className = 'content-section';
      section.setAttribute('data-section-id', 'about');
      document.body.appendChild(section);

      headerController.addNavigationItem('about', 'About Me');

      expect(headerController.intersectionObserver.observe).toHaveBeenCalledWith(section);
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
      headerController.intersectionObserver = {
        observe: vi.fn(),
        disconnect: vi.fn()
      };
      
      headerController.addNavigationItem('about', 'About');
      headerController.addNavigationItem('projects', 'Projects');
      headerController.setActiveSection('about');
    });

    it('should clear all navigation items', () => {
      headerController.clearNavigation();

      expect(headerController.headerNav.innerHTML).toBe('');
    });

    it('should disconnect IntersectionObserver', () => {
      headerController.clearNavigation();

      expect(headerController.intersectionObserver.disconnect).toHaveBeenCalled();
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

  describe('IntersectionObserver active section tracking', () => {
    let mockObserverCallback;
    let mockSection1;
    let mockSection2;

    beforeEach(() => {
      // Setup DOM
      headerController.headerNav = document.createElement('nav');
      headerController.intersectionObserver = {
        observe: vi.fn(),
        disconnect: vi.fn()
      };

      // Create mock sections
      mockSection1 = document.createElement('section');
      mockSection1.setAttribute('data-section-id', 'about');
      mockSection1.className = 'content-section';
      document.body.appendChild(mockSection1);

      mockSection2 = document.createElement('section');
      mockSection2.setAttribute('data-section-id', 'projects');
      mockSection2.className = 'content-section';
      document.body.appendChild(mockSection2);

      // Add navigation items
      headerController.addNavigationItem('about', 'About');
      headerController.addNavigationItem('projects', 'Projects');

      // Capture the IntersectionObserver callback
      global.IntersectionObserver = class IntersectionObserver {
        constructor(callback) {
          mockObserverCallback = callback;
          this.callback = callback;
        }
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      };

      // Re-setup observer to capture callback
      headerController._setupIntersectionObserver();
    });

    it('should set active class when section becomes visible', () => {
      // Simulate section becoming visible with >50% intersection
      mockObserverCallback([
        {
          isIntersecting: true,
          intersectionRatio: 0.6,
          target: mockSection1
        }
      ]);

      const aboutNavItem = headerController.headerNav.querySelector('[data-section-id="about"]');
      const projectsNavItem = headerController.headerNav.querySelector('[data-section-id="projects"]');

      expect(aboutNavItem.classList.contains('active')).toBe(true);
      expect(projectsNavItem.classList.contains('active')).toBe(false);
      expect(headerController.activeSection).toBe('about');
    });

    it('should switch active class when different section becomes visible', () => {
      // First section visible with high ratio
      mockObserverCallback([
        {
          isIntersecting: true,
          intersectionRatio: 0.8,
          target: mockSection1
        }
      ]);

      // Second section becomes visible with higher ratio
      mockObserverCallback([
        {
          isIntersecting: true,
          intersectionRatio: 0.9,
          target: mockSection2
        }
      ]);

      const aboutNavItem = headerController.headerNav.querySelector('[data-section-id="about"]');
      const projectsNavItem = headerController.headerNav.querySelector('[data-section-id="projects"]');

      expect(aboutNavItem.classList.contains('active')).toBe(false);
      expect(projectsNavItem.classList.contains('active')).toBe(true);
      expect(headerController.activeSection).toBe('projects');
    });

    it('should not change active section if already active', () => {
      mockObserverCallback([
        {
          isIntersecting: true,
          intersectionRatio: 0.7,
          target: mockSection1
        }
      ]);

      const setActiveSpy = vi.spyOn(headerController, 'setActiveSection');

      // Same section intersecting again with same ratio
      mockObserverCallback([
        {
          isIntersecting: true,
          intersectionRatio: 0.7,
          target: mockSection1
        }
      ]);

      // Should not call setActiveSection again since it's already active
      expect(setActiveSpy).not.toHaveBeenCalled();
    });

    it('should ignore non-intersecting entries', () => {
      mockObserverCallback([
        {
          isIntersecting: false,
          target: mockSection1
        }
      ]);

      expect(headerController.activeSection).toBeNull();
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
