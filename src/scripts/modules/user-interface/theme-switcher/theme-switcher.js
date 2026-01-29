class ThemeSwitcher {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.themeToggle = null;
    this.mobileThemeToggle = null;
    this.dropdownThemeToggle = null;
  }

  initialize(themeToggleElement, mobileThemeToggleElement, dropdownThemeToggleElement) {
    this.themeToggle = themeToggleElement;
    this.mobileThemeToggle = mobileThemeToggleElement;
    this.dropdownThemeToggle = dropdownThemeToggleElement;

    const theme = this.stateManager.getTheme();

    this.apply(theme);
  }

  toggle() {
    const currentTheme = this.stateManager.getTheme();
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    this.stateManager.setTheme(newTheme);
    this.apply(newTheme);

    return newTheme;
  }

  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    this._applyToToggle(this.themeToggle, theme);
    this._applyToToggle(this.mobileThemeToggle, theme);
    this._applyToToggle(this.dropdownThemeToggle, theme);
  }

  _applyToToggle(toggleElement, theme) {
    if (!toggleElement) return;

    toggleElement.setAttribute('data-theme', theme);
    toggleElement.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');

    const icon = toggleElement.querySelector('.material-symbols-outlined');
    if (icon) {
      icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    }
  }
}

export default ThemeSwitcher;
