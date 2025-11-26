const MODAL_FADE_DURATION = 300;
const MODAL_FOCUS_DELAY = 100;

class HeaderController {
  constructor(stateManager, templateBuilder) {
    this.stateManager = stateManager;
    this.templateBuilder = templateBuilder;
    
    this.ownerName = null;
    this.languageSelector = null;
    this.changeRoleButton = null;
  }

  initialize(ownerNameElement, languageSelectorElement, changeRoleButtonElement) {
    this.ownerName = ownerNameElement;
    this.languageSelector = languageSelectorElement;
    this.changeRoleButton = changeRoleButtonElement;

    if (this.languageSelector) {
      const currentLanguage = this.stateManager.getLanguage();
      if (currentLanguage) {
        this.languageSelector.value = currentLanguage;
      }
    }
  }

  updateOwnerName(name) {
    if (this.ownerName && name) {
      this.ownerName.textContent = name;
    }
  }

  updateLanguage(lang) {
    if (!lang || typeof lang !== 'string') {
      console.warn('Invalid language code provided');
      return;
    }

    const currentLanguage = this.stateManager.getLanguage();

    if (lang === currentLanguage) {
      return;
    }

    this.stateManager.setLanguage(lang);

    if (this.languageSelector) {
      this.languageSelector.value = lang;
    }
  }

  showChangeRoleButton() {
    if (this.changeRoleButton) {
      this.changeRoleButton.style.display = 'block';
    }
  }

  hideChangeRoleButton() {
    if (this.changeRoleButton) {
      this.changeRoleButton.style.display = 'none';
    }
  }

  showRoleChangeModal(onRoleSelect) {
    const currentRole = this.stateManager.getRole();
    const existingModal = document.querySelector('.modal-overlay');

    if (existingModal) {
      return;
    }

    if (!currentRole) {
      console.warn('No current role found. Cannot show role change modal.');
      return;
    }

    const modal = this._renderModal(currentRole);
    this._setupModalInteractions(modal, currentRole, onRoleSelect);
  }

  _renderModal(currentRole) {
    const modal = this.templateBuilder.renderRoleChangeModal(currentRole);
    document.body.appendChild(modal);

    requestAnimationFrame(() => {
      modal.classList.add('active');
    });

    const modalContent = modal.querySelector('.modal-content');
    setTimeout(() => {
      modalContent?.focus();
    }, MODAL_FOCUS_DELAY);

    return modal;
  }

  _setupModalInteractions(modal, currentRole, onRoleSelect) {
    this._setupRoleButtons(modal, currentRole, onRoleSelect);
    this._setupCloseButton(modal);
    this._setupOutsideClick(modal);
    this._setupEscapeKey(modal);
  }

  _setupRoleButtons(modal, currentRole, onRoleSelect) {
    const roleButtons = modal.querySelectorAll('.role-button:not([disabled])');

    roleButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const newRole = button.getAttribute('data-role');

        if (newRole && newRole !== currentRole) {
          this._closeModal(modal);

          if (onRoleSelect) {
            await onRoleSelect(newRole);
          }
        }
      });
    });
  }

  _setupCloseButton(modal) {
    const closeButton = modal.querySelector('.modal-close');
    
    closeButton?.addEventListener('click', () => {
      this._closeModal(modal);
    });
  }

  _setupOutsideClick(modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this._closeModal(modal);
      }
    });
  }

  _setupEscapeKey(modal) {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        this._closeModal(modal);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
    modal.setAttribute('data-escape-handler', 'attached');
  }

  _closeModal(modal) {
    if (!modal) return;

    modal.style.opacity = '0';
    setTimeout(() => {
      modal.remove();
    }, MODAL_FADE_DURATION);
  }
}

export default HeaderController;
