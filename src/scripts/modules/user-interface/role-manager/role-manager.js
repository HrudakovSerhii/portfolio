const MODAL_FADE_DURATION = 300;
const MODAL_FOCUS_DELAY = 100;

const MODAL_ELEMENTS = {
  overlay: 'modal-overlay',
  content: 'modal-content',
  close: 'modal-close',
  roleCard: 'button'
};

const SECTION_ATTRIBUTES = {
  role: 'data-role',
  escapeHandler: 'data-escape-handler'
};

const CSS_CLASSES = {
  active: 'active'
};

class RoleManager {
  constructor(stateManager, templateBuilder) {
    this.stateManager = stateManager;
    this.templateBuilder = templateBuilder;
    this.onRoleSelectCallback = null;
  }

  onRoleSelect(callback) {
    this.onRoleSelectCallback = callback;
  }

  async selectRole(role) {
    if (!role) {
      return;
    }

    const currentRole = this.getCurrentRole();
    const isRoleChange = currentRole && currentRole !== role;

    if (this.onRoleSelectCallback) {
      await this.onRoleSelectCallback(role, !!isRoleChange);
    }
  }

  showChangeModal() {
    const currentRole = this.getCurrentRole();

    if (!currentRole) {
      console.warn('No role selected yet. Cannot show role change modal.');
      return;
    }

    const existingModal = document.querySelector(`.${MODAL_ELEMENTS.overlay}`);
    if (existingModal) {
      return;
    }

    const modal = this._renderModal(currentRole);
    this._setupModalInteractions(modal, currentRole);
  }

  getCurrentRole() {
    return this.stateManager.getRole();
  }

  hasRole() {
    return this.getCurrentRole() !== null;
  }

  _renderModal(currentRole) {
    const modal = this.templateBuilder.renderRoleChangeModal(currentRole);
    document.body.appendChild(modal);

    requestAnimationFrame(() => {
      modal.classList.add(CSS_CLASSES.active);
    });

    const modalContent = modal.querySelector(`.${MODAL_ELEMENTS.content}`);
    setTimeout(() => {
      modalContent?.focus();
    }, MODAL_FOCUS_DELAY);

    return modal;
  }

  _setupModalInteractions(modal, currentRole) {
    this._setupRoleButtons(modal, currentRole);
    this._setupCloseButton(modal);
    this._setupOutsideClick(modal);
    this._setupEscapeKey(modal);
  }

  _setupRoleButtons(modal, currentRole) {
    const roleCards = modal.querySelectorAll(`.${MODAL_ELEMENTS.roleCard}:not([disabled])`);

    roleCards.forEach(card => {
      card.addEventListener('click', async () => {
        const newRole = card.getAttribute(SECTION_ATTRIBUTES.role);

        if (newRole && newRole !== currentRole) {
          this._closeModal(modal);
          await this.selectRole(newRole);
        }
      });
    });
  }

  _setupCloseButton(modal) {
    const closeButton = modal.querySelector(`.${MODAL_ELEMENTS.close}`);

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
    modal.setAttribute(SECTION_ATTRIBUTES.escapeHandler, 'attached');
  }

  _closeModal(modal) {
    if (!modal) return;

    modal.style.opacity = '0';
    setTimeout(() => {
      modal.remove();
    }, MODAL_FADE_DURATION);
  }
}

export default RoleManager;
