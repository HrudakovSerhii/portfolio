/**
 * ChatUI - Manages the chat interface components and states
 * Handles loading states, style selection, message display, and user interactions
 */
class ChatUI {
  constructor() {
    this.chatContainer = null;
    this.chatTrigger = null;
    this.messagesContainer = null;
    this.inputContainer = null;
    this.styleSelection = null;
    this.loadingContainer = null;
    this.typingIndicator = null;
    this.isInitialized = false;

    // Event handlers
    this.onStyleSelect = null;
    this.onMessageSend = null;
    this.onRestart = null;
  }

  /**
   * Initialize the chat UI by finding existing HTML elements
   */
  initialize() {
    if (this.isInitialized) return;

    this.findChatElements();
    this.attachEventListeners();
    this.isInitialized = true;
  }

  /**
   * Find and store references to existing chat HTML elements
   */
  findChatElements() {
    // Find main chat container
    this.chatContainer = document.getElementById('chat-container');
    this.chatTrigger = document.getElementById('hero-chat-trigger');

    if (!this.chatContainer) {
      throw new Error('Chat container not found in HTML');
    }

    // Store references to key elements
    this.loadingContainer = this.chatContainer.querySelector('.chat-loading');
    this.styleSelection = this.chatContainer.querySelector('.chat-style-selection');
    this.messagesContainer = this.chatContainer.querySelector('.messages-container');
    this.inputContainer = this.chatContainer.querySelector('.chat-input');
    this.typingIndicator = this.chatContainer.querySelector('.typing-indicator');

    // Validate all required elements exist
    const requiredElements = [
      { element: this.loadingContainer, name: 'loading container' },
      { element: this.styleSelection, name: 'style selection' },
      { element: this.messagesContainer, name: 'messages container' },
      { element: this.inputContainer, name: 'input container' },
      { element: this.typingIndicator, name: 'typing indicator' }
    ];

    requiredElements.forEach(({ element, name }) => {
      if (!element) {
        throw new Error(`Required chat element not found: ${name}`);
      }
    });
  }

  /**
   * Attach event listeners to UI elements
   */
  attachEventListeners() {
    // Chat trigger button
    if (this.chatTrigger) {
      this.chatTrigger.addEventListener('click', () => this.show());
    }

    // Close button
    const closeBtn = this.chatContainer.querySelector('.chat-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

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
    const messageInput = this.chatContainer.querySelector('.message-input');
    const sendButton = this.chatContainer.querySelector('.send-button');

    const sendMessage = () => {
      const message = messageInput.value.trim();
      if (message && this.onMessageSend) {
        this.onMessageSend(message);
        messageInput.value = '';
      }
    };

    if (sendButton) {
      sendButton.addEventListener('click', sendMessage);
    }

    if (messageInput) {
      messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          sendMessage();
        }
      });
    }

    // Restart button
    const restartBtn = this.chatContainer.querySelector('.restart-button');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        if (this.onRestart) {
          this.onRestart();
        }
      });
    }

    // Error retry
    const retryBtn = this.chatContainer.querySelector('.error-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.hideError();
        this.showLoadingState();
        
        // Trigger re-initialization if callback is available
        if (this.onRetry) {
          this.onRetry();
        }
      });
    }

    // Error close
    const errorCloseBtn = this.chatContainer.querySelector('.error-close');
    if (errorCloseBtn) {
      errorCloseBtn.addEventListener('click', () => {
        this.hide();
      });
    }

    // Fallback form
    const fallbackForm = this.chatContainer.querySelector('.fallback-form');
    const fallbackCancel = this.chatContainer.querySelector('.fallback-cancel');

    if (fallbackForm) {
      fallbackForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = this.chatContainer.querySelector('.fallback-name').value.trim();
        const email = this.chatContainer.querySelector('.fallback-email').value.trim();
        
        // Clear previous validation errors
        this.clearFormValidationErrors();
        
        // Validate form data
        const validation = this.validateFallbackForm(name, email);
        
        if (!validation.isValid) {
          // Show validation errors
          validation.errors.forEach(error => {
            this.showFormValidationError(error.field, error.message);
          });
          return;
        }

        // Call the fallback submit handler if provided
        if (this.onFallbackSubmit) {
          this.onFallbackSubmit(name, email);
        } else {
          // Fallback to simple email generation
          this.generateEmailLink(name, email);
        }
      });
    }

    if (fallbackCancel) {
      fallbackCancel.addEventListener('click', () => {
        this.hideFallbackForm();
        this.showChatInterface();
      });
    }
  }

  /**
   * Show loading state with progress indicator
   */
  showLoadingState(message = "Wait, I'm loading as fast as I can!") {
    this.hideAllStates();
    this.show();

    this.loadingContainer.classList.remove('hidden');

    const loadingMessage = this.loadingContainer.querySelector('.loading-message');
    loadingMessage.textContent = message;

    // Animate progress bar
    const progressBar = this.loadingContainer.querySelector('.progress-bar');
    progressBar.style.width = '0%';

    // Simulate loading progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      progressBar.style.width = `${progress}%`;
    }, 200);
  }

  /**
   * Show conversation style selection interface
   */
  showStyleSelection() {
    this.hideAllStates();
    this.styleSelection.classList.remove('hidden');

    // Focus on first style option for accessibility
    const firstOption = this.styleSelection.querySelector('.style-option');
    if (firstOption) {
      firstOption.focus();
    }
  }

  /**
   * Show the main chat interface
   */
  showChatInterface() {
    this.hideAllStates();
    this.chatContainer.querySelector('.chat-messages').classList.remove('hidden');
    this.inputContainer.classList.remove('hidden');

    // Focus on input
    const messageInput = this.chatContainer.querySelector('.message-input');
    messageInput.focus();
  }

  /**
   * Add a message to the chat
   */
  addMessage(message, isUser = false, style = null) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageElement.innerHTML = `
      <div class="message-content">
        <div class="message-text">${this.escapeHtml(message)}</div>
        <div class="message-time">${timestamp}</div>
      </div>
      ${!isUser ? `<div class="message-avatar">${this.getAvatarForStyle(style)}</div>` : ''}
    `;

    this.messagesContainer.appendChild(messageElement);
    this.scrollToBottom();

    // Store last user message for fallback handling
    if (isUser) {
      this.lastUserMessage = message;
    }
  }

  /**
   * Show typing indicator
   */
  showTypingIndicator() {
    this.typingIndicator.classList.remove('hidden');
    this.scrollToBottom();
  }

  /**
   * Hide typing indicator
   */
  hideTypingIndicator() {
    this.typingIndicator.classList.add('hidden');
  }

  /**
   * Show error message
   */
  showError(message) {
    this.hideAllStates();
    const errorContainer = this.chatContainer.querySelector('.chat-error');
    const errorMessage = errorContainer.querySelector('.error-message');

    errorMessage.textContent = message;
    errorContainer.classList.remove('hidden');
  }

  /**
   * Hide error message
   */
  hideError() {
    const errorContainer = this.chatContainer.querySelector('.chat-error');
    errorContainer.classList.add('hidden');
  }

  /**
   * Show fallback form for email contact
   * @param {string} message - Optional message to display above form
   */
  showFallbackForm(message = null) {
    this.hideAllStates();
    const fallbackContainer = this.chatContainer.querySelector('.chat-fallback');
    
    // Update message if provided
    if (message) {
      const fallbackMessage = fallbackContainer.querySelector('.fallback-message');
      if (fallbackMessage) {
        fallbackMessage.textContent = message;
      }
    }
    
    fallbackContainer.classList.remove('hidden');

    // Clear previous form data
    const nameInput = fallbackContainer.querySelector('.fallback-name');
    const emailInput = fallbackContainer.querySelector('.fallback-email');
    if (nameInput) nameInput.value = '';
    if (emailInput) emailInput.value = '';

    // Focus on name input
    if (nameInput) nameInput.focus();
  }

  /**
   * Hide fallback form
   */
  hideFallbackForm() {
    const fallbackContainer = this.chatContainer.querySelector('.chat-fallback');
    fallbackContainer.classList.add('hidden');
  }

  /**
   * Generate mailto link with conversation context
   * @param {string} name - User's name
   * @param {string} email - User's email
   * @param {string} mailtoUrl - Pre-generated mailto URL
   * @param {string} style - Conversation style for confirmation message
   */
  generateEmailLink(name, email, mailtoUrl = null, style = 'developer') {
    if (mailtoUrl) {
      // Use provided mailto URL
      window.location.href = mailtoUrl;
    } else {
      // Fallback to simple mailto
      const subject = encodeURIComponent(`Portfolio Inquiry from ${name}`);
      const body = encodeURIComponent(`Hi Serhii,

I was chatting with your AI assistant on your portfolio website and had some questions I'd like to discuss further.

My contact information:
Name: ${name}
Email: ${email}

Looking forward to hearing from you!

Best regards,
${name}`);

      const mailtoLink = `mailto:serhii@example.com?subject=${subject}&body=${body}`;
      window.location.href = mailtoLink;
    }

    // Show style-appropriate confirmation message
    const confirmationMessages = {
      hr: "Perfect! I've opened your email client with a professional message template. Please feel free to add any additional details you'd like to discuss.",
      developer: "Great! I've opened your email client with a pre-filled message. Feel free to add any specific questions you had!",
      friend: "Awesome! 🎉 I've set up an email for you! Just add whatever else you want to chat about and hit send! 😊"
    };

    const confirmationMessage = confirmationMessages[style] || confirmationMessages.developer;
    this.addMessage(confirmationMessage, false, style);
    this.hideFallbackForm();
    this.showChatInterface();
  }

  /**
   * Clear all messages from chat
   */
  clearMessages() {
    this.messagesContainer.innerHTML = '';
    this.lastUserMessage = null;
  }

  /**
   * Get the last user message for fallback handling
   */
  getLastUserMessage() {
    return this.lastUserMessage || '';
  }

  /**
   * Show the chat container
   */
  show() {
    this.chatContainer.classList.add('visible');
  }

  /**
   * Hide the chat container
   */
  hide() {
    this.chatContainer.classList.remove('visible');
  }

  /**
   * Destroy the chat UI and clean up
   */
  destroy() {
    // Hide the chat container and reset state
    this.hide();
    this.clearMessages();
    this.hideAllStates();
    this.isInitialized = false;
  }

  /**
   * Hide all state containers
   */
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
  }

  /**
   * Scroll messages container to bottom
   */
  scrollToBottom() {
    setTimeout(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }, 100);
  }

  /**
   * Get avatar emoji for conversation style
   */
  getAvatarForStyle(style) {
    const avatars = {
      hr: '👔',
      developer: '💻',
      friend: '😊'
    };
    return avatars[style] || '🤖';
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show form validation error
   * @param {string} field - Field name ('name' or 'email')
   * @param {string} message - Error message
   */
  showFormValidationError(field, message) {
    const fallbackContainer = this.chatContainer.querySelector('.chat-fallback');
    const errorElement = fallbackContainer.querySelector(`.${field}-error`);
    
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove('hidden');
    }

    // Highlight the invalid field
    const input = fallbackContainer.querySelector(`.fallback-${field}`);
    if (input) {
      input.classList.add('error');
      input.focus();
    }
  }

  /**
   * Clear form validation errors
   */
  clearFormValidationErrors() {
    const fallbackContainer = this.chatContainer.querySelector('.chat-fallback');
    const errorElements = fallbackContainer.querySelectorAll('.validation-error');
    const inputElements = fallbackContainer.querySelectorAll('.fallback-name, .fallback-email');

    errorElements.forEach(element => {
      element.classList.add('hidden');
      element.textContent = '';
    });

    inputElements.forEach(element => {
      element.classList.remove('error');
    });
  }

  /**
   * Validate fallback form data
   * @param {string} name - User's name
   * @param {string} email - User's email
   * @returns {Object} Validation result with success status and errors
   */
  validateFallbackForm(name, email) {
    const errors = [];

    // Validate name
    if (!name || name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Please enter your name (at least 2 characters)' });
    } else if (name.trim().length > 50) {
      errors.push({ field: 'name', message: 'Name must be less than 50 characters' });
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      errors.push({ field: 'email', message: 'Please enter a valid email address' });
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Set event handlers
   */
  setEventHandlers({ onStyleSelect, onMessageSend, onRestart, onFallbackSubmit, onRetry }) {
    this.onStyleSelect = onStyleSelect;
    this.onMessageSend = onMessageSend;
    this.onRestart = onRestart;
    this.onFallbackSubmit = onFallbackSubmit;
    this.onRetry = onRetry;
  }
}

export default ChatUI;
