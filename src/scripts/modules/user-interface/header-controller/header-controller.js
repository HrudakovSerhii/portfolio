const MODAL_FADE_DURATION = 300;
const MODAL_FOCUS_DELAY = 100;

const HEADER_ELEMENTS = {
  nav: 'header-nav',
  navItem: 'header-nav-item',
  roleBadge: 'header-role-badge',
  roleText: 'header-role-text',
  navToggle: 'header-nav-toggle'
};

const MODAL_ELEMENTS = {
  overlay: 'modal-overlay',
  content: 'modal-content',
  close: 'modal-close',
  roleCard: 'button'
};

const SECTION_ATTRIBUTES = {
  sectionId: 'data-section-id',
  role: 'data-role',
  escapeHandler: 'data-escape-handler'
};

const CSS_CLASSES = {
  active: 'active'
};

class HeaderController {
  constructor(stateManager, templateBuilder) {
    this.stateManager = stateManager;
    this.templateBuilder = templateBuilder;

    this.ownerName = null;
    this.languageSelector = null;
    this.headerNav = null;
    this.roleBadge = null;
    this.roleBadgeText = null;
    this.onRoleSelectCallback = null;

    this.visibleSections = [];
    this.activeSection = null;
    this.intersectionObserver = null;
  }

  initialize(ownerNameElement, languageSelectorElement) {
    this.ownerName = ownerNameElement;
    this.languageSelector = languageSelectorElement;
    this.headerNav = document.getElementById(HEADER_ELEMENTS.nav);
    this.roleBadge = document.getElementById(HEADER_ELEMENTS.roleBadge);
    this.roleBadgeText = document.getElementById(HEADER_ELEMENTS.roleText);
    this.navToggle = document.getElementById(HEADER_ELEMENTS.navToggle);

    if (this.languageSelector) {
      const currentLanguage = this.stateManager.getLanguage();
      if (currentLanguage) {
        this.languageSelector.value = currentLanguage;
      }
    }

    this._setupIntersectionObserver();
    this._setupRoleBadgeClick();
    this._setupMobileToggle();
  }

  _setupRoleBadgeClick() {
    if (this.roleBadge) {
      this.roleBadge.addEventListener('click', () => {
        if (this.onRoleSelectCallback) {
          this.showRoleChangeModal(this.onRoleSelectCallback);
        }
      });
    }
  }

  _setupMobileToggle() {
    if (!this.navToggle || !this.headerNav) return;

    this.navToggle.addEventListener('click', () => {
      const isOpen = this.headerNav.classList.toggle('is-open');
      this.navToggle.setAttribute('aria-expanded', isOpen.toString());
    });

    // Close nav when clicking a nav item on mobile
    this.headerNav.addEventListener('click', (e) => {
      if (e.target.classList.contains(HEADER_ELEMENTS.navItem)) {
        this.headerNav.classList.remove('is-open');
        this.navToggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Close nav when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.headerNav.contains(e.target) && !this.navToggle.contains(e.target)) {
        this.headerNav.classList.remove('is-open');
        this.navToggle.setAttribute('aria-expanded', 'false');
      }
    });
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

  updateRoleBadge(role, onRoleSelect = null) {
    if (!this.roleBadge || !this.roleBadgeText) return;

    if (role) {
      const roleText = role.charAt(0).toUpperCase() + role.slice(1);
      this.roleBadgeText.textContent = `${roleText} View`;
      this.roleBadge.style.display = 'flex';

      if (onRoleSelect) {
        this.onRoleSelectCallback = onRoleSelect;
      }
    } else {
      this.roleBadge.style.display = 'none';
      this.onRoleSelectCallback = null;
    }
  }

  addNavigationItem(sectionId, sectionTitle) {
    if (!this.headerNav) return;

    if (this.visibleSections.includes(sectionId)) {
      return;
    }

    this.visibleSections.push(sectionId);

    const navLink = document.createElement('a');
    navLink.className = HEADER_ELEMENTS.navItem;
    navLink.setAttribute(SECTION_ATTRIBUTES.sectionId, sectionId);
    navLink.setAttribute('href', `#section-${sectionId}`);
    navLink.textContent = sectionTitle || sectionId.charAt(0).toUpperCase() + sectionId.slice(1);

    this.headerNav.appendChild(navLink);

    // Observe the section for intersection
    const section = document.querySelector(`[${SECTION_ATTRIBUTES.sectionId}="${sectionId}"]`);
    if (section && this.intersectionObserver) {
      this.intersectionObserver.observe(section);
    }
  }

  setActiveSection(sectionId) {
    if (!this.headerNav) return;

    this.activeSection = sectionId;

    const navItems = this.headerNav.querySelectorAll(`.${HEADER_ELEMENTS.navItem}`);
    navItems.forEach(item => {
      const itemSectionId = item.getAttribute(SECTION_ATTRIBUTES.sectionId);
      if (itemSectionId === sectionId) {
        item.classList.add(CSS_CLASSES.active);
      } else {
        item.classList.remove(CSS_CLASSES.active);
      }
    });
  }

  clearNavigation() {
    if (!this.headerNav) return;

    // Disconnect observer from all sections
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    this.headerNav.innerHTML = '';
    this.visibleSections = [];
    this.activeSection = null;
  }

  /**
   * Sets up Intersection Observer to detect which section is currently in view.
   * More performant than scroll event listeners and automatically handles viewport changes.
   */
  _setupIntersectionObserver() {
    const options = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute(SECTION_ATTRIBUTES.sectionId);
          if (sectionId && sectionId !== this.activeSection) {
            this.setActiveSection(sectionId);
          }
        }
      });
    }, options);
  }

  showRoleChangeModal(onRoleSelect) {
    const currentRole = this.stateManager.getRole();
    const existingModal = document.querySelector(`.${MODAL_ELEMENTS.overlay}`);

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
      modal.classList.add(CSS_CLASSES.active);
    });

    const modalContent = modal.querySelector(`.${MODAL_ELEMENTS.content}`);
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
    const roleCards = modal.querySelectorAll(`.${MODAL_ELEMENTS.roleCard}:not([disabled])`);

    roleCards.forEach(card => {
      card.addEventListener('click', async () => {
        const newRole = card.getAttribute(SECTION_ATTRIBUTES.role);

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

export default HeaderController;
