/**
 * ChatController - Bridge between AppController and ChatOrchestrator
 *
 * Responsibilities:
 * - Map portfolio roles to chat conversation styles
 * - Lazy load ChatOrchestrator and ChatUI
 * - Manage chat popup visibility (show/hide)
 * - Wire UI callbacks to orchestrator methods
 *
 * Usage:
 * const controller = new ChatController();
 * await controller.openWithRole('recruiter'); // Maps to 'hr' style
 */

import { ROLE_TO_CHAT_STYLE } from '../../constants.js';

class ChatController {
  constructor() {
    this.orchestrator = null;
    this.ui = null;
    this.isInitialized = false;
    this.currentRole = null;
    this.isInitializing = false;
  }

  /**
   * Open chat with a specific role, lazy initializing if needed
   * @param {string} role - Portfolio role ('recruiter', 'developer', 'friend')
   */
  async openWithRole(role) {
    if (!role) {
      console.warn('ChatController: No role provided');
      return;
    }

    // Map role to chat style
    const chatStyle = ROLE_TO_CHAT_STYLE[role];
    if (!chatStyle) {
      console.warn(`ChatController: Unknown role "${role}"`);
      return;
    }

    // Store current role
    this.currentRole = role;

    // Show chat container immediately
    this.show();

    // Initialize if not already done
    if (!this.isInitialized) {
      await this._initialize();
    }

    // If role changed, update conversation style
    if (this.orchestrator && this.orchestrator.currentStyle !== chatStyle) {
      try {
        // Show loading state while changing style
        if (this.ui) {
          this.ui.showLoadingState('Loading conversation...');
        }

        const result = await this.orchestrator.selectConversationStyle(chatStyle);

        if (result.success && this.ui) {
          // Clear any existing messages and show chat interface
          this.ui.clearMessages();
          this.ui.showChatInterface();

          // Display greeting message
          this.ui.addMessage(result.greeting, false, chatStyle);
        }
      } catch (error) {
        console.error('ChatController: Failed to select conversation style:', error);
        if (this.ui) {
          this.ui.showError('Failed to start conversation. Please try again.');
        }
      }
    } else if (this.ui) {
      // Already initialized with correct style, just show
      this.ui.showChatInterface();
    }
  }

  /**
   * Lazy initialize ChatOrchestrator and ChatUI
   * @private
   */
  async _initialize() {
    if (this.isInitializing) {
      return;
    }

    this.isInitializing = true;

    try {
      // Lazy load modules
      const [
        { ChatOrchestrator },
        { default: ChatUI }
      ] = await Promise.all([
        import('./chat-orchestrator.js'),
        import('./chat-ui.js')
      ]);

      // Initialize UI first to show loading state
      this.ui = new ChatUI();
      this.ui.initialize();
      this.ui.showLoadingState();

      // Create orchestrator with UI callbacks
      this.orchestrator = new ChatOrchestrator({
        onProgress: (worker, progress) => {
          if (this.ui && this.ui.updateProgress) {
            this.ui.updateProgress(worker, progress);
          }
        },
        onInitialized: (data) => {
          if (data.success && this.ui) {
            this.ui.completeProgress();
          }
        },
        onError: (errorData) => {
          console.error('ChatController: Orchestrator error:', errorData);
          if (this.ui) {
            this.ui.showError(this._getErrorMessage(errorData.error));
          }
        },
        onRoleDataLoading: () => {
          if (this.ui) {
            this.ui.showLoadingState('Loading conversation data...');
          }
        },
        onRoleDataLoaded: () => {
          if (this.ui) {
            this.ui.completeProgress();
          }
        }
      });

      // Wire up UI event handlers
      this.ui.setEventHandlers({
        onStyleSelect: (style) => this._handleStyleSelect(style),
        onMessageSend: (message) => this._handleMessageSend(message),
        onRestart: () => this._handleRestart(),
        onFallbackSubmit: (name, email) => this._handleFallbackSubmit(name, email),
        onRetry: () => this._handleRetry()
      });

      // Initialize orchestrator
      const success = await this.orchestrator.initialize();

      if (!success) {
        throw new Error('ChatOrchestrator initialization failed');
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('ChatController: Initialization failed:', error);
      if (this.ui) {
        this.ui.showError(this._getErrorMessage(error.message));
      }
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Handle style selection from UI (for backwards compatibility)
   * @private
   */
  async _handleStyleSelect(style) {
    if (!this.orchestrator) return;

    try {
      if (this.ui) {
        this.ui.showLoadingState('Loading conversation...');
      }

      const result = await this.orchestrator.selectConversationStyle(style);

      if (result.success && this.ui) {
        this.ui.clearMessages();
        this.ui.showChatInterface();
        this.ui.addMessage(result.greeting, false, style);
      }
    } catch (error) {
      console.error('ChatController: Style selection failed:', error);
      if (this.ui) {
        this.ui.showError('Failed to start conversation. Please try again.');
      }
    }
  }

  /**
   * Handle message send from UI
   * @private
   */
  async _handleMessageSend(message) {
    if (!this.orchestrator || !this.ui) return;

    try {
      // Add user message to UI
      this.ui.addMessage(message, true);
      this.ui.showTypingIndicator();

      // Process message through orchestrator
      const result = await this.orchestrator.processMessage(message);

      this.ui.hideTypingIndicator();

      if (result.success) {
        // Display bot response
        this.ui.addMessage(result.answer, false, result.style);

        // Handle fallback UI action if needed
        if (result.uiAction === 'show_email_form') {
          setTimeout(() => {
            this.ui.showFallbackForm();
          }, 1000);
        }
      } else {
        // Show error message
        this.ui.addMessage(
          'Sorry, I had trouble processing that. Could you try rephrasing?',
          false,
          this.orchestrator.currentStyle
        );
      }
    } catch (error) {
      console.error('ChatController: Message processing failed:', error);
      this.ui.hideTypingIndicator();
      this.ui.addMessage(
        'Sorry, something went wrong. Please try again.',
        false,
        this.orchestrator?.currentStyle
      );
    }
  }

  /**
   * Handle conversation restart
   * @private
   */
  _handleRestart() {
    if (!this.orchestrator) return;

    this.orchestrator.restartConversation();

    if (this.ui) {
      this.ui.clearMessages();
      // Since style selection is now done via role, show loading then re-select style
      if (this.currentRole) {
        this.openWithRole(this.currentRole);
      } else {
        // Fallback: show deprecated style selection
        this.ui.showStyleSelection();
      }
    }
  }

  /**
   * Handle fallback form submission
   * @private
   */
  _handleFallbackSubmit(name, email) {
    if (!this.orchestrator || !this.ui) return;

    const result = this.orchestrator.generateFallbackEmail(name, email);

    if (!result.success) {
      this.ui.showFormValidationError(result.field, result.message);
      return;
    }

    // Open email and show confirmation
    this.ui.generateEmailLink(result.name, result.email, result.mailtoUrl, this.orchestrator.currentStyle);
  }

  /**
   * Handle retry after error
   * @private
   */
  async _handleRetry() {
    if (!this.orchestrator) return;

    try {
      if (this.ui) {
        this.ui.showLoadingState('Retrying...');
      }

      const success = await this.orchestrator.retryInitialization();

      if (success && this.currentRole) {
        await this.openWithRole(this.currentRole);
      }
    } catch (error) {
      console.error('ChatController: Retry failed:', error);
      if (this.ui) {
        this.ui.showError('Retry failed. Please refresh the page.');
      }
    }
  }

  /**
   * Show chat popup
   */
  show() {
    if (this.ui) {
      this.ui.show();
    } else {
      // UI not initialized yet, show container directly
      const chatContainer = document.getElementById('chat-container');
      if (chatContainer) {
        chatContainer.classList.add('visible');
      }
    }
  }

  /**
   * Hide chat popup
   */
  hide() {
    if (this.ui) {
      this.ui.hide();
    } else {
      const chatContainer = document.getElementById('chat-container');
      if (chatContainer) {
        chatContainer.classList.remove('visible');
      }
    }
  }

  /**
   * Change role while chat is already open
   * @param {string} newRole - New portfolio role
   */
  async changeRole(newRole) {
    if (newRole === this.currentRole) return;

    await this.openWithRole(newRole);
  }

  /**
   * Get user-friendly error message
   * @private
   */
  _getErrorMessage(error) {
    if (error?.includes('BROWSER_UNSUPPORTED') || error?.includes('WebAssembly')) {
      return "Sorry, your browser doesn't support the chat feature.";
    }
    if (error?.includes('WORKER_TIMEOUT') || error?.includes('network')) {
      return "Having trouble connecting. Please check your internet connection.";
    }
    if (error?.includes('WORKER_ERROR')) {
      return "Something went wrong loading the chat. Please try again.";
    }
    return "Something went wrong. Please try again.";
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.orchestrator) {
      this.orchestrator.destroy();
      this.orchestrator = null;
    }

    if (this.ui) {
      this.ui.destroy();
      this.ui = null;
    }

    this.isInitialized = false;
    this.currentRole = null;
  }
}

export default ChatController;
