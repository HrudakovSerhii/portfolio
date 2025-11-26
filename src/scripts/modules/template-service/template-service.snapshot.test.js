/**
 * Snapshot tests for TemplateService using real HTML templates
 * 
 * These tests verify that the TemplateService correctly renders
 * actual HTML templates from index.html and that the
 * rendered output matches expected snapshots.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Window } from 'happy-dom';
import TemplateService from './template-service.js';

describe('TemplateService - Snapshot Tests with Real Templates', () => {
  let window;
  let document;
  let templateService;

  beforeEach(() => {
    const htmlPath = join(process.cwd(), 'src/index.html');
    const htmlContent = readFileSync(htmlPath, 'utf-8');

    // Create a DOM environment with the real HTML
    window = new Window();
    document = window.document;
    document.write(htmlContent);

    // Set global document for TemplateService
    global.document = document;

    // Create TemplateService instance
    templateService = new TemplateService();
  });

  describe('renderSection', () => {
    it('should render section with zig-zag-left layout', () => {
      const sectionData = {
        sectionId: 'hero',
        title: 'Welcome',
        text: 'This is the hero section with some introductory text.',
        imageUrl: '/images/hero.jpg',
        imageAlt: 'Hero image',
        aspectRatio: 'aspect-video',
        customQuery: null
      };

      const section = templateService.renderSection(sectionData, true);

      // Verify structure
      expect(section.getAttribute('data-section-id')).toBe('hero');
      expect(section.id).toBe('section-hero');
      expect(section.querySelector('.section-title').textContent).toBe('Welcome');
      expect(section.querySelector('.section-content').classList.contains('zig-zag-left')).toBe(true);

      // Snapshot the rendered HTML
      expect(section.outerHTML).toMatchSnapshot();
    });

    it('should render section with zig-zag-right layout', () => {
      const sectionData = {
        sectionId: 'about',
        title: 'About Me',
        text: 'Learn more about my background and experience.',
        imageUrl: '/images/about.jpg',
        imageAlt: 'About image',
        aspectRatio: 'aspect-square',
        customQuery: null
      };

      const section = templateService.renderSection(sectionData, false);

      expect(section.querySelector('.section-content').classList.contains('zig-zag-right')).toBe(true);
      expect(section.outerHTML).toMatchSnapshot();
    });

    it('should render section with custom query', () => {
      const sectionData = {
        sectionId: 'skills',
        title: 'Skills',
        text: 'Here are my technical skills and expertise.',
        imageUrl: '/images/skills.jpg',
        imageAlt: 'Skills visualization',
        aspectRatio: 'aspect-video',
        customQuery: 'What are your top 3 programming languages?'
      };

      const section = templateService.renderSection(sectionData, true);

      const queryElement = section.querySelector('.section-query');
      expect(queryElement.textContent).toBe('"What are your top 3 programming languages?"');
      expect(queryElement.style.display).toBe('block');
      expect(section.outerHTML).toMatchSnapshot();
    });
  });

  describe('renderActionPrompt', () => {
    it('should render action prompt with placeholder', () => {
      const actionPrompt = templateService.renderActionPrompt(
        'experience',
        'React, Node.js, TypeScript'
      );

      expect(actionPrompt.id).toBe('action-prompt-experience');
      expect(actionPrompt.getAttribute('data-section-id')).toBe('experience');
      
      const input = actionPrompt.querySelector('.prompt-input');
      expect(input.placeholder).toBe('React, Node.js, TypeScript');
      expect(input.id).toBe('prompt-input-experience');

      const button = actionPrompt.querySelector('.prompt-button');
      expect(button.textContent).toBe('Get to know Experience');

      expect(actionPrompt.outerHTML).toMatchSnapshot();
    });
  });

  describe('renderNavigationItem', () => {
    it('should render navigation item with emoji icon', () => {
      const metadata = {
        id: 'projects',
        title: 'Projects',
        icon: '📁'
      };

      const navItem = templateService.renderNavigationItem(metadata);

      expect(navItem.getAttribute('data-section-id')).toBe('projects');
      expect(navItem.href).toContain('#section-projects');
      expect(navItem.querySelector('.nav-icon').textContent).toBe('📁');
      expect(navItem.querySelector('.nav-title').getAttribute('data-text')).toBe('Projects');

      expect(navItem.outerHTML).toMatchSnapshot();
    });

    it('should render navigation item with fallback icon', () => {
      const metadata = {
        id: 'contact',
        title: 'Contact',
        icon: null
      };

      const navItem = templateService.renderNavigationItem(metadata);

      expect(navItem.querySelector('.nav-icon').textContent).toBe('📄');
      expect(navItem.outerHTML).toMatchSnapshot();
    });
  });

  describe('renderLoader', () => {
    it('should render loader component', () => {
      const loader = templateService.renderLoader();

      expect(loader.classList.contains('loader')).toBe(true);
      expect(loader.querySelector('.loader-spinner')).toBeTruthy();

      expect(loader.outerHTML).toMatchSnapshot();
    });
  });

  describe('renderTypingIndicator', () => {
    it('should return existing typing indicator from DOM', () => {
      const indicator = templateService.renderTypingIndicator();

      expect(indicator.id).toBe('typing-indicator');
      expect(indicator.querySelector('.typing-dot')).toBeTruthy();

      expect(indicator.outerHTML).toMatchSnapshot();
    });
  });

  describe('renderPersonalizationModal', () => {
    it('should render personalization modal with glass effect', () => {
      const modal = templateService.renderPersonalizationModal();

      expect(modal.classList.contains('modal-overlay')).toBe(true);
      expect(modal.classList.contains('modal-overlay--glass')).toBe(true);

      const roleButtons = modal.querySelectorAll('.role-button');
      expect(roleButtons.length).toBe(3);

      // Verify role button data attributes
      const roles = Array.from(roleButtons).map(btn => btn.getAttribute('data-role'));
      expect(roles).toEqual(['recruiter', 'developer', 'friend']);

      expect(modal.outerHTML).toMatchSnapshot();
    });
  });

  describe('renderRoleChangeModal', () => {
    it('should render role change modal with developer role disabled', () => {
      const modal = templateService.renderRoleChangeModal('developer');

      expect(modal.classList.contains('modal-overlay')).toBe(true);
      expect(modal.classList.contains('modal-overlay--glass')).toBe(true);

      const developerButton = modal.querySelector('[data-role="developer"]');
      expect(developerButton.disabled).toBe(true);

      const recruiterButton = modal.querySelector('[data-role="recruiter"]');
      expect(recruiterButton.disabled).toBeFalsy();

      expect(modal.outerHTML).toMatchSnapshot();
    });

    it('should render role change modal with recruiter role disabled', () => {
      const modal = templateService.renderRoleChangeModal('recruiter');

      const recruiterButton = modal.querySelector('[data-role="recruiter"]');
      expect(recruiterButton.disabled).toBe(true);

      expect(modal.outerHTML).toMatchSnapshot();
    });

    it('should render role change modal with friend role disabled', () => {
      const modal = templateService.renderRoleChangeModal('friend');

      const friendButton = modal.querySelector('[data-role="friend"]');
      expect(friendButton.disabled).toBe(true);

      expect(modal.outerHTML).toMatchSnapshot();
    });
  });

  describe('Template Structure Validation', () => {
    it('should have all required templates in HTML', () => {
      const requiredTemplates = [
        'section-template',
        'action-prompt-template',
        'nav-item-template',
        'loader-template',
        'personalization-modal-template',
        'role-change-modal-template'
      ];

      requiredTemplates.forEach(templateId => {
        const template = document.getElementById(templateId);
        expect(template).toBeTruthy();
        expect(template.tagName).toBe('TEMPLATE');
      });
    });

    it('should have typing indicator in DOM', () => {
      const indicator = document.getElementById('typing-indicator');
      expect(indicator).toBeTruthy();
    });
  });
});
