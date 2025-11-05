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
    // Show the chat container
    chatBotInstance.ui.show();
  }
}

/**
 * Close the chat overlay
 */
function closeChatOverlay() {
  if (chatBotInstance && chatBotInstance.ui) {
    // Hide the chat container
    chatBotInstance.ui.hide();
  }
}

/**
 * Setup event listeners for chat interface
 */
function setupChatEventListeners() {
  // Escape key to close
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const chatContainer = document.getElementById('chat-container');
      if (chatContainer && chatContainer.classList.contains('visible')) {
        closeChatOverlay();
      }
    }
  });
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