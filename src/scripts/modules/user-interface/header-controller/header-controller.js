const MODAL_FADE_DURATION = 300;
const MODAL_FOCUS_DELAY = 100;

class HeaderController {
  constructor(stateManager, templateBuilder) {
    this.stateManager = stateManager;
    this.templateBuilder = templateBuilder;
    
    this.ownerName = null;
    this.languageSelector = null;
    this.changeRoleButton = null;
    this.headerNav = null;
    this.roleBadge = null;
    this.roleBadgeText = null;
    
    this.visibleSections = [];
    this.activeSection = null;
  }

  initialize(ownerNameElement, languageSelectorElement, changeRoleButtonElement) {
    this.ownerName = ownerNameElement;
    this.languageSelector = languageSelectorElement;
    this.changeRoleButton = changeRoleButtonElement;
    this.headerNav = document.getElementById('header-nav');
    this.roleBadge = document.getElementById('header-role-badge');
    this.roleBadgeText = document.getElementById('header-role-text');

    if (this.languageSelector) {
      const currentLanguage = this.stateManager.getLanguage();
      if (currentLanguage) {
        this.languageSelector.value = currentLanguage;
      }
    }

    this._setupScrollDetection();
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
      this.changeRoleButton.style.display = 'flex';
    }
  }

  hideChangeRoleButton() {
    if (this.changeRoleButton) {
      this.changeRoleButton.style.display = 'none';
    }
  }

  updateRoleBadge(role) {
    if (!this.roleBadge || !this.roleBadgeText) return;

    if (role) {
      const roleText = role.charAt(0).toUpperCase() + role.slice(1);
      this.roleBadgeText.textContent = `${roleText} View`;
      this.roleBadge.style.display = 'flex';
    } else {
      this.roleBadge.style.display = 'none';
    }
  }

  addNavigationItem(sectionId, sectionTitle) {
    if (!this.headerNav) return;

    if (this.visibleSections.includes(sectionId)) {
      return;
    }

    this.visibleSections.push(sectionId);

    const navButton = this._createNavigationButton(sectionId, sectionTitle);
    this.headerNav.appendChild(navButton);

    this._checkNavOverflow();
  }

  _createNavigationButton(sectionId, sectionTitle) {
    const navLink = document.createElement('a');
    navLink.className = 'header-nav-item';
    navLink.setAttribute('data-section-id', sectionId);
    navLink.setAttribute('href', `#${sectionId}`);
    navLink.textContent = sectionTitle || sectionId.charAt(0).toUpperCase() + sectionId.slice(1);

    return navLink;
  }

  setActiveSection(sectionId) {
    if (!this.headerNav) return;

    this.activeSection = sectionId;

    const navItems = this.headerNav.querySelectorAll('.header-nav-item');
    navItems.forEach(item => {
      const itemSectionId = item.getAttribute('data-section-id');
      if (itemSectionId === sectionId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  clearNavigation() {
    if (!this.headerNav) return;
    
    this.headerNav.innerHTML = '';
    this.visibleSections = [];
    this.activeSection = null;
  }

  /**
   * Monitors scroll position to automatically highlight the active section in navigation.
   * Uses requestAnimationFrame for performance optimization to avoid excessive reflows.
   * Updates the active nav item based on which section is currently in the viewport.
   */
  _setupScrollDetection() {
    let ticking = false;

    const updateActiveSection = () => {
      if (!this.headerNav) return;

      const scrollPosition = window.scrollY + 100;
      const sections = document.querySelectorAll('.portfolio-section');

      let currentSection = null;

      sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionBottom = sectionTop + section.offsetHeight;

        if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
          currentSection = section.id;
        }
      });

      if (currentSection && currentSection !== this.activeSection) {
        this.setActiveSection(currentSection);
      }

      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateActiveSection);
        ticking = true;
      }
    });
  }

  /**
   * Checks if navigation items overflow the container width and applies a gradient mask.
   * The mask provides a visual indicator that more items are available via horizontal scroll.
   * Called after each new navigation item is added to maintain proper overflow state.
   */
  _checkNavOverflow() {
    if (!this.headerNav) return;

    const hasOverflow = this.headerNav.scrollWidth > this.headerNav.clientWidth;
    
    if (hasOverflow) {
      this.headerNav.classList.add('has-overflow');
    } else {
      this.headerNav.classList.remove('has-overflow');
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
