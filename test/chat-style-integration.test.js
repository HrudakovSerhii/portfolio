/**
 * Integration Tests for Chat Style Selection and Management
 * Tests the complete flow of style selection, conversation management, and restart functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock modules that aren't available in test environment
vi.mock('../src/scripts/modules/chat-bot/cv-data-service.js', () => ({
  default: class MockCVDataService {
    async loadCVData() {
      return true;
    }
  }
}));

vi.mock('../src/scripts/workers/optimized-ml-worker.js', () => ({}));

describe('Chat Style Integration', () => {
  let StyleManager;
  let ConversationManager;
  let mockSessionStorage;

  beforeEach(async () => {
    // Mock sessionStorage
    mockSessionStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    
    global.sessionStorage = mockSessionStorage;

    // Import modules
    const [
      { default: StyleManagerClass },
      { default: ConversationManagerClass }
    ] = await Promise.all([
      import('../src/scripts/modules/chat-bot/style-manager.js'),
      import('../src/scripts/modules/chat-bot/conversation-manager.js')
    ]);

    StyleManager = StyleManagerClass;
    ConversationManager = ConversationManagerClass;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Style Selection Flow', () => {
    let styleManager;
    let conversationManager;

    beforeEach(() => {
      styleManager = new StyleManager();
      conversationManager = new ConversationManager();
    });

    it('should persist selected style', () => {
      styleManager.setStyle('developer');
      
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'chatbot-conversation-style',
        'developer'
      );
    });

    it('should load persisted style on initialization', () => {
      mockSessionStorage.getItem.mockReturnValue('friend');
      
      const persistedStyle = styleManager.loadPersistedStyle();
      expect(persistedStyle).toBe('friend');
    });

    it('should validate style selection', () => {
      expect(styleManager.setStyle('hr')).toBe(true);
      expect(styleManager.getCurrentStyle()).toBe('hr');
      
      expect(styleManager.setStyle('invalid')).toBe(false);
      expect(styleManager.getCurrentStyle()).toBe('hr'); // Should remain unchanged
    });
  });

  describe('Conversation Management with Styles', () => {
    let styleManager;
    let conversationManager;

    beforeEach(() => {
      styleManager = new StyleManager();
      conversationManager = new ConversationManager();
    });

    it('should set style in both managers consistently', () => {
      styleManager.setStyle('hr');
      conversationManager.setStyle('hr');
      
      expect(styleManager.getCurrentStyle()).toBe('hr');
      expect(conversationManager.getStyle()).toBe('hr');
    });

    it('should generate style-appropriate responses', () => {
      styleManager.setStyle('hr');
      const greeting = styleManager.getGreeting();
      
      expect(greeting).toContain('Hello');
      expect(greeting).toContain('professional');
      
      styleManager.setStyle('friend');
      const friendGreeting = styleManager.getGreeting();
      
      expect(friendGreeting).toContain('👋');
      expect(friendGreeting).toContain('😊');
    });

    it('should maintain conversation history with style context', () => {
      conversationManager.setStyle('developer');
      
      conversationManager.addMessage(
        'What is your React experience?',
        'I have 3+ years of React development experience.',
        ['experience.react'],
        0.95
      );
      
      const history = conversationManager.getContext();
      expect(history).toHaveLength(1);
      expect(history[0].style).toBe('developer');
      expect(history[0].confidence).toBe(0.95);
    });
  });

  describe('Conversation Restart Functionality', () => {
    let styleManager;
    let conversationManager;

    beforeEach(() => {
      styleManager = new StyleManager();
      conversationManager = new ConversationManager();
    });

    it('should reset all state on restart', () => {
      // Setup initial state
      styleManager.setStyle('developer');
      conversationManager.setStyle('developer');
      conversationManager.addMessage('Test', 'Response', [], 0.8);
      
      // Simulate restart
      styleManager.resetStyle();
      conversationManager.clearHistory();
      
      expect(styleManager.getCurrentStyle()).toBeNull();
      expect(conversationManager.getContext()).toHaveLength(0);
    });

    it('should clear persisted style on restart', () => {
      styleManager.setStyle('hr');
      styleManager.resetStyle();
      
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('chatbot-conversation-style');
    });

    it('should maintain conversation flow after restart', () => {
      // Initial conversation
      styleManager.setStyle('developer');
      conversationManager.setStyle('developer');
      conversationManager.addMessage('Hello', 'Hi there!', [], 0.9);
      
      expect(conversationManager.getContext()).toHaveLength(1);
      
      // Restart
      styleManager.resetStyle();
      conversationManager.clearHistory();
      
      // New conversation with different style
      styleManager.setStyle('friend');
      conversationManager.setStyle('friend');
      conversationManager.addMessage('Hey!', 'Hey! 👋', [], 0.9);
      
      expect(conversationManager.getContext()).toHaveLength(1);
      expect(conversationManager.getStyle()).toBe('friend');
    });
  });

  describe('Style Integration with Conversation Manager', () => {
    let styleManager;
    let conversationManager;

    beforeEach(() => {
      styleManager = new StyleManager();
      conversationManager = new ConversationManager();
    });

    it('should coordinate style between managers', () => {
      styleManager.setStyle('hr');
      conversationManager.setStyle('hr');
      
      expect(styleManager.getCurrentStyle()).toBe('hr');
      expect(conversationManager.getStyle()).toBe('hr');
    });

    it('should generate style-appropriate responses', () => {
      styleManager.setStyle('friend');
      const greeting = styleManager.getGreeting();
      
      expect(greeting).toContain('👋');
      expect(greeting).toContain('😊');
    });

    it('should maintain style context in conversation history', () => {
      conversationManager.setStyle('developer');
      conversationManager.addMessage(
        'What is React?',
        'React is a JavaScript library for building user interfaces.',
        ['react'],
        0.95
      );
      
      const history = conversationManager.getContext();
      expect(history[0].style).toBe('developer');
    });
  });

  describe('Response Formatting Integration', () => {
    let styleManager;
    let conversationManager;

    beforeEach(() => {
      styleManager = new StyleManager();
      conversationManager = new ConversationManager();
    });

    it('should format responses based on selected style', () => {
      styleManager.setStyle('friend');
      const response = 'I have experience with React development.';
      const formatted = styleManager.formatResponse(response, { matchedSections: ['react'] });
      
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    it('should generate fallback messages in appropriate style', () => {
      styleManager.setStyle('hr');
      const fallback = styleManager.getFallbackMessages();
      
      expect(fallback.intro).toContain('apologize');
      expect(fallback.request).toContain('rephrase');
      
      styleManager.setStyle('friend');
      const friendFallback = styleManager.getFallbackMessages();
      
      expect(friendFallback.intro).toContain('😅');
    });

    it('should maintain style consistency across conversation', () => {
      styleManager.setStyle('developer');
      conversationManager.setStyle('developer');
      
      const greeting = styleManager.getGreeting();
      const errorMsg = styleManager.getErrorMessage();
      const rephraseMsg = styleManager.getRephraseMessage();
      
      expect(greeting).toContain('Hey');
      expect(errorMsg).toContain('wrong');
      expect(rephraseMsg).toContain('rephrase');
    });
  });

  describe('Error Handling with Styles', () => {
    let styleManager;

    beforeEach(() => {
      styleManager = new StyleManager();
    });

    it('should provide style-appropriate error messages', () => {
      const hrError = styleManager.getErrorMessage('hr');
      const devError = styleManager.getErrorMessage('developer');
      const friendError = styleManager.getErrorMessage('friend');
      
      expect(hrError).toContain('apologize');
      expect(devError).toContain('wrong');
      expect(friendError).toContain('😅');
    });

    it('should provide style-appropriate rephrase messages', () => {
      const hrRephrase = styleManager.getRephraseMessage('hr');
      const devRephrase = styleManager.getRephraseMessage('developer');
      const friendRephrase = styleManager.getRephraseMessage('friend');
      
      expect(hrRephrase).toContain('rephrase');
      expect(devRephrase).toContain('rephrase');
      expect(friendRephrase).toContain('🤔');
    });

    it('should fallback to developer style for invalid styles', () => {
      const invalidError = styleManager.getErrorMessage('invalid');
      const devError = styleManager.getErrorMessage('developer');
      
      expect(invalidError).toBe(devError);
    });
  });

  describe('Complete Workflow Integration', () => {
    let styleManager;
    let conversationManager;

    beforeEach(() => {
      styleManager = new StyleManager();
      conversationManager = new ConversationManager();
    });

    it('should handle complete conversation flow with style changes', () => {
      // Initial style selection
      expect(styleManager.setStyle('hr')).toBe(true);
      conversationManager.setStyle('hr');
      
      // Add some conversation
      conversationManager.addMessage('Tell me about your experience', 'I have 5+ years of professional experience...', ['experience'], 0.9);
      
      expect(conversationManager.getContext()).toHaveLength(1);
      expect(conversationManager.getStyle()).toBe('hr');
      
      // Restart conversation with new style
      styleManager.resetStyle();
      conversationManager.clearHistory();
      
      expect(styleManager.getCurrentStyle()).toBeNull();
      expect(conversationManager.getContext()).toHaveLength(0);
      
      // New style selection
      styleManager.setStyle('friend');
      conversationManager.setStyle('friend');
      
      const greeting = styleManager.getGreeting();
      expect(greeting).toContain('👋');
      
      // New conversation
      conversationManager.addMessage('Hey! How are you?', 'Hey! 👋 I\'m doing great! Thanks for asking! 😊', ['greeting'], 0.95);
      
      expect(conversationManager.getContext()).toHaveLength(1);
      expect(conversationManager.getStyle()).toBe('friend');
    });

    it('should persist and restore style across sessions', () => {
      // Set and persist style
      styleManager.setStyle('developer');
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('chatbot-conversation-style', 'developer');
      
      // Simulate page reload by creating new manager
      mockSessionStorage.getItem.mockReturnValue('developer');
      const newStyleManager = new StyleManager();
      
      const persistedStyle = newStyleManager.loadPersistedStyle();
      expect(persistedStyle).toBe('developer');
      
      newStyleManager.setStyle(persistedStyle);
      expect(newStyleManager.getCurrentStyle()).toBe('developer');
    });
  });
});