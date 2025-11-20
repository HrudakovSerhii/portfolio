import { describe, it, expect, beforeEach, vi } from 'vitest';
import TemplateService from '../src/scripts/modules/template-service.js';

// Mock DOM element creation helpers
const createMockElement = (tagName, className = '', attributes = {}) => {
  const element = {
    tagName: tagName.toUpperCase(),
    className,
    classList: {
      contains: vi.fn((cls) => className.includes(cls)),
      add: vi.fn((cls) => { className += ` ${cls}`; }),
      remove: vi.fn()
    },
    attributes: { ...attributes },
    children: [],
    style: {},
    textContent: '',
    innerHTML: '',
    id: attributes.id || '',
    href: attributes.href || '',
    placeholder: attributes.placeholder || '',
    disabled: false,
    getAttribute: vi.fn((name) => attributes[name] || element[name] || null),
    setAttribute: vi.fn((name, value) => { 
      attributes[name] = value;
      element[name] = value;
    }),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn(),
    appendChild: vi.fn()
  };
  return element;
};

const createMockTemplate = (templateId) => {
  const templates = {
    'section-template': () => {
      const section = createMockElement('section', 'portfolio-section');
      const parallax = createMockElement('div', 'parallax-layer');
      const header = createMockElement('div', 'section-header');
      const title = createMockElement('h2', 'section-title');
      const query = createMockElement('p', 'section-query');
      const content = createMockElement('div', 'section-content');
      const imageContainer = createMockElement('div', 'content-image');
      const textContainer = createMockElement('div', 'content-text');
      
      section.querySelector.mockImplementation((selector) => {
        if (selector === '.section-title') return title;
        if (selector === '.section-query') return query;
        if (selector === '.section-content') return content;
        if (selector === '.content-image') return imageContainer;
        if (selector === '.content-text') return textContainer;
        return null;
      });
      
      return section;
    },
    'action-prompt-template': () => {
      const prompt = createMockElement('div', 'action-prompt');
      const input = createMockElement('input', 'prompt-input');
      const button = createMockElement('button', 'prompt-button');
      
      prompt.querySelector.mockImplementation((selector) => {
        if (selector === '.prompt-input') return input;
        if (selector === '.prompt-button') return button;
        return null;
      });
      
      return prompt;
    },
    'nav-item-template': () => {
      const navItem = createMockElement('a', 'nav-item');
      const icon = createMockElement('span', 'nav-icon');
      const title = createMockElement('span', 'nav-title');
      
      navItem.querySelector.mockImplementation((selector) => {
        if (selector === '.nav-icon') return icon;
        if (selector === '.nav-title') return title;
        return null;
      });
      
      return navItem;
    },
    'loader-template': () => {
      const loader = createMockElement('div', 'loader');
      const spinner = createMockElement('div', 'loader-spinner');
      
      loader.querySelector.mockImplementation((selector) => {
        if (selector === '.loader-spinner') return spinner;
        return null;
      });
      
      return loader;
    },
    'personalization-modal-template': () => {
      const modal = createMockElement('div', 'modal-overlay');
      const button1 = createMockElement('button', 'role-button', { 'data-role': 'recruiter' });
      const button2 = createMockElement('button', 'role-button', { 'data-role': 'developer' });
      const button3 = createMockElement('button', 'role-button', { 'data-role': 'friend' });
      
      modal.querySelectorAll.mockImplementation((selector) => {
        if (selector === '.role-button') return [button1, button2, button3];
        return [];
      });
      
      return modal;
    },
    'role-change-modal-template': () => {
      const modal = createMockElement('div', 'modal-overlay');
      const button1 = createMockElement('button', 'role-button', { 'data-role': 'recruiter' });
      const button2 = createMockElement('button', 'role-button', { 'data-role': 'developer' });
      const button3 = createMockElement('button', 'role-button', { 'data-role': 'friend' });
      
      modal.querySelectorAll.mockImplementation((selector) => {
        if (selector === '.role-button') return [button1, button2, button3];
        return [];
      });
      
      modal.querySelector.mockImplementation((selector) => {
        if (selector === '[data-role="recruiter"]') return button1;
        if (selector === '[data-role="developer"]') return button2;
        if (selector === '[data-role="friend"]') return button3;
        return null;
      });
      
      return modal;
    }
  };
  
  return templates[templateId] ? templates[templateId]() : null;
};

describe('TemplateService', () => {
  let templateService;
  let mockDocument;

  beforeEach(() => {
    // Mock document.getElementById
    mockDocument = {
      getElementById: vi.fn((id) => {
        if (id === 'typing-indicator') {
          const indicator = createMockElement('div', '', { id: 'typing-indicator' });
          const dot = createMockElement('span', 'typing-dot');
          indicator.querySelector.mockImplementation((selector) => {
            if (selector === '.typing-dot') return dot;
            return null;
          });
          return indicator;
        }
        
        // Return mock template
        return {
          content: {
            cloneNode: vi.fn(() => {
              const element = createMockTemplate(id);
              return {
                querySelector: vi.fn(() => element)
              };
            })
          }
        };
      })
    };
    
    global.document = mockDocument;
    templateService = new TemplateService();
  });

  describe('renderSection', () => {
    it('should render section with correct data', () => {
      const sectionData = {
        sectionId: 'hero',
        title: 'Hero Section',
        text: 'Welcome to my portfolio',
        imageUrl: '/images/hero.jpg',
        imageAlt: 'Hero image',
        aspectRatio: 'aspect-video',
        customQuery: null
      };

      const section = templateService.renderSection(sectionData, true);

      expect(section.getAttribute('data-section-id')).toBe('hero');
      expect(section.id).toBe('section-hero');
      expect(section.querySelector('.section-title').textContent).toBe('Hero Section');
      expect(section.querySelector('.content-text').getAttribute('data-text')).toBe('Welcome to my portfolio');
    });

    it('should apply zig-zag-left class when isZigZagLeft is true', () => {
      const sectionData = {
        sectionId: 'about',
        title: 'About',
        text: 'About me',
        imageUrl: '/images/about.jpg',
        imageAlt: 'About image',
        aspectRatio: 'aspect-square',
        customQuery: null
      };

      const section = templateService.renderSection(sectionData, true);
      const content = section.querySelector('.section-content');

      expect(content.classList.contains('zig-zag-left')).toBe(true);
    });

    it('should apply zig-zag-right class when isZigZagLeft is false', () => {
      const sectionData = {
        sectionId: 'skills',
        title: 'Skills',
        text: 'My skills',
        imageUrl: '/images/skills.jpg',
        imageAlt: 'Skills image',
        aspectRatio: 'aspect-square',
        customQuery: null
      };

      const section = templateService.renderSection(sectionData, false);
      const content = section.querySelector('.section-content');

      expect(content.classList.contains('zig-zag-right')).toBe(true);
    });

    it('should display custom query when provided', () => {
      const sectionData = {
        sectionId: 'experience',
        title: 'Experience',
        text: 'My experience',
        imageUrl: '/images/experience.jpg',
        imageAlt: 'Experience image',
        aspectRatio: 'aspect-video',
        customQuery: 'Tell me about your recent projects'
      };

      const section = templateService.renderSection(sectionData, true);
      const queryElement = section.querySelector('.section-query');

      expect(queryElement.textContent).toBe('"Tell me about your recent projects"');
      expect(queryElement.style.display).toBe('block');
    });
  });

  describe('renderActionPrompt', () => {
    it('should render action prompt with correct placeholder', () => {
      const actionPrompt = templateService.renderActionPrompt('about', 'React, TypeScript, Node.js');

      expect(actionPrompt.id).toBe('action-prompt-about');
      expect(actionPrompt.getAttribute('data-section-id')).toBe('about');
      
      const input = actionPrompt.querySelector('.prompt-input');
      expect(input.placeholder).toBe('React, TypeScript, Node.js');
    });

    it('should set button text with section name', () => {
      const actionPrompt = templateService.renderActionPrompt('skills', 'JavaScript, Python');

      const button = actionPrompt.querySelector('.prompt-button');
      expect(button.textContent).toBe('Get to know Skills');
      expect(button.getAttribute('data-default-text')).toBe('Get to know Skills');
    });
  });

  describe('renderNavigationItem', () => {
    it('should render navigation item with correct data', () => {
      const metadata = {
        id: 'projects',
        title: 'Projects',
        icon: '📁' // Icon comes directly from content.json
      };

      const navItem = templateService.renderNavigationItem(metadata);

      expect(navItem.getAttribute('data-section-id')).toBe('projects');
      expect(navItem.href).toContain('#section-projects');
      expect(navItem.querySelector('.nav-icon').textContent).toBe('📁');
      expect(navItem.querySelector('.nav-title').getAttribute('data-text')).toBe('Projects');
    });

    it('should use fallback icon when icon is not provided', () => {
      const metadata = {
        id: 'about',
        title: 'About',
        icon: null
      };

      const navItem = templateService.renderNavigationItem(metadata);

      expect(navItem.querySelector('.nav-icon').textContent).toBe('📄');
    });
  });

  describe('renderLoader', () => {
    it('should render loader element', () => {
      const loader = templateService.renderLoader();

      expect(loader.classList.contains('loader')).toBe(true);
      expect(loader.querySelector('.loader-spinner')).toBeTruthy();
    });
  });

  describe('renderTypingIndicator', () => {
    it('should return existing typing indicator from DOM', () => {
      const indicator = templateService.renderTypingIndicator();

      expect(indicator.id).toBe('typing-indicator');
      expect(indicator.querySelector('.typing-dot')).toBeTruthy();
    });
  });

  describe('renderPersonalizationModal', () => {
    it('should render personalization modal with glass effect', () => {
      const modal = templateService.renderPersonalizationModal();

      expect(modal.classList.contains('modal-overlay')).toBe(true);
      expect(modal.classList.contains('modal-overlay--glass')).toBe(true);
    });

    it('should have role buttons with click handlers', () => {
      const modal = templateService.renderPersonalizationModal();
      const roleButtons = modal.querySelectorAll('.role-button');

      expect(roleButtons.length).toBe(3);
    });
  });

  describe('renderRoleChangeModal', () => {
    it('should render role change modal with current role disabled', () => {
      const modal = templateService.renderRoleChangeModal('developer');

      expect(modal.classList.contains('modal-overlay')).toBe(true);
      expect(modal.classList.contains('modal-overlay--glass')).toBe(true);

      const developerButton = modal.querySelector('[data-role="developer"]');
      expect(developerButton.classList.contains('role-button--disabled')).toBe(true);
      expect(developerButton.disabled).toBe(true);
    });

    it('should enable non-current role buttons', () => {
      const modal = templateService.renderRoleChangeModal('recruiter');

      const developerButton = modal.querySelector('[data-role="developer"]');
      const friendButton = modal.querySelector('[data-role="friend"]');

      expect(developerButton.disabled).toBeFalsy();
      expect(friendButton.disabled).toBeFalsy();
    });
  });
});
