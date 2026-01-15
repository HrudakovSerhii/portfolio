const SELECTORS = {
  promptButton: '.prompt-button'
};

class ActionPromptManager {
  constructor(templateBuilder, sectionOrder) {
    this.templateBuilder = templateBuilder;
    this.sectionOrder = sectionOrder;
    this.onActionClick = null;
    this.sectionPrompts = new Map();
  }

  initialize(onActionClick) {
    this.onActionClick = onActionClick;
  }

  createForSection(sectionId) {
    const promptElement = this.templateBuilder.renderActionPrompt(sectionId);
    this.sectionPrompts.set(sectionId, promptElement);
    return promptElement;
  }

  update(currentSectionId, revealedSections) {
    const nextSectionId = this.getNextSectionId(currentSectionId);
    const isLastRevealed = this._isLastRevealedSection(currentSectionId, revealedSections);
    const promptElement = this.sectionPrompts.get(currentSectionId);

    if (!promptElement) {
      return;
    }

    if (nextSectionId && isLastRevealed) {
      this.show(promptElement, nextSectionId);
    } else {
      this.hide(promptElement);
    }
  }

  show(promptElement, nextSectionId) {
    if (!promptElement) {
      return;
    }

    try {
      const button = promptElement.querySelector(SELECTORS.promptButton);

      if (button) {
        const sectionName = nextSectionId.charAt(0).toUpperCase() + nextSectionId.slice(1);
        const buttonText = `Read next: ${sectionName}`;
        button.textContent = buttonText;
        button.setAttribute('data-default-text', buttonText);
        button.setAttribute('data-section-id', nextSectionId);
      }

      promptElement.setAttribute('data-section-id', nextSectionId);

      this._setupClickHandler(promptElement, nextSectionId);

      requestAnimationFrame(() => {
        promptElement.classList.add('action-prompt--visible');
      });
    } catch (error) {
      console.error('Failed to show action prompt:', error);
    }
  }

  hide(promptElement) {
    if (!promptElement) {
      return;
    }

    promptElement.classList.remove('action-prompt--visible');
  }

  getNextSectionId(currentSectionId) {
    const currentIndex = this.sectionOrder.indexOf(currentSectionId);
    return this.sectionOrder[currentIndex + 1] || null;
  }

  _isLastRevealedSection(sectionId, revealedSections) {
    const lastRevealedId = revealedSections[revealedSections.length - 1];
    return lastRevealedId === sectionId;
  }

  _setupClickHandler(promptElement, nextSectionId) {
    const button = promptElement.querySelector(SELECTORS.promptButton);

    if (!button || !this.onActionClick) {
      return;
    }

    // Remove old listeners by cloning the button
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);

    newButton.addEventListener('click', async () => {
      this.hide(promptElement);
      await this.onActionClick(nextSectionId);
    });
  }
}

export default ActionPromptManager;
