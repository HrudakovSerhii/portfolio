class ThemeSwitcher {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.themeToggle = null;
  }

  initialize(themeToggleElement) {
    this.themeToggle = themeToggleElement;

    let theme = this.stateManager.getTheme();

    if (!theme || (theme !== 'light' && theme !== 'dark')) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = prefersDark ? 'dark' : 'light';
      this.stateManager.setTheme(theme);
    }

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
    
    if (this.themeToggle) {
      this.themeToggle.setAttribute('data-theme', theme);
      this.themeToggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');

      const icon = this.themeToggle.querySelector('.control-icon');
      if (icon) {
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
      }
    }
  }
}

export default ThemeSwitcher;
