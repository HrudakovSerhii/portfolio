/**
 * Chat Section Renderer
 * Handles rendering of chat-based portfolio sections using templates
 * Filters content by user role and applies progressive animations
 */

import AnimationObserver from '../../../utils/animation-observer.js';

class ChatSectionRenderer {
  constructor(templateBuilder, stateManager) {
    this.templateBuilder = templateBuilder;
    this.stateManager = stateManager;
    this.animationObserver = null;
  }

  /**
   * Initializes animation observer for chat messages
   * @param {HTMLElement} container - Container element to observe
   */
  initAnimations(container) {
    if (this.animationObserver) {
      this.animationObserver.disconnect();
    }

    this.animationObserver = new AnimationObserver({
      container: container,
      selector: '.chat-message',
      staggerDelay: 150,
      triggerOnce: true
    });
  }

  /**
   * Renders chat messages in a container
   * @param {HTMLElement} container - Container to render messages into
   * @param {Array} messages - Array of message objects
   * @param {string} role - Current user role
   */
  renderMessages(container, messages, role) {
    // Clear existing content
    container.innerHTML = '';

    // Filter messages by role
    const roleMessages = this._filterMessagesByRole(messages, role);

    // Add time divider
    const dividerFragment = this.templateBuilder.renderChatDivider(
      this._getCurrentTimeString()
    );
    container.appendChild(dividerFragment);

    // Render each message with delay index
    roleMessages.forEach((message, index) => {
      const messageFragment = this.templateBuilder.renderChatMessage(message);
      const messageElement = messageFragment.querySelector('.chat-message');

      // Set animation delay based on index
      if (messageElement) {
        messageElement.dataset.animationDelay = index * 150;
      }

      container.appendChild(messageFragment);

      // If message has attachment, add it inside the bubble
      if (message.attachment) {
        const bubble = messageElement?.querySelector('.chat-message__bubble');
        if (bubble) {
          this._addAttachment(bubble, message.attachment);
        }
      }
    });

    // Initialize animations after rendering
    this.initAnimations(container.parentElement || container);
  }

  /**
   * Filters messages based on user role
   * @param {Array} messages - All available messages
   * @param {string} role - Current user role
   * @returns {Array} Filtered messages
   * @private
   */
  _filterMessagesByRole(messages, role) {
    return messages.filter(msg => {
      // If message has no role restriction, show to all
      if (!msg.roles || msg.roles.length === 0) {
        return true;
      }
      // Otherwise, only show if role matches
      return msg.roles.includes(role);
    });
  }

  /**
   * Adds attachment content to message bubble
   * @param {HTMLElement} bubble - Message bubble element
   * @param {Object} attachment - Attachment data
   * @private
   */
  _addAttachment(bubble, attachment) {
    let attachmentFragment;

    switch (attachment.type) {
      case 'experience':
        attachmentFragment = this.templateBuilder.renderChatExperienceItem(attachment.data);
        break;
      case 'project':
        attachmentFragment = this.templateBuilder.renderChatProjectCard(attachment.data);
        break;
      case 'skills':
        attachmentFragment = this.templateBuilder.renderChatSkillGroup(attachment.data);
        break;
      default:
        return;
    }

    if (attachmentFragment) {
      bubble.appendChild(attachmentFragment);
    }
  }

  /**
   * Renders action buttons for a section
   * @param {HTMLElement} container - Container to add buttons to
   * @param {Array} buttons - Button configuration objects
   */
  renderActionButtons(container, buttons) {
    const actionsFragment = this.templateBuilder.renderChatActionButtons(buttons);
    container.appendChild(actionsFragment);
  }

  /**
   * Gets current time as formatted string
   * @returns {string} Formatted time string
   * @private
   */
  _getCurrentTimeString() {
    const now = new Date();
    const options = {
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit'
    };
    // TODO: use user locale or default to eu/nl
    return now.toLocaleDateString('en-US', options);
  }

  /**
   * Cleanup method
   */
  destroy() {
    if (this.animationObserver) {
      this.animationObserver.disconnect();
      this.animationObserver = null;
    }
  }
}

export default ChatSectionRenderer;