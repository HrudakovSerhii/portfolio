import SectionNavigationTracker from "../../../utils/section-navigation-tracker.js";

const HEADER_ELEMENTS = {
  nav: 'header-nav',
  navItem: 'header-nav-item',
  roleBadge: 'header-role-badge',
  roleText: 'header-role-text',
  navToggle: 'header-nav-toggle'
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
    this.roleBadge = null;
    this.roleBadgeText = null;

    this.visibleSections = [];
  }

  initialize(ownerNameElement, languageSelectorElement, roleManager) {
    this.roleManager = roleManager;
    this.sectionTracker = new SectionNavigationTracker('header-nav', 'sections-container', {
      activeClass: 'active',
      threshold: 0.51,
      sectionSelector: '.content-section',
      navItemSelector: '.header-nav-item',
      sectionIdAttribute: 'data-section-id'
    });

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

    this._setupRoleBadgeClick();
    this._setupMobileToggle();
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
    // Section tracking is handled automatically by SectionNavigationTracker
  }

  clearNavigation() {
    if (!this.headerNav) return;

    this.headerNav.innerHTML = '';
    this.visibleSections = [];
    // Section tracking cleanup is handled by SectionNavigationTracker
  }
}

export default HeaderController;
