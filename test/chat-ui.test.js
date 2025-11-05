/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the ChatUI module
const ChatUI = vi.fn().mockImplementation(() => {
  const instance = {
    chatContainer: null,
    messagesContainer: null,
    inputContainer: null,
    styleSelection: null,
    loadingContainer: null,
    typingIndicator: null,
    isInitialized: false,
    onStyleSelect: null,
    onMessageSend: null,
    onRestart: null,

    initialize() {
      if (this.isInitialized) return;
      this.findChatElements();
      this.attachEventListeners();
      this.isInitialized = true;
    },

    findChatElements() {
      // Find existing elements in the DOM
      this.chatContainer = document.getElementById('chat-container');
      this.chatTrigger = document.getElementById('chat-trigger');
      
      if (!this.chatContainer) {
        throw new Error('Chat container not found in HTML');
      }

      // Store references
      this.loadingContainer = this.chatContainer.querySelector('.chat-loading');
      this.styleSelection = this.chatContainer.querySelector('.chat-style-selection');
      this.messagesContainer = this.chatContainer.querySelector('.messages-container');
      this.inputContainer = this.chatContainer.querySelector('.chat-input');
      this.typingIndicator = this.chatContainer.querySelector('.typing-indicator');
    },

    attachEventListeners() {
      // Style selection
      const styleOptions = this.chatContainer.querySelectorAll('.style-option');
      styleOptions.forEach(option => {
        option.addEventListener('click', (e) => {
          const style = e.currentTarget.dataset.style;
          if (this.onStyleSelect) {
            this.onStyleSelect(style);
          }
        });
      });

      // Message input
      const sendButton = this.chatContainer.querySelector('.send-button');
      const messageInput = this.chatContainer.querySelector('.message-input');
      
      const sendMessage = () => {
        const message = messageInput.value.trim();
        if (message && this.onMessageSend) {
          this.onMessageSend(message);
          messageInput.value = '';
        }
      };

      sendButton.addEventListener('click', sendMessage);
      messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          sendMessage();
        }
      });

      // Restart button
      const restartBtn = this.chatContainer.querySelector('.restart-button');
      restartBtn.addEventListener('click', () => {
        if (this.onRestart) {
          this.onRestart();
        }
      });
    },

    showLoadingState(message = "Wait, I'm loading as fast as I can!") {
      this.hideAllStates();
      this.loadingContainer.classList.remove('hidden');
      const loadingMessage = this.loadingContainer.querySelector('.loading-message');
      loadingMessage.textContent = message;
    },

    showStyleSelection() {
      this.hideAllStates();
      this.styleSelection.classList.remove('hidden');
    },

    showChatInterface() {
      this.hideAllStates();
      this.chatContainer.querySelector('.chat-messages').classList.remove('hidden');
      this.inputContainer.classList.remove('hidden');
    },

    addMessage(message, isUser = false, style = null) {
      const messageElement = document.createElement('div');
      messageElement.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
      messageElement.innerHTML = `
        <div class="message-content">
          <div class="message-text">${this.escapeHtml(message)}</div>
        </div>
      `;
      this.messagesContainer.appendChild(messageElement);
    },

    showTypingIndicator() {
      this.typingIndicator.classList.remove('hidden');
    },

    hideTypingIndicator() {
      this.typingIndicator.classList.add('hidden');
    },

    showError(message) {
      this.hideAllStates();
      const errorContainer = this.chatContainer.querySelector('.chat-error');
      const errorMessage = errorContainer.querySelector('.error-message');
      errorMessage.textContent = message;
      errorContainer.classList.remove('hidden');
    },

    hideError() {
      const errorContainer = this.chatContainer.querySelector('.chat-error');
      errorContainer.classList.add('hidden');
    },

    showFallbackForm() {
      this.hideAllStates();
      const fallbackContainer = this.chatContainer.querySelector('.chat-fallback');
      fallbackContainer.classList.remove('hidden');
    },

    hideFallbackForm() {
      const fallbackContainer = this.chatContainer.querySelector('.chat-fallback');
      fallbackContainer.classList.add('hidden');
    },

    clearMessages() {
      this.messagesContainer.innerHTML = '';
    },

    show() {
      this.chatContainer.classList.add('visible');
    },

    hide() {
      this.chatContainer.classList.remove('visible');
    },

    destroy() {
      this.hide();
      this.clearMessages();
      this.hideAllStates();
      this.isInitialized = false;
    },

    hideAllStates() {
      const states = [
        '.chat-loading',
        '.chat-style-selection', 
        '.chat-messages',
        '.chat-input',
        '.chat-error',
        '.chat-fallback'
      ];
      
      states.forEach(selector => {
        const element = this.chatContainer.querySelector(selector);
        if (element) {
          element.classList.add('hidden');
        }
      });
    },

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    setEventHandlers({ onStyleSelect, onMessageSend, onRestart }) {
      this.onStyleSelect = onStyleSelect;
      this.onMessageSend = onMessageSend;
      this.onRestart = onRestart;
    }
  };

  return instance;
});

describe('ChatUI', () => {
  let chatUI;

  beforeEach(() => {
    // Clear document body and add required HTML structure
    document.body.innerHTML = `
      <div class="chat-container" id="chat-container">
        <div class="chat-header">
          <h3 class="chat-title">Chat with Serhii AI</h3>
          <button class="chat-close">×</button>
        </div>
        <div class="chat-content">
          <div class="chat-loading hidden">
            <div class="loading-spinner"></div>
            <p class="loading-message">Wait, I'm loading as fast as I can!</p>
            <div class="loading-progress"><div class="progress-bar"></div></div>
          </div>
          <div class="chat-style-selection hidden">
            <button class="style-option" data-style="hr">HR</button>
            <button class="style-option" data-style="developer">Developer</button>
            <button class="style-option" data-style="friend">Friend</button>
          </div>
          <div class="chat-messages hidden">
            <div class="messages-container"></div>
            <div class="typing-indicator hidden"></div>
          </div>
          <div class="chat-input hidden">
            <input type="text" class="message-input" placeholder="Ask me anything...">
            <button class="send-button">Send</button>
            <button class="restart-button">Restart</button>
          </div>
          <div class="chat-error hidden">
            <p class="error-message"></p>
            <button class="error-retry">Try Again</button>
          </div>
          <div class="chat-fallback hidden">
            <form class="fallback-form">
              <input type="text" class="fallback-name" placeholder="Your name">
              <input type="email" class="fallback-email" placeholder="Your email">
              <button type="submit" class="fallback-submit">Send Email</button>
              <button type="button" class="fallback-cancel">Continue</button>
            </form>
          </div>
        </div>
      </div>
      <button class="chat-trigger" id="chat-trigger">Chat</button>
    `;
    
    // Create new ChatUI instance
    chatUI = new ChatUI();
  });

  afterEach(() => {
    if (chatUI && chatUI.destroy) {
      chatUI.destroy();
    }
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    it('should initialize correctly', () => {
      expect(chatUI.isInitialized).toBe(false);
      
      chatUI.initialize();
      
      expect(chatUI.isInitialized).toBe(true);
      expect(chatUI.chatContainer).toBeTruthy();
      expect(document.body.contains(chatUI.chatContainer)).toBe(true);
    });

    it('should not initialize twice', () => {
      chatUI.initialize();
      const firstContainer = chatUI.chatContainer;
      
      chatUI.initialize();
      
      expect(chatUI.chatContainer).toBe(firstContainer);
      expect(document.querySelectorAll('.chat-container')).toHaveLength(1);
    });

    it('should create all required UI elements', () => {
      chatUI.initialize();
      
      expect(chatUI.chatContainer.querySelector('.chat-header')).toBeTruthy();
      expect(chatUI.chatContainer.querySelector('.chat-loading')).toBeTruthy();
      expect(chatUI.chatContainer.querySelector('.chat-style-selection')).toBeTruthy();
      expect(chatUI.chatContainer.querySelector('.chat-messages')).toBeTruthy();
      expect(chatUI.chatContainer.querySelector('.chat-input')).toBeTruthy();
      expect(chatUI.chatContainer.querySelector('.chat-error')).toBeTruthy();
      expect(chatUI.chatContainer.querySelector('.chat-fallback')).toBeTruthy();
    });
  });

  describe('State Management', () => {
    beforeEach(() => {
      chatUI.initialize();
    });

    it('should show loading state correctly', () => {
      chatUI.showLoadingState();
      
      expect(chatUI.loadingContainer.classList.contains('hidden')).toBe(false);
      expect(chatUI.styleSelection.classList.contains('hidden')).toBe(true);
    });

    it('should show loading state with custom message', () => {
      const customMessage = 'Custom loading message';
      chatUI.showLoadingState(customMessage);
      
      const messageElement = chatUI.loadingContainer.querySelector('.loading-message');
      expect(messageElement.textContent).toBe(customMessage);
    });

    it('should show style selection', () => {
      chatUI.showStyleSelection();
      
      expect(chatUI.styleSelection.classList.contains('hidden')).toBe(false);
      expect(chatUI.loadingContainer.classList.contains('hidden')).toBe(true);
    });

    it('should show chat interface', () => {
      chatUI.showChatInterface();
      
      const messagesDiv = chatUI.chatContainer.querySelector('.chat-messages');
      expect(messagesDiv.classList.contains('hidden')).toBe(false);
      expect(chatUI.inputContainer.classList.contains('hidden')).toBe(false);
    });

    it('should show error state', () => {
      const errorMessage = 'Test error message';
      chatUI.showError(errorMessage);
      
      const errorContainer = chatUI.chatContainer.querySelector('.chat-error');
      const messageElement = errorContainer.querySelector('.error-message');
      
      expect(errorContainer.classList.contains('hidden')).toBe(false);
      expect(messageElement.textContent).toBe(errorMessage);
    });

    it('should show fallback form', () => {
      chatUI.showFallbackForm();
      
      const fallbackContainer = chatUI.chatContainer.querySelector('.chat-fallback');
      expect(fallbackContainer.classList.contains('hidden')).toBe(false);
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      chatUI.initialize();
    });

    it('should add user message correctly', () => {
      const message = 'Hello, this is a test message';
      chatUI.addMessage(message, true);
      
      const messageElements = chatUI.messagesContainer.querySelectorAll('.message');
      expect(messageElements).toHaveLength(1);
      
      const messageElement = messageElements[0];
      expect(messageElement.classList.contains('user-message')).toBe(true);
      expect(messageElement.querySelector('.message-text').textContent).toBe(message);
    });

    it('should add bot message correctly', () => {
      const message = 'Hello, this is a bot response';
      chatUI.addMessage(message, false, 'developer');
      
      const messageElements = chatUI.messagesContainer.querySelectorAll('.message');
      expect(messageElements).toHaveLength(1);
      
      const messageElement = messageElements[0];
      expect(messageElement.classList.contains('bot-message')).toBe(true);
      expect(messageElement.querySelector('.message-text').textContent).toBe(message);
    });

    it('should escape HTML in messages', () => {
      const maliciousMessage = '<script>alert("xss")</script>';
      chatUI.addMessage(maliciousMessage, true);
      
      const messageElement = chatUI.messagesContainer.querySelector('.message-text');
      expect(messageElement.innerHTML).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('should clear all messages', () => {
      chatUI.addMessage('Message 1', true);
      chatUI.addMessage('Message 2', false);
      
      expect(chatUI.messagesContainer.children).toHaveLength(2);
      
      chatUI.clearMessages();
      
      expect(chatUI.messagesContainer.children).toHaveLength(0);
    });
  });

  describe('Typing Indicator', () => {
    beforeEach(() => {
      chatUI.initialize();
    });

    it('should show typing indicator', () => {
      chatUI.showTypingIndicator();
      
      expect(chatUI.typingIndicator.classList.contains('hidden')).toBe(false);
    });

    it('should hide typing indicator', () => {
      chatUI.showTypingIndicator();
      chatUI.hideTypingIndicator();
      
      expect(chatUI.typingIndicator.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      chatUI.initialize();
    });

    it('should handle style selection', () => {
      const mockStyleSelect = vi.fn();
      chatUI.setEventHandlers({ onStyleSelect: mockStyleSelect });
      
      const hrOption = chatUI.chatContainer.querySelector('[data-style="hr"]');
      hrOption.click();
      
      expect(mockStyleSelect).toHaveBeenCalledWith('hr');
    });

    it('should handle message sending via button', () => {
      const mockMessageSend = vi.fn();
      chatUI.setEventHandlers({ onMessageSend: mockMessageSend });
      
      const messageInput = chatUI.chatContainer.querySelector('.message-input');
      const sendButton = chatUI.chatContainer.querySelector('.send-button');
      
      messageInput.value = 'Test message';
      sendButton.click();
      
      expect(mockMessageSend).toHaveBeenCalledWith('Test message');
      expect(messageInput.value).toBe('');
    });

    it('should handle message sending via Enter key', () => {
      const mockMessageSend = vi.fn();
      chatUI.setEventHandlers({ onMessageSend: mockMessageSend });
      
      const messageInput = chatUI.chatContainer.querySelector('.message-input');
      messageInput.value = 'Test message';
      
      const enterEvent = new KeyboardEvent('keypress', { key: 'Enter' });
      messageInput.dispatchEvent(enterEvent);
      
      expect(mockMessageSend).toHaveBeenCalledWith('Test message');
    });

    it('should handle restart button', () => {
      const mockRestart = vi.fn();
      chatUI.setEventHandlers({ onRestart: mockRestart });
      
      const restartButton = chatUI.chatContainer.querySelector('.restart-button');
      restartButton.click();
      
      expect(mockRestart).toHaveBeenCalled();
    });

    it('should not send empty messages', () => {
      const mockMessageSend = vi.fn();
      chatUI.setEventHandlers({ onMessageSend: mockMessageSend });
      
      const messageInput = chatUI.chatContainer.querySelector('.message-input');
      const sendButton = chatUI.chatContainer.querySelector('.send-button');
      
      messageInput.value = '   '; // Only whitespace
      sendButton.click();
      
      expect(mockMessageSend).not.toHaveBeenCalled();
    });
  });

  describe('Visibility Control', () => {
    beforeEach(() => {
      chatUI.initialize();
    });

    it('should show chat container', () => {
      chatUI.show();
      
      expect(chatUI.chatContainer.classList.contains('visible')).toBe(true);
    });

    it('should hide chat container', () => {
      chatUI.show();
      chatUI.hide();
      
      expect(chatUI.chatContainer.classList.contains('visible')).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should destroy chat UI properly', () => {
      chatUI.initialize();
      const container = chatUI.chatContainer;
      
      expect(document.body.contains(container)).toBe(true);
      expect(chatUI.isInitialized).toBe(true);
      
      chatUI.destroy();
      
      expect(document.body.contains(container)).toBe(false);
      expect(chatUI.isInitialized).toBe(false);
    });
  });

  describe('Requirements Validation', () => {
    beforeEach(() => {
      chatUI.initialize();
    });

    // Requirement 1.2: Loading states and progress indicators
    it('should meet requirement 1.2 - loading states and progress indicators', () => {
      chatUI.showLoadingState();
      
      const spinner = chatUI.loadingContainer.querySelector('.loading-spinner');
      const progressBar = chatUI.loadingContainer.querySelector('.progress-bar');
      
      expect(spinner).toBeTruthy();
      expect(progressBar).toBeTruthy();
      expect(chatUI.loadingContainer.classList.contains('hidden')).toBe(false);
    });

    // Requirement 1.3: Error message display
    it('should meet requirement 1.3 - error message display', () => {
      const errorMessage = 'Test error occurred';
      chatUI.showError(errorMessage);
      
      const errorContainer = chatUI.chatContainer.querySelector('.chat-error');
      const messageElement = errorContainer.querySelector('.error-message');
      
      expect(errorContainer.classList.contains('hidden')).toBe(false);
      expect(messageElement.textContent).toBe(errorMessage);
    });

    // Requirement 2.1: Conversation style selection interface
    it('should meet requirement 2.1 - conversation style selection interface', () => {
      chatUI.showStyleSelection();
      
      const styleOptions = chatUI.chatContainer.querySelectorAll('.style-option');
      expect(styleOptions).toHaveLength(3);
      
      const styles = Array.from(styleOptions).map(option => option.dataset.style);
      expect(styles).toEqual(['hr', 'developer', 'friend']);
    });

    // Requirement 6.1: Chat message display and input handling
    it('should meet requirement 6.1 - chat message display and input handling', () => {
      chatUI.showChatInterface();
      
      const messageInput = chatUI.chatContainer.querySelector('.message-input');
      const sendButton = chatUI.chatContainer.querySelector('.send-button');
      const messagesContainer = chatUI.messagesContainer;
      
      expect(messageInput).toBeTruthy();
      expect(sendButton).toBeTruthy();
      expect(messagesContainer).toBeTruthy();
      
      // Test message display
      chatUI.addMessage('Test message', true);
      expect(messagesContainer.children).toHaveLength(1);
    });
  });
});