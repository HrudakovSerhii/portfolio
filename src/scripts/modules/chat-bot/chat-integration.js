/**
 * Chat Integration - Lazy loading entry point for chat-bot feature
 * This module handles the initial loading and integration with the main portfolio
 */

let chatBotInstance = null;
let isLoading = false;

/**
 * Initialize and show the chat-bot interface
 * This is the main entry point called from the portfolio
 */
async function initializeChat() {
  if (isLoading) {
    return;
  }

  if (chatBotInstance && chatBotInstance.isInitialized) {
    // Chat is already initialized, just show it
    showChatInterface();
    return;
  }

  try {
    isLoading = true;
    
    // Lazy load the ChatBot class
    const { ChatBot } = await import('./chat-bot.js');
    
    // Create and initialize chat-bot instance
    chatBotInstance = new ChatBot();
    const success = await chatBotInstance.initialize();

    if (!success) {
      throw new Error('ChatBot initialization failed');
    }

    // Setup event listeners for chat interface
    setupChatEventListeners();

  } catch (error) {
    console.error('Chat initialization error:', error);
    
    // If we have a chatBot instance with UI, use it for error display
    if (chatBotInstance && chatBotInstance.ui) {
      chatBotInstance.ui.showError(getErrorMessage(error.message));
    } else {
      // Fallback error display
      showFallbackError(error.message);
    }
  } finally {
    isLoading = false;
  }
}

/**
 * Get appropriate error message for different error types
 */
function getErrorMessage(error) {
  if (error.includes('BROWSER_UNSUPPORTED') || error.includes('WebAssembly')) {
    return "Oops, sorry, we couldn't load Serhii to your browser :(";
  } else if (error.includes('WORKER_TIMEOUT') || error.includes('network')) {
    return "Having trouble downloading my brain 🧠 Check your connection?";
  }
  return "Something went wrong. Please try again.";
}

/**
 * Fallback error display when UI is not available
 */
function showFallbackError(error) {
  const errorMessage = getErrorMessage(error);
  
  // Simple alert as fallback - in production this could be a toast notification
  alert(errorMessage);
}

/**
 * Show the chat interface
 */
function showChatInterface() {
  if (chatBotInstance && chatBotInstance.ui) {
    // Delegate to the actual UI instance
    chatBotInstance.ui.showChatInterface();
  }
}

/**
 * Close the chat overlay
 */
function closeChatOverlay() {
  if (chatBotInstance && chatBotInstance.ui && chatBotInstance.ui.closeChatOverlay) {
    // Delegate to the actual UI instance
    chatBotInstance.ui.closeChatOverlay();
  } else {
    // Fallback for cases where UI isn't available
    const overlay = document.getElementById('chat-overlay');
    if (overlay) {
      overlay.remove();
    }
  }
}

/**
 * Setup event listeners for chat interface
 */
function setupChatEventListeners() {
  // Close button
  document.addEventListener('click', (event) => {
    if (event.target.matches('.chat-close, .chat-error__close')) {
      closeChatOverlay();
    }
  });

  // Style selection buttons
  document.addEventListener('click', (event) => {
    if (event.target.matches('.chat-style-button')) {
      const style = event.target.dataset.style;
      if (chatBotInstance && style) {
        chatBotInstance.selectConversationStyle(style);
      }
    }
  });

  // Message form submission
  document.addEventListener('submit', (event) => {
    if (event.target.matches('.chat-message-form')) {
      event.preventDefault();
      handleMessageSubmit(event.target);
    }
  });

  // Restart conversation button
  document.addEventListener('click', (event) => {
    if (event.target.matches('.chat-restart-button')) {
      if (chatBotInstance) {
        chatBotInstance.restartConversation();
      }
    }
  });

  // Escape key to close
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const overlay = document.getElementById('chat-overlay');
      if (overlay) {
        closeChatOverlay();
      }
    }
  });
}

/**
 * Handle message form submission
 */
function handleMessageSubmit(form) {
  const messageInput = form.querySelector('.chat-message-input');
  const message = messageInput.value.trim();

  if (!message || !chatBotInstance) {
    return;
  }

  // Clear input
  messageInput.value = '';

  // Process message
  chatBotInstance.processMessage(message);
}

/**
 * Cleanup chat resources when page unloads
 */
function cleanupChat() {
  if (chatBotInstance) {
    chatBotInstance.destroy();
    chatBotInstance = null;
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupChat);

// Setup chat button event listener when module loads
document.addEventListener('DOMContentLoaded', () => {
  const chatButton = document.getElementById('hero-chat-trigger');
  if (chatButton) {
    chatButton.addEventListener('click', initializeChat);
  }
});

// Make functions available globally for HTML onclick handlers
window.initializeChat = initializeChat;
window.closeChatOverlay = closeChatOverlay;

export { 
  initializeChat, 
  closeChatOverlay, 
  cleanupChat 
};