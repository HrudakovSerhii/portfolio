const SELECTORS = {
  promptButton: '.prompt-button'
};

class ActionPromptManager {
  constructor(templateBuilder, sectionOrder) {
    this.templateBuilder = templateBuilder;
    this.sectionOrder = sectionOrder;
    this.element = null;
    this.onActionClick = null;
  }

  initialize(container, onActionClick) {
    this.onActionClick = onActionClick;
    this.element = this.templateBuilder.renderActionPrompt('placeholder', '');
    this.element.style.display = 'none';
    container.appendChild(this.element);
  }

  update(currentSectionId, revealedSections) {
    const nextSectionId = this.getNextSectionId(currentSectionId);
    const isLastRevealed = this._isLastRevealedSection(currentSectionId, revealedSections);

    if (nextSectionId && isLastRevealed) {
      this.show(nextSectionId);
    } else {
      this.hide();
    }
  }

  async show(nextSectionId) {
    if (!this.element) {
      return;
    }

    try {
      const button = this.element.querySelector(SELECTORS.promptButton);

      if (button) {
        const sectionName = nextSectionId.charAt(0).toUpperCase() + nextSectionId.slice(1);
        const buttonText = `Read next: ${sectionName}`;
        button.textContent = buttonText;
        button.setAttribute('data-default-text', buttonText);
        button.setAttribute('data-section-id', nextSectionId);
      }

      this.element.setAttribute('data-section-id', nextSectionId);
      this.element.id = `action-prompt-${nextSectionId}`;

      this._setupClickHandler(nextSectionId);

      this.element.style.display = 'flex';

      requestAnimationFrame(() => {
        this.element.classList.add('action-prompt--visible');
      });
    } catch (error) {
      console.error('Failed to show action prompt:', error);
    }
  }

  hide() {
    if (!this.element) {
      return;
    }

    this.element.classList.remove('action-prompt--visible');
    this.element.style.display = 'none';
  }

  getNextSectionId(currentSectionId) {
    const currentIndex = this.sectionOrder.indexOf(currentSectionId);
    return this.sectionOrder[currentIndex + 1] || null;
  }

  _isLastRevealedSection(sectionId, revealedSections) {
    const lastRevealedId = revealedSections[revealedSections.length - 1];
    return lastRevealedId === sectionId;
  }

  _setupClickHandler(nextSectionId) {
    const button = this.element.querySelector(SELECTORS.promptButton);

    if (!button || !this.onActionClick) {
      return;
    }

    // Remove old listeners by cloning the button
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);

    newButton.addEventListener('click', async () => {
      this.hide();
      await this.onActionClick(nextSectionId);
    });
  }
}

export default ActionPromptManager;
