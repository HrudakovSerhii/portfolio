export const SECTION_ORDER = ['hero', 'about', 'skills', 'experience', 'projects', 'contact'];

const VALID_ROLES = ['recruiter', 'developer', 'friend'];
const VALID_THEMES = ['light', 'dark'];
const DEFAULT_STATE = {
  role: null,
  revealedSections: [],
  language: 'en',
  theme: VALID_THEMES[0]
};

class StorageAdapter {
  constructor(key) {
    this.key = key;
  }

  load() {
    const stored = sessionStorage.getItem(this.key);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) {
      console.warn('Invalid state format in session storage. Using defaults.');
      return null;
    }

    return parsed;
  }

  save(state) {
    sessionStorage.setItem(this.key, JSON.stringify(state));
  }

  clear() {
    sessionStorage.removeItem(this.key);
  }
}

class StateManager {
  constructor() {
    this.storage = new StorageAdapter('portfolioState');
    this.state = this.storage.load() || this.supportMediaQuery() ? {...DEFAULT_STATE, theme: this.getUserTheme() } : DEFAULT_STATE;
  }

  sync() {
    this.storage.save(this.state);
  }

  getRole() {
    return this.state.role;
  }

  setRole(role) {
    if (!VALID_ROLES.includes(role)) {
      console.warn(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}`);
      return;
    }
    this.state.role = role;
    this.sync();
  }

  getRevealedSections() {
    return [...this.state.revealedSections];
  }

  addRevealedSection(sectionId) {
    if (!this.state.revealedSections.includes(sectionId)) {
      this.state.revealedSections.push(sectionId);
      this.sync();
    }
  }

  resetRevealedSections() {
    this.state.revealedSections = [];
    this.sync();
  }

  getLanguage() {
    return this.state.language;
  }

  setLanguage(lang) {
    this.state.language = lang;
    this.sync();
  }

  getTheme() {
    return this.state.theme;
  }

  setTheme(theme) {
    if (!VALID_THEMES.includes(theme)) {
      console.warn(`Invalid theme: ${theme}. Must be one of: ${VALID_THEMES.join(', ')}`);
      return;
    }
    this.state.theme = theme;
    this.sync();
  }

  getUserTheme() {
    if (this.supportMediaQuery()) {
      return this.usedDarkTheme() ? 'dark' : 'light';
    }

    return null;
  }

  supportMediaQuery() {
    return !!window.matchMedia
  }

  usedDarkTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  hasCompletedPersonalization() {
    return this.state.role !== null;
  }

  hasRevealedAllSections() {
    return this.state.revealedSections.length === SECTION_ORDER.length;
  }

  clearAll() {
    this.state = { ...DEFAULT_STATE };
    this.storage.clear();
  }
}

export default StateManager;
