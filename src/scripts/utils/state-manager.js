export const SECTION_ORDER = ['hero', 'about', 'skills', 'experience', 'projects', 'contact'];

const VALID_ROLES = ['recruiter', 'developer', 'friend'];
const VALID_THEMES = ['light', 'dark'];

const DEFAULT_STATE = {
  userName: null,
  role: null,
  revealedSections: [],
  scrollPosition: 0,
  language: 'en',
  theme: 'light',
  navigationExpanded: true
};

class StorageAdapter {
  constructor(key) {
    this.key = key;
    this.available = this.checkAvailability();
  }

  checkAvailability() {
    try {
      const testKey = '__storage_test__';
      sessionStorage.setItem(testKey, 'test');
      sessionStorage.removeItem(testKey);
      return true;
    } catch (error) {
      console.warn('Session storage is not available. State will not persist across page reloads.');
      return false;
    }
  }

  load() {
    if (!this.available) return null;

    try {
      const stored = sessionStorage.getItem(this.key);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      if (typeof parsed !== 'object' || parsed === null) {
        console.warn('Invalid state format in session storage. Using defaults.');
        return null;
      }

      return parsed;
    } catch (error) {
      console.warn('Failed to load state from session storage:', error.message);
      return null;
    }
  }

  save(state) {
    if (!this.available) return;

    try {
      sessionStorage.setItem(this.key, JSON.stringify(state));
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.warn('Session storage quota exceeded. State not persisted.');
      } else {
        console.warn('Failed to sync state to session storage:', error.message);
      }
    }
  }

  clear() {
    if (!this.available) return;

    try {
      sessionStorage.removeItem(this.key);
    } catch (error) {
      console.warn('Failed to clear session storage:', error.message);
    }
  }
}

class StateManager {
  constructor() {
    this.storage = new StorageAdapter('portfolioState');
    this.state = this.storage.load() || { ...DEFAULT_STATE };
  }

  sync() {
    this.storage.save(this.state);
  }

  getUserName() {
    return this.state.userName;
  }

  setUserName(name) {
    this.state.userName = name;
    this.sync();
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

  getScrollPosition() {
    return this.state.scrollPosition;
  }

  setScrollPosition(position) {
    this.state.scrollPosition = position;
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

  getNavigationExpanded() {
    return this.state.navigationExpanded;
  }

  setNavigationExpanded(expanded) {
    this.state.navigationExpanded = expanded;
    this.sync();
  }

  hasCompletedPersonalization() {
    return this.state.userName !== null && this.state.role !== null;
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
