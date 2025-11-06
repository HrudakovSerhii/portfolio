/**
 * Chat Integration - Lazy loading entry point for chatbot feature
 * This module handles the initial loading and integration with the main portfolio
 */

let chatBotInstance = null;
let isLoading = false;

/**
 * Initialize and show the chatbot interface
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

    // Show initial loading state immediately
    showInitialLoadingState();

    // Lazy load the ChatBot class
    const { ChatBot } = await import('./chat-bot.js');

    // Create and initialize chatbot instance
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
  } else if (error.includes('WORKER_ERROR')) {
    return "Having trouble starting my brain 🧠 Please try again.";
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
 * Show initial loading state before ChatBot initialization
 */
function showInitialLoadingState() {
  const chatContainer = document.getElementById('chat-container');
  if (!chatContainer) {
    console.error('Chat container not found');
    return;
  }

  // Show the chat container
  chatContainer.classList.add('visible');

  // Hide all states first
  const states = [
    '.chat-style-selection',
    '.chat-messages',
    '.chat-input',
    '.chat-error',
    '.chat-fallback'
  ];

  states.forEach(selector => {
    const element = chatContainer.querySelector(selector);
    if (element) {
      element.classList.add('hidden');
    }
  });

  // Show loading state
  const loadingContainer = chatContainer.querySelector('.chat-loading');
  if (loadingContainer) {
    loadingContainer.classList.remove('hidden');
    
    // Update loading message
    const loadingMessage = loadingContainer.querySelector('.loading-message');
    if (loadingMessage) {
      loadingMessage.textContent = "Wait, I'm loading as fast as I can!";
    }

    // Start progress animation
    const progressBar = loadingContainer.querySelector('.progress-bar');
    if (progressBar) {
      progressBar.style.width = '0%';
      
      // Animate progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress >= 90) {
          progress = 90; // Stop at 90% until actual initialization completes
          clearInterval(interval);
        }
        progressBar.style.width = `${progress}%`;
      }, 300);
      
      // Store interval for cleanup
      chatContainer._progressInterval = interval;
    }
  }
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

// Make functions available globally for HTML onclick handlers
window.initializeChat = initializeChat;
window.closeChatOverlay = closeChatOverlay;

if (document.readyState === "loading") {
  // Loading hasn't finished yet, initialize application on load complete
  document.addEventListener("DOMContentLoaded", initializeChat);
} else {
  // `DOMContentLoaded` has already fired, initialize application
  initializeChat().finally();
}

export default {
  initializeChat,
};

export { initializeChat };
