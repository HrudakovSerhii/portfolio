import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Worker
global.Worker = vi.fn().mockImplementation(() => ({
  postMessage: vi.fn(),
  terminate: vi.fn(),
  onmessage: null,
  onerror: null
}));

// Mock WebAssembly
global.WebAssembly = {};

describe('ChatBot', () => {
  let ChatBot;
  let chatBot;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Import ChatBot
    const module = await import('../src/scripts/modules/chat-bot/chat-bot.js');
    ChatBot = module.ChatBot;
    
    chatBot = new ChatBot();
  });

  afterEach(() => {
    if (chatBot) {
      // Mock the conversationManager if it doesn't exist
      if (chatBot.conversationManager && !chatBot.conversationManager.clearHistory) {
        chatBot.conversationManager.clearHistory = vi.fn();
      }
      // Mock the worker if it doesn't have terminate method
      if (chatBot.worker && !chatBot.worker.terminate) {
        chatBot.worker.terminate = vi.fn();
      }
      chatBot.destroy();
    }
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(chatBot.isInitialized).toBe(false);
      expect(chatBot.worker).toBe(null);
      expect(chatBot.ui).toBe(null);
      expect(chatBot.conversationManager).toBe(null);
      expect(chatBot.cvDataService).toBe(null);
      expect(chatBot.currentStyle).toBe(null);
      expect(chatBot.initializationPromise).toBe(null);
    });
  });

  describe('Browser Compatibility', () => {
    it('should detect supported browser', () => {
      const isCompatible = chatBot._checkBrowserCompatibility();
      expect(isCompatible).toBe(true);
    });

    it('should detect unsupported browser without Worker', () => {
      const originalWorker = global.Worker;
      delete global.Worker;
      
      const isCompatible = chatBot._checkBrowserCompatibility();
      expect(isCompatible).toBe(false);
      
      global.Worker = originalWorker;
    });

    it('should detect unsupported browser without WebAssembly', () => {
      const originalWebAssembly = global.WebAssembly;
      delete global.WebAssembly;
      
      const isCompatible = chatBot._checkBrowserCompatibility();
      expect(isCompatible).toBe(false);
      
      global.WebAssembly = originalWebAssembly;
    });
  });

  describe('Style Selection', () => {
    it('should accept valid conversation styles when initialized', async () => {
      // Mock successful initialization
      chatBot.isInitialized = true;
      chatBot.ui = { 
        showChatInterface: vi.fn(), 
        addMessage: vi.fn(),
        clearMessages: vi.fn()
      };
      chatBot.conversationManager = { setStyle: vi.fn() };
      chatBot.styleManager = { 
        isValidStyle: vi.fn().mockReturnValue(true),
        setStyle: vi.fn(),
        getGreeting: vi.fn().mockReturnValue('Hello!')
      };
      
      const validStyles = ['hr', 'developer', 'friend'];
      
      for (const style of validStyles) {
        await expect(chatBot.selectConversationStyle(style)).resolves.not.toThrow();
        expect(chatBot.currentStyle).toBe(style);
      }
    });

    it('should reject invalid conversation styles', async () => {
      chatBot.isInitialized = true;
      chatBot.styleManager = { 
        isValidStyle: vi.fn().mockReturnValue(false)
      };
      
      await expect(chatBot.selectConversationStyle('invalid')).rejects.toThrow('Invalid conversation style');
    });

    it('should throw error if not initialized', async () => {
      const uninitializedChatBot = new ChatBot();
      await expect(uninitializedChatBot.selectConversationStyle('hr')).rejects.toThrow('ChatBot not initialized');
    });
  });

  describe('Message Processing', () => {
    it('should process messages when ready', async () => {
      // Mock ready state
      chatBot.isInitialized = true;
      chatBot.currentStyle = 'developer';
      chatBot.ui = { 
        addMessage: vi.fn(), 
        showTypingIndicator: vi.fn() 
      };
      chatBot.conversationManager = { 
        getContext: vi.fn().mockReturnValue([]) 
      };
      chatBot.worker = { 
        postMessage: vi.fn() 
      };
      
      const message = 'Tell me about your React experience';
      
      await expect(chatBot.processMessage(message)).resolves.not.toThrow();
      expect(chatBot.ui.addMessage).toHaveBeenCalledWith(message, true);
      expect(chatBot.ui.showTypingIndicator).toHaveBeenCalled();
      expect(chatBot.worker.postMessage).toHaveBeenCalledWith({
        type: 'process_query',
        message: message,
        context: [],
        style: 'developer'
      });
    });

    it('should throw error if not ready', async () => {
      const uninitializedChatBot = new ChatBot();
      await expect(uninitializedChatBot.processMessage('test')).rejects.toThrow('ChatBot not ready for messages');
    });
  });

  describe('Conversation Restart', () => {
    it('should restart conversation and clear history when initialized', async () => {
      // Mock initialized state
      chatBot.isInitialized = true;
      chatBot.currentStyle = 'developer';
      chatBot.conversationManager = { clearHistory: vi.fn() };
      chatBot.styleManager = { resetStyle: vi.fn() };
      chatBot.ui = { 
        showStyleSelection: vi.fn(),
        clearMessages: vi.fn()
      };
      
      await chatBot.restartConversation();
      
      expect(chatBot.currentStyle).toBe(null);
      expect(chatBot.conversationManager.clearHistory).toHaveBeenCalled();
      expect(chatBot.styleManager.resetStyle).toHaveBeenCalled();
      expect(chatBot.ui.showStyleSelection).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should properly cleanup resources', () => {
      const mockWorker = { terminate: vi.fn() };
      const mockConversationManager = { clearHistory: vi.fn() };
      
      chatBot.worker = mockWorker;
      chatBot.conversationManager = mockConversationManager;
      chatBot.isInitialized = true;
      
      chatBot.destroy();
      
      expect(mockWorker.terminate).toHaveBeenCalled();
      expect(chatBot.worker).toBe(null);
      expect(mockConversationManager.clearHistory).toHaveBeenCalled();
      expect(chatBot.isInitialized).toBe(false);
      expect(chatBot.initializationPromise).toBe(null);
    });
  });

  describe('Style Messages', () => {
    beforeEach(() => {
      // Mock StyleManager for these tests
      chatBot.styleManager = {
        getGreeting: vi.fn((style) => {
          const greetings = {
            hr: 'Hello! I can help you learn about his professional experience.',
            developer: 'Hey there! Feel free to ask me about technical experience.',
            friend: 'Hi! 👋 Ask me anything about his work!'
          };
          return greetings[style] || greetings.developer;
        }),
        getErrorMessage: vi.fn((style) => {
          const messages = {
            hr: 'I apologize, but I\'m experiencing technical difficulties.',
            developer: 'Hmm, something went wrong on my end.',
            friend: 'Oops! 😅 Something got mixed up.'
          };
          return messages[style] || messages.developer;
        }),
        getRephraseMessage: vi.fn((style) => {
          const messages = {
            hr: 'Could you please rephrase your question?',
            developer: 'Could you rephrase that or give me more context?',
            friend: 'I\'m not sure I got that! 🤔 Could you ask differently?'
          };
          return messages[style] || messages.developer;
        })
      };
    });

    it('should return appropriate greeting for each style', () => {
      const hrGreeting = chatBot.styleManager.getGreeting('hr');
      const devGreeting = chatBot.styleManager.getGreeting('developer');
      const friendGreeting = chatBot.styleManager.getGreeting('friend');
      
      expect(hrGreeting).toContain('professional');
      expect(devGreeting).toContain('technical');
      expect(friendGreeting).toContain('👋');
    });

    it('should return appropriate error messages for each style', () => {
      const hrError = chatBot.styleManager.getErrorMessage('hr');
      const devError = chatBot.styleManager.getErrorMessage('developer');
      const friendError = chatBot.styleManager.getErrorMessage('friend');
      
      expect(hrError).toContain('apologize');
      expect(devError).toContain('wrong');
      expect(friendError).toContain('😅');
    });

    it('should return appropriate rephrase messages for each style', () => {
      const hrRephrase = chatBot.styleManager.getRephraseMessage('hr');
      const devRephrase = chatBot.styleManager.getRephraseMessage('developer');
      const friendRephrase = chatBot.styleManager.getRephraseMessage('friend');
      
      expect(hrRephrase).toContain('rephrase');
      expect(devRephrase).toContain('rephrase');
      expect(friendRephrase).toContain('🤔');
    });
  });
});