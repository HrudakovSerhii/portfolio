import SectionNavigationTracker from "../../../utils/section-navigation-tracker.js";

const HEADER_ELEMENTS = {
  nav: 'header-nav',
  navItem: 'header-nav-item',
  roleBadge: 'header-role-badge',
  roleText: 'header-role-text',
  navToggle: 'header-nav-toggle',
  indicator: 'nav-indicator'
};

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
    this.navToggle = null;

    this.visibleSections = [];
    this.activeObserver = null;
    this._resizeHandler = this._handleResize.bind(this);
  }

  initialize(ownerNameElement, languageSelectorElement, roleManager) {
    this.roleManager = roleManager;
    this.ownerName = ownerNameElement;
    this.languageSelector = languageSelectorElement;
    this.headerNav = document.getElementById(HEADER_ELEMENTS.nav);
    this.navIndicator = document.getElementById(HEADER_ELEMENTS.indicator);
    this.roleBadge = document.getElementById(HEADER_ELEMENTS.roleBadge);
    this.roleBadgeText = document.getElementById(HEADER_ELEMENTS.roleText);
    this.navToggle = document.getElementById(HEADER_ELEMENTS.navToggle);

    this.sectionTracker = new SectionNavigationTracker(HEADER_ELEMENTS.nav, 'sections-container', {
      activeClass: 'active',
      threshold: 0.51,
      sectionSelector: '.content-section',
      navItemSelector: '.header-nav-item',
      sectionIdAttribute: 'data-section-id'
    });

    if (this.languageSelector) {
      const currentLanguage = this.stateManager.getLanguage();
      if (currentLanguage) {
        this.languageSelector.value = currentLanguage;
      }
    }

    this._setupRoleBadgeClick();
    this._setupMobileToggle();
    this._setupActiveObserver();

    window.addEventListener('resize', this._resizeHandler);
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
    };

    const paddingOffset = 24; // Approximate sum of left/right padding ($spacing-sm * 2)
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
  }

  _setupMobileToggle() {
    if (!this.navToggle || !this.headerNav) return;

    this.navToggle.addEventListener('click', () => {
      const isOpen = this.headerNav.classList.toggle('is-open');
      this.navToggle.setAttribute('aria-expanded', isOpen.toString());
    });

    this.headerNav.addEventListener('click', (e) => {
      if (e.target.classList.contains(HEADER_ELEMENTS.navItem)) {
        this.headerNav.classList.remove('is-open');
        this.navToggle.setAttribute('aria-expanded', 'false');
      }
    });

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

  updateRoleBadge(role) {
    if (!this.roleBadge || !this.roleBadgeText || !this.roleManager) return;

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

    const navLink = document.createElement('a');
    navLink.className = HEADER_ELEMENTS.navItem;
    navLink.setAttribute(SECTION_ATTRIBUTES.sectionId, sectionId);
    navLink.setAttribute('href', `#section-${sectionId}`);
    navLink.textContent = sectionTitle || sectionId.charAt(0).toUpperCase() + sectionId.slice(1);

    this.headerNav.appendChild(navLink);

    if (this.navIndicator) {
      this.headerNav.appendChild(this.navIndicator);
    }
  }

  clearNavigation() {
    if (!this.headerNav) return;

    const items = this.headerNav.querySelectorAll(`.${HEADER_ELEMENTS.navItem}`);
    items.forEach(el => el.remove());

    this.visibleSections = [];

    if (this.navIndicator) {
      this._hideNavIndicator();
    }
  }

  _hideNavIndicator() {
      this.navIndicator.style.opacity = '0';
      this.navIndicator.style.width = '0';
  }
}

export default HeaderController;
