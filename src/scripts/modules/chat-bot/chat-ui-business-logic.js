/**
 * ChatUI Business Logic - Pure business logic without DOM dependencies
 * This class handles the chat state, message management, and event coordination
 * It uses a DOMConnector for all DOM interactions, making it easily testable
 */
export class ChatUIBusinessLogic {
  constructor(domConnector) {
    this.domConnector = domConnector;
    this.isInitialized = false;
    this.currentState = 'hidden';
    this.messages = [];
    this.eventHandlers = {};
  }

  initialize() {
    if (this.isInitialized) return;
    
    this.domConnector.initialize();
    this.setupEventHandlers();
    this.isInitialized = true;
  }

  setupEventHandlers() {
    this.domConnector.onStyleSelect = (style) => {
      if (this.eventHandlers.onStyleSelect) {
        this.eventHandlers.onStyleSelect(style);
      }
    };

    this.domConnector.onMessageSend = (message) => {
      if (this.eventHandlers.onMessageSend) {
        this.eventHandlers.onMessageSend(message);
      }
    };

    this.domConnector.onRestart = () => {
      if (this.eventHandlers.onRestart) {
        this.eventHandlers.onRestart();
      }
    };
  }

  setEventHandlers(handlers) {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  show() {
    this.currentState = 'visible';
    this.domConnector.show();
  }

  hide() {
    this.currentState = 'hidden';
    this.domConnector.hide();
  }

  showLoadingState(message) {
    this.currentState = 'loading';
    this.domConnector.showLoadingState(message);
  }

  showStyleSelection() {
    this.currentState = 'style-selection';
    this.domConnector.showStyleSelection();
  }

  showChatInterface() {
    this.currentState = 'chat';
    this.domConnector.showChatInterface();
  }

  showError(message) {
    this.currentState = 'error';
    this.domConnector.showError(message);
  }

  addMessage(message, isUser = false, style = null) {
    const messageObj = {
      text: message,
      isUser,
      style,
      timestamp: new Date().toISOString()
    };
    
    this.messages.push(messageObj);
    this.domConnector.addMessage(message, isUser, style);
  }

  clearMessages() {
    this.messages = [];
    this.domConnector.clearMessages();
  }

  showTypingIndicator() {
    this.domConnector.showTypingIndicator();
  }

  hideTypingIndicator() {
    this.domConnector.hideTypingIndicator();
  }

  getCurrentState() {
    return this.currentState;
  }

  getMessages() {
    return [...this.messages];
  }

  destroy() {
    this.clearMessages();
    this.hide();
    this.domConnector.destroy();
    this.isInitialized = false;
    this.currentState = 'destroyed';
  }
}

export default ChatUIBusinessLogic;