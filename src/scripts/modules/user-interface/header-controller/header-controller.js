import SectionNavigationTracker from "../../../utils/section-navigation-tracker.js";

const HEADER_ELEMENTS = {
  nav: 'header-nav',
  navItem: 'header-nav-item',
  roleBadge: 'header-role-badge',
  roleText: 'header-role-text',
  indicator: 'nav-indicator',
  // Menu toggle and dropdown elements
  menuToggle: 'header-menu-toggle',
  dropdown: 'header-dropdown',
  dropdownRoleBadge: 'dropdown-role-badge',
  dropdownRoleText: 'dropdown-role-text',
  dropdownThemeToggle: 'dropdown-theme-toggle',
  // Mobile nav elements
  mobileNavOverlay: 'mobile-nav-overlay',
  mobileNavClose: 'mobile-nav-close',
  mobileNav: 'mobile-nav',
  mobileNavItem: 'mobile-nav-item',
  mobileRoleBadge: 'mobile-role-badge',
  mobileRoleText: 'mobile-role-text'
};

const MOBILE_BREAKPOINT = 640;

const SECTION_ATTRIBUTES = {
  sectionId: 'data-section-id'
};

class HeaderController {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.roleManager = null;

    this.sectionTracker = null;
    this.ownerName = null;
    this.languageSelector = null;
    this.headerNav = null;
    this.navIndicator = null;
    this.roleBadge = null;
    this.roleBadgeText = null;

    // Menu toggle and dropdown elements
    this.menuToggle = null;
    this.dropdown = null;
    this.dropdownRoleBadge = null;
    this.dropdownRoleBadgeText = null;
    this.dropdownThemeToggle = null;
    this.isMobile = false;

    // Mobile nav elements
    this.mobileNavOverlay = null;
    this.mobileNavClose = null;
    this.mobileNav = null;
    this.mobileRoleBadge = null;
    this.mobileRoleBadgeText = null;

    this.visibleSections = [];
    this.activeObserver = null;
    this._resizeHandler = this._handleResize.bind(this);
    this._handleClickOutside = this._handleClickOutside.bind(this);
  }

  initialize(ownerNameElement, roleManager) {
    this.roleManager = roleManager;
    this.ownerName = ownerNameElement;
    // this.languageSelector = languageSelectorElement;
    this.headerNav = document.getElementById(HEADER_ELEMENTS.nav);
    this.navIndicator = document.getElementById(HEADER_ELEMENTS.indicator);
    this.roleBadge = document.getElementById(HEADER_ELEMENTS.roleBadge);
    this.roleBadgeText = document.getElementById(HEADER_ELEMENTS.roleText);

    // Cache menu toggle and dropdown elements
    this.menuToggle = document.getElementById(HEADER_ELEMENTS.menuToggle);
    this.dropdown = document.getElementById(HEADER_ELEMENTS.dropdown);
    this.dropdownRoleBadge = document.getElementById(HEADER_ELEMENTS.dropdownRoleBadge);
    this.dropdownRoleBadgeText = document.getElementById(HEADER_ELEMENTS.dropdownRoleText);
    this.dropdownThemeToggle = document.getElementById(HEADER_ELEMENTS.dropdownThemeToggle);

    // Cache mobile nav elements
    this.mobileNavOverlay = document.getElementById(HEADER_ELEMENTS.mobileNavOverlay);
    this.mobileNavClose = document.getElementById(HEADER_ELEMENTS.mobileNavClose);
    this.mobileNav = document.getElementById(HEADER_ELEMENTS.mobileNav);
    this.mobileRoleBadge = document.getElementById(HEADER_ELEMENTS.mobileRoleBadge);
    this.mobileRoleBadgeText = document.getElementById(HEADER_ELEMENTS.mobileRoleText);

    this.sectionTracker = new SectionNavigationTracker(HEADER_ELEMENTS.nav, 'main-content', {
      activeClass: 'active',
      threshold: 0.51,
      sectionSelector: '.section',
      navItemSelector: '.header-nav-item',
      sectionIdAttribute: 'data-section-id'
    });

    if (this.languageSelector) {
      const currentLanguage = this.stateManager.getLanguage();
      if (currentLanguage) {
        this.languageSelector.value = currentLanguage;
      }
    }

    this._setupMediaQueryListener();
    this._setupRoleBadgeClick();
    this._setupMenuToggle();
    this._setupDropdown();
    this._setupMobileNavOverlay();
    this._setupActiveObserver();

    window.addEventListener('resize', this._resizeHandler);
  }

  _setupMediaQueryListener() {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    this.isMobile = mediaQuery.matches;

    mediaQuery.addEventListener('change', (e) => {
      this.isMobile = e.matches;
      // Close dropdown when switching to mobile
      if (this.isMobile && this.dropdown?.classList.contains('is-open')) {
        this._closeDropdown();
      }
    });
  }

  _setupMenuToggle() {
    if (!this.menuToggle) return;

    this.menuToggle.addEventListener('click', () => {
      if (this.isMobile) {
        this._openMobileNav();
      } else {
        this._toggleDropdown();
      }
    });
  }

  _setupDropdown() {
    if (!this.dropdown) return;

    // Click outside to close
    document.addEventListener('click', this._handleClickOutside);

    // Keyboard navigation
    this.dropdown.addEventListener('keydown', (e) => {
      this._handleDropdownKeyboard(e);
    });

    // Close on Escape (global)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.dropdown.classList.contains('is-open')) {
        this._closeDropdown();
        this.menuToggle?.focus();
      }
    });
  }

  _handleClickOutside(e) {
    if (!this.dropdown || !this.menuToggle) return;

    const isClickInside = this.dropdown.contains(e.target) || this.menuToggle.contains(e.target);
    if (!isClickInside && this.dropdown.classList.contains('is-open')) {
      this._closeDropdown();
    }
  }

  _handleDropdownKeyboard(e) {
    const items = Array.from(this.dropdown.querySelectorAll('.header-dropdown-item'));
    const currentIndex = items.indexOf(document.activeElement);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex < items.length - 1) {
          items[currentIndex + 1].focus();
        } else {
          items[0].focus();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex > 0) {
          items[currentIndex - 1].focus();
        } else {
          items[items.length - 1].focus();
        }
        break;
      case 'Tab':
        // Allow tab but close dropdown after last item
        if (!e.shiftKey && currentIndex === items.length - 1) {
          this._closeDropdown();
        } else if (e.shiftKey && currentIndex === 0) {
          this._closeDropdown();
        }
        break;
    }
  }

  _openDropdown() {
    if (!this.dropdown || !this.menuToggle) return;

    this.dropdown.classList.add('is-open');
    this.dropdown.setAttribute('aria-hidden', 'false');
    this.menuToggle.setAttribute('aria-expanded', 'true');

    // Focus first item
    const firstItem = this.dropdown.querySelector('.header-dropdown-item');
    if (firstItem) {
      firstItem.focus();
    }
  }

  _closeDropdown() {
    if (!this.dropdown || !this.menuToggle) return;

    // Move focus out of dropdown before hiding to prevent aria-hidden accessibility violation
    if (this.dropdown.contains(document.activeElement)) {
      this.menuToggle.focus();
    }

    this.dropdown.classList.remove('is-open');
    this.dropdown.setAttribute('aria-hidden', 'true');
    this.menuToggle.setAttribute('aria-expanded', 'false');
  }

  _toggleDropdown() {
    if (this.dropdown?.classList.contains('is-open')) {
      this._closeDropdown();
    } else {
      this._openDropdown();
    }
  }

  _setupActiveObserver() {
    if (!this.headerNav) return;

    this.activeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
            mutation.type === 'attributes' &&
            mutation.attributeName === 'class') {
              if (mutation.target.classList.contains('active')) {
                this._moveIndicatorTo(mutation.target);
                this._scrollNavItemIntoView(mutation.target);
              } else {
                this._hideNavIndicator();
              }
        }
      });
    });

    this.activeObserver.observe(this.headerNav, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class']
    });
  }

  /**
   * Calculates position and width to slide the line to the target item
   */
  _moveIndicatorTo(targetItem) {
    if (!this.navIndicator || !targetItem) {
      this.navIndicator.style.width = '0px';
      this.navIndicator.style.transform = `translateX(0px)`;
      this.navIndicator.style.opacity = '0';
    }

    const paddingOffset = 16; // Approximate sum of left/right padding ($spacing-xs * 2)
    const itemWidth = targetItem.offsetWidth;
    const itemLeft = targetItem.offsetLeft;

    // Prevent negative width if item is very small
    const targetWidth = Math.max(0, itemWidth - paddingOffset);
    // Center the line within the item
    const targetLeft = itemLeft + (paddingOffset / 2);

    this.navIndicator.style.width = `${targetWidth}px`;
    this.navIndicator.style.transform = `translateX(${targetLeft}px)`;
    this.navIndicator.style.opacity = '1';
  }

  _handleResize() {
    const activeItem = this.headerNav?.querySelector(`.${HEADER_ELEMENTS.navItem}.active`);

    if (activeItem) {
      this._moveIndicatorTo(activeItem);
      this._scrollNavItemIntoView(activeItem);
    }
  }

  _setupRoleBadgeClick() {
    if (this.roleBadge) {
      this.roleBadge.addEventListener('click', () => {
        if (this.roleManager) {
          this.roleManager.showChangeModal();
        }
      });
    }

    if (this.dropdownRoleBadge) {
      this.dropdownRoleBadge.addEventListener('click', () => {
        this._closeDropdown();
        if (this.roleManager) {
          this.roleManager.showChangeModal();
        }
      });
    }

    if (this.mobileRoleBadge) {
      this.mobileRoleBadge.addEventListener('click', () => {
        this._closeMobileNav();
        if (this.roleManager) {
          this.roleManager.showChangeModal();
        }
      });
    }
  }

  _setupMobileNavOverlay() {
    if (!this.mobileNavOverlay) return;

    if (this.mobileNavClose) {
      this.mobileNavClose.addEventListener('click', () => {
        this._closeMobileNav();
      });
    }

    this.mobileNavOverlay.addEventListener('click', (e) => {
      if (e.target === this.mobileNavOverlay) {
        this._closeMobileNav();
      }
    });

    if (this.mobileNav) {
      this.mobileNav.addEventListener('click', (e) => {
        if (e.target.classList.contains(HEADER_ELEMENTS.mobileNavItem)) {
          this._closeMobileNav();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.mobileNavOverlay.classList.contains('is-open')) {
        this._closeMobileNav();
      }
    });
  }

  _openMobileNav() {
    if (!this.mobileNavOverlay || !this.menuToggle) return;

    this.mobileNavOverlay.classList.add('is-open');
    this.mobileNavOverlay.setAttribute('aria-hidden', 'false');
    this.menuToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  _closeMobileNav() {
    if (!this.mobileNavOverlay || !this.menuToggle) return;

    this.mobileNavOverlay.classList.remove('is-open');
    this.mobileNavOverlay.setAttribute('aria-hidden', 'true');
    this.menuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
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

  updateRoleBadge(role) {
    if (!this.roleManager) return;

    const roleText = role ? `${role.charAt(0).toUpperCase() + role.slice(1) === 'Developer' ? 'Engineer' : role.charAt(0).toUpperCase() + role.slice(1)} View` : '';

    // Update desktop role badge
    if (this.roleBadge && this.roleBadgeText) {
      if (role) {
        this.roleBadgeText.textContent = roleText;
        this.roleBadge.classList.add('visible');
      } else {
        this.roleBadge.classList.remove('visible');
      }
    }

    // Update dropdown role badge
    if (this.dropdownRoleBadgeText) {
      this.dropdownRoleBadgeText.textContent = role ? roleText : 'View';
    }

    // Update mobile role badge
    if (this.mobileRoleBadge && this.mobileRoleBadgeText) {
      if (role) {
        this.mobileRoleBadgeText.textContent = roleText;
        this.roleBadge.classList.add('visible');
      } else {
        this.roleBadge.classList.remove('visible');
      }
    }
  }

  addNavigationItem(sectionId, sectionTitle) {
    if (!this.headerNav) return;

    if (this.visibleSections.includes(sectionId)) {
      return;
    }

    this.visibleSections.push(sectionId);

    const title = sectionTitle || sectionId.charAt(0).toUpperCase() + sectionId.slice(1);

    const desktopNavLink = document.createElement('a');
    desktopNavLink.className = HEADER_ELEMENTS.navItem;
    desktopNavLink.setAttribute(SECTION_ATTRIBUTES.sectionId, sectionId);
    desktopNavLink.setAttribute('href', `#section-${sectionId}`);
    desktopNavLink.textContent = title;

    this.headerNav.appendChild(desktopNavLink);

    if (this.navIndicator) {
      this.headerNav.appendChild(this.navIndicator);
    }

    if (this.mobileNav) {
      const mobileNavLink = document.createElement('a');
      mobileNavLink.className = HEADER_ELEMENTS.mobileNavItem;
      mobileNavLink.setAttribute(SECTION_ATTRIBUTES.sectionId, sectionId);
      mobileNavLink.setAttribute('href', `#section-${sectionId}`);
      mobileNavLink.textContent = title;

      this.mobileNav.appendChild(mobileNavLink);
    }
  }

  clearNavigation() {
    if (!this.headerNav) return;

    const items = this.headerNav.querySelectorAll(`.${HEADER_ELEMENTS.navItem}`);
    items.forEach(el => el.remove());

    if (this.mobileNav) {
      const mobileItems = this.mobileNav.querySelectorAll(`.${HEADER_ELEMENTS.mobileNavItem}`);
      mobileItems.forEach(el => el.remove());
    }

    this.visibleSections = [];

    if (this.navIndicator) {
      this._hideNavIndicator();
    }
  }

  _hideNavIndicator() {
      this.navIndicator.style.opacity = '0';
      this.navIndicator.style.width = '0';
  }

  /**
   * Scrolls the nav container horizontally to make the target item visible if it's out of view
   */
  _scrollNavItemIntoView(targetItem) {
    if (!this.headerNav || !targetItem) return;

    const navRect = this.headerNav.getBoundingClientRect();
    const itemRect = targetItem.getBoundingClientRect();

    // Check if item is fully visible within the nav container
    const isFullyVisible =
      itemRect.left >= navRect.left &&
      itemRect.right <= navRect.right;

    if (!isFullyVisible) {
      // Calculate scroll position to center the item in the nav
      const itemCenter = targetItem.offsetLeft + (targetItem.offsetWidth / 2);
      const navCenter = this.headerNav.clientWidth / 2;
      const targetScroll = itemCenter - navCenter;

      this.headerNav.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  }
}

export default HeaderController;
