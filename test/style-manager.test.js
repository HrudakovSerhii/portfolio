/**
 * Tests for StyleManager - Conversation style selection and management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import StyleManager from '../src/scripts/modules/chat-bot/style-manager.js';

describe('StyleManager', () => {
  let styleManager;
  let mockSessionStorage;

  beforeEach(() => {
    // Mock sessionStorage
    mockSessionStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    
    // Replace global sessionStorage
    global.sessionStorage = mockSessionStorage;
    Object.defineProperty(global, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true
    });

    styleManager = new StyleManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with no current style', () => {
      expect(styleManager.getCurrentStyle()).toBeNull();
    });

    it('should have three available styles', () => {
      const styles = styleManager.getAvailableStyles();
      expect(styles).toHaveLength(3);
      expect(styles.map(s => s.id)).toEqual(['hr', 'developer', 'friend']);
    });

    it('should initialize style data for all styles', () => {
      const hrData = styleManager.getStyleData('hr');
      const devData = styleManager.getStyleData('developer');
      const friendData = styleManager.getStyleData('friend');

      expect(hrData).toBeDefined();
      expect(devData).toBeDefined();
      expect(friendData).toBeDefined();

      // Check required properties
      ['name', 'icon', 'description', 'greeting', 'rephraseMessage', 'errorMessage'].forEach(prop => {
        expect(hrData[prop]).toBeDefined();
        expect(devData[prop]).toBeDefined();
        expect(friendData[prop]).toBeDefined();
      });
    });
  });

  describe('Style Selection', () => {
    it('should set valid styles successfully', () => {
      expect(styleManager.setStyle('hr')).toBe(true);
      expect(styleManager.getCurrentStyle()).toBe('hr');

      expect(styleManager.setStyle('developer')).toBe(true);
      expect(styleManager.getCurrentStyle()).toBe('developer');

      expect(styleManager.setStyle('friend')).toBe(true);
      expect(styleManager.getCurrentStyle()).toBe('friend');
    });

    it('should reject invalid styles', () => {
      expect(styleManager.setStyle('invalid')).toBe(false);
      expect(styleManager.getCurrentStyle()).toBeNull();

      expect(styleManager.setStyle('')).toBe(false);
      expect(styleManager.getCurrentStyle()).toBeNull();

      expect(styleManager.setStyle(null)).toBe(false);
      expect(styleManager.getCurrentStyle()).toBeNull();
    });

    it('should validate styles correctly', () => {
      expect(styleManager.isValidStyle('hr')).toBe(true);
      expect(styleManager.isValidStyle('developer')).toBe(true);
      expect(styleManager.isValidStyle('friend')).toBe(true);
      expect(styleManager.isValidStyle('invalid')).toBe(false);
      expect(styleManager.isValidStyle('')).toBe(false);
      expect(styleManager.isValidStyle(null)).toBe(false);
    });
  });

  describe('Style Data Retrieval', () => {
    beforeEach(() => {
      styleManager.setStyle('developer');
    });

    it('should return style data for current style', () => {
      const data = styleManager.getStyleData();
      expect(data).toBeDefined();
      expect(data.name).toBe('Technical (Developer)');
      expect(data.icon).toBe('💻');
    });

    it('should return style data for specific style', () => {
      const hrData = styleManager.getStyleData('hr');
      expect(hrData.name).toBe('Professional (HR)');
      expect(hrData.icon).toBe('👔');

      const friendData = styleManager.getStyleData('friend');
      expect(friendData.name).toBe('Casual (Friend)');
      expect(friendData.icon).toBe('😊');
    });

    it('should return null for invalid style', () => {
      expect(styleManager.getStyleData('invalid')).toBeNull();
    });
  });

  describe('Message Generation', () => {
    beforeEach(() => {
      styleManager.setStyle('hr');
    });

    it('should return appropriate greeting for each style', () => {
      const hrGreeting = styleManager.getGreeting('hr');
      const devGreeting = styleManager.getGreeting('developer');
      const friendGreeting = styleManager.getGreeting('friend');

      expect(hrGreeting).toContain('Hello');
      expect(hrGreeting).toContain('professional');
      
      expect(devGreeting).toContain('Hey');
      expect(devGreeting).toContain('technical');
      
      expect(friendGreeting).toContain('Hi');
      expect(friendGreeting).toContain('👋');
    });

    it('should return appropriate rephrase messages', () => {
      const hrRephrase = styleManager.getRephraseMessage('hr');
      const devRephrase = styleManager.getRephraseMessage('developer');
      const friendRephrase = styleManager.getRephraseMessage('friend');

      expect(hrRephrase).toContain('rephrase');
      expect(devRephrase).toContain('rephrase');
      expect(friendRephrase).toContain('🤔');
    });

    it('should return appropriate error messages', () => {
      const hrError = styleManager.getErrorMessage('hr');
      const devError = styleManager.getErrorMessage('developer');
      const friendError = styleManager.getErrorMessage('friend');

      expect(hrError).toContain('apologize');
      expect(devError).toContain('wrong');
      expect(friendError).toContain('😅');
    });

    it('should return fallback messages with intro and request', () => {
      const hrFallback = styleManager.getFallbackMessages('hr');
      const devFallback = styleManager.getFallbackMessages('developer');
      const friendFallback = styleManager.getFallbackMessages('friend');

      expect(hrFallback).toHaveProperty('intro');
      expect(hrFallback).toHaveProperty('request');
      expect(devFallback).toHaveProperty('intro');
      expect(devFallback).toHaveProperty('request');
      expect(friendFallback).toHaveProperty('intro');
      expect(friendFallback).toHaveProperty('request');
    });

    it('should return appropriate email subjects', () => {
      const hrSubject = styleManager.getEmailSubject('hr');
      const devSubject = styleManager.getEmailSubject('developer');
      const friendSubject = styleManager.getEmailSubject('friend');

      expect(hrSubject).toContain('Professional');
      expect(devSubject).toContain('Technical');
      expect(friendSubject).toContain('Friendly');
    });
  });

  describe('Response Formatting', () => {
    it('should format responses based on style', () => {
      styleManager.setStyle('friend');
      const response = 'I have experience with React development.';
      const formatted = styleManager.formatResponse(response, { matchedSections: ['react'] });
      
      // Friend style should potentially add emojis or enthusiasm
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    it('should detect emojis in text', () => {
      expect(styleManager.hasEmojis('Hello 👋')).toBe(true);
      expect(styleManager.hasEmojis('Hello world')).toBe(false);
      expect(styleManager.hasEmojis('React ⚛️ is great')).toBe(true);
    });

    it('should detect enthusiastic tone', () => {
      expect(styleManager.hasEnthusiasticTone('This is awesome!')).toBe(true);
      expect(styleManager.hasEnthusiasticTone('I love coding')).toBe(true);
      expect(styleManager.hasEnthusiasticTone('This is a response')).toBe(false);
      expect(styleManager.hasEnthusiasticTone('Great work 🎉')).toBe(true);
    });

    it('should add emojis for friend style only', () => {
      styleManager.setStyle('friend');
      const response = 'I work with React development';
      const enhanced = styleManager.addStyleAppropriateEmojis(response, {});
      
      // Should potentially add React emoji
      expect(enhanced).toBeDefined();
      
      // HR style should not add emojis
      styleManager.setStyle('hr');
      const hrResponse = styleManager.addStyleAppropriateEmojis(response, {});
      expect(hrResponse).toBe(response); // Should be unchanged
    });
  });

  describe('Style Persistence', () => {
    it('should persist style to sessionStorage', () => {
      styleManager.setStyle('developer');
      
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'chatbot-conversation-style',
        'developer'
      );
    });

    it('should load persisted style from sessionStorage', () => {
      mockSessionStorage.getItem.mockReturnValue('hr');
      
      const persistedStyle = styleManager.loadPersistedStyle();
      expect(persistedStyle).toBe('hr');
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('chatbot-conversation-style');
    });

    it('should return null for invalid persisted style', () => {
      mockSessionStorage.getItem.mockReturnValue('invalid-style');
      
      const persistedStyle = styleManager.loadPersistedStyle();
      expect(persistedStyle).toBeNull();
    });

    it('should handle sessionStorage errors gracefully', () => {
      mockSessionStorage.setItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      // Should not throw
      expect(() => styleManager.setStyle('developer')).not.toThrow();
      
      mockSessionStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      expect(styleManager.loadPersistedStyle()).toBeNull();
    });

    it('should clear persisted style', () => {
      styleManager.clearPersistedStyle();
      
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('chatbot-conversation-style');
    });
  });

  describe('Style Reset', () => {
    it('should reset style and clear persistence', () => {
      styleManager.setStyle('developer');
      expect(styleManager.getCurrentStyle()).toBe('developer');
      
      styleManager.resetStyle();
      
      expect(styleManager.getCurrentStyle()).toBeNull();
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('chatbot-conversation-style');
    });
  });

  describe('Available Styles', () => {
    it('should return all available styles with metadata', () => {
      const styles = styleManager.getAvailableStyles();
      
      expect(styles).toHaveLength(3);
      
      styles.forEach(style => {
        expect(style).toHaveProperty('id');
        expect(style).toHaveProperty('name');
        expect(style).toHaveProperty('icon');
        expect(style).toHaveProperty('description');
        expect(['hr', 'developer', 'friend']).toContain(style.id);
      });
    });
  });

  describe('Statistics', () => {
    it('should return style statistics', () => {
      styleManager.setStyle('developer');
      mockSessionStorage.getItem.mockReturnValue('developer');
      
      const stats = styleManager.getStyleStats();
      
      expect(stats).toHaveProperty('currentStyle', 'developer');
      expect(stats).toHaveProperty('availableStyles');
      expect(stats).toHaveProperty('styleData');
      expect(stats).toHaveProperty('sessionPersisted', true);
      expect(stats.availableStyles).toEqual(['hr', 'developer', 'friend']);
    });

    it('should return stats with no current style', () => {
      const stats = styleManager.getStyleStats();
      
      expect(stats.currentStyle).toBeNull();
      expect(stats.styleData).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined/null inputs gracefully', () => {
      expect(styleManager.getStyleData(undefined)).toBeNull();
      expect(styleManager.getGreeting(null)).toBe(styleManager.getStyleData('developer').greeting);
      expect(styleManager.getRephraseMessage(undefined)).toBe(styleManager.getStyleData('developer').rephraseMessage);
    });

    it('should fallback to developer style for invalid style requests', () => {
      const greeting = styleManager.getGreeting('invalid');
      const devGreeting = styleManager.getGreeting('developer');
      expect(greeting).toBe(devGreeting);
    });

    it('should handle empty response formatting', () => {
      styleManager.setStyle('friend');
      expect(styleManager.formatResponse('')).toBe('');
      expect(styleManager.formatResponse(null)).toBeNull();
    });
  });
});