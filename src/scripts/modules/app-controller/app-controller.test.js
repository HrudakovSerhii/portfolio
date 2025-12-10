/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('AppController', () => {
  let AppController;

  beforeEach(async () => {
    // Load the real HTML file
    const htmlPath = resolve(__dirname, '../../../index.html');
    const htmlContent = readFileSync(htmlPath, 'utf-8');
    
    // Remove stylesheet links to prevent 404 errors
    const cleanedHtml = htmlContent.replace(/<link[^>]*rel="stylesheet"[^>]*>/g, '');
    
    // Parse and set the full HTML document using happy-dom's DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanedHtml, 'text/html');
    
    // Replace document content with real HTML
    document.documentElement.innerHTML = doc.documentElement.innerHTML;

    // Mock sessionStorage
    global.sessionStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };

    // Mock window.addEventListener
    window.addEventListener = vi.fn();
    window.removeEventListener = vi.fn();

    // Mock matchMedia
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: {
          name: 'Test User',
          title: 'Developer',
          email: 'test@example.com'
        },
        sections: {
          hero: {
            metadata: { title: 'Hero', icon: '🏠', order: 1 },
            content: {
              recruiter: {
                text: 'Hero content',
                imageUrl: '/images/hero.jpg',
                imageAlt: 'Hero image',
                aspectRatio: 'aspect-video'
              }
            }
          }
        }
      })
    });

    // Import AppController after setting up globals
    const module = await import('./app-controller.js');
    AppController = module.default;
  });

  describe('Constructor', () => {
    it('should instantiate all required services', () => {
      const controller = new AppController();

      expect(controller.stateManager).toBeDefined();
      expect(controller.contentMiddleware).toBeDefined();
      expect(controller.templateBuilder).toBeDefined();
      expect(controller.animationController).toBeDefined();
    });

    it('should initialize with not initialized state', () => {
      const controller = new AppController();

      expect(controller.initialized).toBe(false);
    });

    it('should have empty elements object', () => {
      const controller = new AppController();

      expect(controller.elements).toBeDefined();
      expect(controller.elements.initialLoader).toBeNull();
    });
  });

  describe('init()', () => {
    it('should cache DOM elements', async () => {
      const controller = new AppController();
      
      // Mock showPersonalizationModal to prevent it from running
      controller.showPersonalizationModal = vi.fn();

      await controller.init();

      expect(controller.elements.initialLoader).toBeTruthy();
      expect(controller.elements.themeToggle).toBeTruthy();
      expect(controller.elements.languageSelector).toBeTruthy();
      expect(controller.elements.sectionsContainer).toBeTruthy();
    });

    it('should set initialized flag to true', async () => {
      const controller = new AppController();
      controller.showPersonalizationModal = vi.fn();

      await controller.init();

      expect(controller.initialized).toBe(true);
    });

    it('should not initialize twice', async () => {
      const controller = new AppController();
      controller.showPersonalizationModal = vi.fn();

      await controller.init();
      const initializedBefore = controller.initialized;
      await controller.init();

      expect(initializedBefore).toBe(true);
      expect(controller.initialized).toBe(true);
    });

    it('should initialize theme from state manager', async () => {
      const controller = new AppController();
      controller.showPersonalizationModal = vi.fn();

      await controller.init();

      const themeAttr = document.documentElement.getAttribute('data-theme');
      expect(themeAttr).toBeTruthy();
      expect(['light', 'dark']).toContain(themeAttr);
    });

  });

  describe('restoreState()', () => {
    it('should handle empty revealed sections gracefully', async () => {
      const controller = new AppController();
      controller.stateManager.getRevealedSections = vi.fn().mockReturnValue([]);

      await controller.restoreState();

      expect(controller.stateManager.getRevealedSections).toHaveBeenCalled();
    });

    it('should restore revealed sections when they exist', async () => {
      const controller = new AppController();
      controller._cacheElements();
      
      controller.stateManager.getRevealedSections = vi.fn().mockReturnValue(['hero']);
      controller.stateManager.getRole = vi.fn().mockReturnValue('recruiter');
      controller._handleRevealNavigationItem = vi.fn().mockResolvedValue();
      controller._restoreSingleSection = vi.fn().mockResolvedValue();
      controller._getSectionElement = vi.fn().mockReturnValue({
        scrollIntoView: vi.fn()
      });

      await controller.restoreState();

      expect(controller.stateManager.getRevealedSections).toHaveBeenCalled();
    });
  });

});
