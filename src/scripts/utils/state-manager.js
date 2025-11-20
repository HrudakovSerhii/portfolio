/**
 * StateManager - Manages application state with session storage persistence
 * Handles user personalization, section revelation tracking, and UI preferences
 * 
 * Similar to React's useState with session storage sync:
 * - Maintains in-memory state for fast access
 * - Initializes from session storage or defaults
 * - Syncs to session storage on every state change
 * - Gracefully handles storage failures
 */

const SECTION_ORDER = ['hero', 'about', 'skills', 'experience', 'projects', 'contact'];

class StateManager {
  constructor() {
    this.storageKey = 'portfolioState';
    this.storageAvailable = this.checkStorageAvailability();
    
    // Initialize in-memory state from session storage or defaults
    this.state = this.initializeState();
  }

  /**
   * Check if session storage is available
   * @returns {boolean} True if session storage is available
   */
  checkStorageAvailability() {
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

  /**
   * Initialize state from session storage or use defaults
   * @returns {Object} Initial state object
   */
  initializeState() {
    if (this.storageAvailable) {
      const storedState = this.loadFromStorage();

      if (storedState) {
        return storedState;
      }
    }

    return this.getDefaultState();
  }

  /**
   * Get default state structure
   * @returns {Object} Default state object
   */
  getDefaultState() {
    return {
      userName: null,
      role: null,
      revealedSections: [],
      scrollPosition: 0,
      language: 'en',
      theme: 'light'
    };
  }

  /**
   * Load state from session storage
   * @returns {Object|null} Stored state or null if not found/invalid
   */
  loadFromStorage() {
    try {
      const stored = sessionStorage.getItem(this.storageKey);
      if (!stored) {
        return null;
      }
      
      const parsed = JSON.parse(stored);
      
      // Validate the loaded state
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

  /**
   * Sync current in-memory state to session storage
   */
  syncToStorage() {
    if (!this.storageAvailable) {
      return;
    }

    try {
      const serialized = JSON.stringify(this.state);
      sessionStorage.setItem(this.storageKey, serialized);
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.warn('Session storage quota exceeded. State not persisted.');
      } else {
        console.warn('Failed to sync state to session storage:', error.message);
      }
    }
  }

  // User name methods
  getUserName() {
    return this.state.userName;
  }

  setUserName(name) {
    this.state.userName = name;
    this.syncToStorage();
  }

  // Role methods
  getRole() {
    return this.state.role;
  }

  setRole(role) {
    const validRoles = ['recruiter', 'developer', 'friend'];

    if (!validRoles.includes(role)) {
      console.warn(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
      return;
    }

    this.state.role = role;
    this.syncToStorage();
  }

  // Revealed sections methods
  getRevealedSections() {
    return [...this.state.revealedSections];
  }

  addRevealedSection(sectionId) {
    if (!this.state.revealedSections.includes(sectionId)) {
      this.state.revealedSections.push(sectionId);
      this.syncToStorage();
    }
  }

  resetRevealedSections() {
    this.state.revealedSections = [];
    this.syncToStorage();
  }

  // Scroll position methods
  getScrollPosition() {
    return this.state.scrollPosition;
  }

  setScrollPosition(position) {
    this.state.scrollPosition = position;
    this.syncToStorage();
  }

  // Language methods
  getLanguage() {
    return this.state.language;
  }

  setLanguage(lang) {
    this.state.language = lang;
    this.syncToStorage();
  }

  // Theme methods
  getTheme() {
    return this.state.theme;
  }

  setTheme(theme) {
    const validThemes = ['light', 'dark'];

    if (!validThemes.includes(theme)) {
      console.warn(`Invalid theme: ${theme}. Must be one of: ${validThemes.join(', ')}`);
      return;
    }

    this.state.theme = theme;
    this.syncToStorage();
  }

  // Utility methods
  hasCompletedPersonalization() {
    return this.state.userName !== null && this.state.role !== null;
  }

  hasRevealedAllSections() {
    return this.state.revealedSections.length === SECTION_ORDER.length;
  }

  clearAll() {
    this.state = this.getDefaultState();
    
    if (this.storageAvailable) {
      try {
        sessionStorage.removeItem(this.storageKey);
      } catch (error) {
        console.warn('Failed to clear session storage:', error.message);
      }
    }
  }
}

export default StateManager;
