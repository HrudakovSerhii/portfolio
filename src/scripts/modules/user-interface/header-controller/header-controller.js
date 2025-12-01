const MODAL_FADE_DURATION = 300;
const MODAL_FOCUS_DELAY = 100;

const HEADER_ELEMENTS = {
  nav: 'header-nav',
  navMobile: 'header-nav-mobile',
  navDropdownToggle: 'header-nav-dropdown-toggle',
  navDropdownLabel: 'header-nav-dropdown-label',
  navDropdownMenu: 'header-nav-dropdown-menu',
  roleBadge: 'header-role-badge',
  roleText: 'header-role-text',
  navItem: 'header-nav-item',
  divider: 'header-divider'
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
  active: 'active',
  hasOverflow: 'has-overflow',
  isOpen: 'is-open'
};

class HeaderController {
  constructor(stateManager, templateBuilder) {
    this.stateManager = stateManager;
    this.templateBuilder = templateBuilder;

    this.ownerName = null;
    this.languageSelector = null;
    this.headerNav = null;
    this.headerNavMobile = null;
    this.navDropdownToggle = null;
    this.navDropdownLabel = null;
    this.navDropdownMenu = null;
    this.roleBadge = null;
    this.roleBadgeText = null;
    this.onRoleSelectCallback = null;

    this.visibleSections = [];
    this.activeSection = null;
    this.isDropdownOpen = false;
  }

  initialize(ownerNameElement, languageSelectorElement) {
    this.ownerName = ownerNameElement;
    this.languageSelector = languageSelectorElement;
    this.headerNav = document.getElementById(HEADER_ELEMENTS.nav);
    this.headerNavMobile = document.getElementById(HEADER_ELEMENTS.navMobile);
    this.navDropdownToggle = document.getElementById(HEADER_ELEMENTS.navDropdownToggle);
    this.navDropdownLabel = document.getElementById(HEADER_ELEMENTS.navDropdownLabel);
    this.navDropdownMenu = document.getElementById(HEADER_ELEMENTS.navDropdownMenu);
    this.roleBadge = document.getElementById(HEADER_ELEMENTS.roleBadge);
    this.roleBadgeText = document.getElementById(HEADER_ELEMENTS.roleText);

    if (this.languageSelector) {
      const currentLanguage = this.stateManager.getLanguage();
      if (currentLanguage) {
        this.languageSelector.value = currentLanguage;
      }
    }

    this._setupScrollDetection();
    this._setupRoleBadgeClick();
    this._setupMobileDropdown();
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

    const navDivider = this._createNavigationDivider();
    this.headerNav.appendChild(navDivider);

    const navButton = this._createNavigationButton(sectionId, sectionTitle);
    this.headerNav.appendChild(navButton);

    // Add to mobile dropdown
    this._addMobileDropdownItem(sectionId, sectionTitle);

    this._checkNavOverflow();
    this._checkIfSectionIsActive(sectionId);
  }

  _createNavigationDivider() {
    const navDivider = document.createElement('div');

    navDivider.className = HEADER_ELEMENTS.divider;

    return navDivider;
  }

  _createNavigationButton(sectionId, sectionTitle) {
    const navLink = document.createElement('a');
    navLink.className = HEADER_ELEMENTS.navItem;
    navLink.setAttribute(SECTION_ATTRIBUTES.sectionId, sectionId);
    navLink.setAttribute('href', `#section-${sectionId}`);
    navLink.textContent = sectionTitle || sectionId.charAt(0).toUpperCase() + sectionId.slice(1);

    return navLink;
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

    this.headerNav.innerHTML = '';
    
    if (this.navDropdownMenu) {
      this.navDropdownMenu.innerHTML = '';
    }
    
    this.visibleSections = [];
    this.activeSection = null;
  }

  _checkIfSectionIsActive(sectionId) {
    const scrollPosition = window.scrollY + 150;

    const section = document.querySelector(`[${SECTION_ATTRIBUTES.sectionId}="${sectionId}"]`);
    if (section) {
      const sectionTop = section.offsetTop;
      const sectionBottom = sectionTop + section.offsetHeight;

      if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
        this.setActiveSection(sectionId);
      }
    }
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

      const scrollPosition = window.scrollY + 150;
      let currentSection = null;

      const contentSections = document.querySelectorAll('.content-section');
      contentSections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionBottom = sectionTop + section.offsetHeight;

        if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
          const sectionId = section.getAttribute(SECTION_ATTRIBUTES.sectionId);
          if (sectionId) {
            currentSection = sectionId;
          }
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

    updateActiveSection();
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
      this.headerNav.classList.add(CSS_CLASSES.hasOverflow);
    } else {
      this.headerNav.classList.remove(CSS_CLASSES.hasOverflow);
    }
  }

  _setupMobileDropdown() {
    if (!this.navDropdownToggle || !this.navDropdownMenu) return;

    this.navDropdownToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleDropdown();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isDropdownOpen && 
          !this.headerNavMobile?.contains(e.target)) {
        this._closeDropdown();
      }
    });
  }

  _toggleDropdown() {
    if (this.isDropdownOpen) {
      this._closeDropdown();
    } else {
      this._openDropdown();
    }
  }

  _openDropdown() {
    if (!this.navDropdownToggle || !this.navDropdownMenu) return;

    this.isDropdownOpen = true;
    this.navDropdownToggle.classList.add(CSS_CLASSES.isOpen);
    this.navDropdownToggle.setAttribute('aria-expanded', 'true');
    this.navDropdownMenu.classList.add(CSS_CLASSES.isOpen);
  }

  _closeDropdown() {
    if (!this.navDropdownToggle || !this.navDropdownMenu) return;

    this.isDropdownOpen = false;
    this.navDropdownToggle.classList.remove(CSS_CLASSES.isOpen);
    this.navDropdownToggle.setAttribute('aria-expanded', 'false');
    this.navDropdownMenu.classList.remove(CSS_CLASSES.isOpen);
  }

  _addMobileDropdownItem(sectionId, sectionTitle) {
    if (!this.navDropdownMenu) return;

    const dropdownItem = document.createElement('a');
    dropdownItem.className = 'header-nav-dropdown-item';
    dropdownItem.setAttribute(SECTION_ATTRIBUTES.sectionId, sectionId);
    dropdownItem.setAttribute('href', `#section-${sectionId}`);
    dropdownItem.setAttribute('role', 'menuitem');
    dropdownItem.textContent = sectionTitle || sectionId.charAt(0).toUpperCase() + sectionId.slice(1);

    dropdownItem.addEventListener('click', () => {
      this._closeDropdown();
      this.setActiveSection(sectionId);
      
      // Update dropdown label to show selected item
      if (this.navDropdownLabel) {
        this.navDropdownLabel.textContent = dropdownItem.textContent;
      }
    });

    this.navDropdownMenu.appendChild(dropdownItem);
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
