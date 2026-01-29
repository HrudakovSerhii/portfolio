const SUPPORTED_LANGUAGES = ['en', 'nl', 'ua'];
const FALLBACK_LANGUAGE = 'en';

class TranslationService {
  constructor() {
    this.translations = {};
    this.currentLanguage = FALLBACK_LANGUAGE;
    this.fallbackLanguage = FALLBACK_LANGUAGE;
    this.initialized = false;
  }

  async initialize(language) {
    this.currentLanguage = language || this._detectBrowserLanguage();

    await this._loadTranslations(this.currentLanguage);

    if (this.currentLanguage !== this.fallbackLanguage) {
      await this._loadTranslations(this.fallbackLanguage);
    }

    this.initialized = true;
  }

  _detectBrowserLanguage() {
    const browserLang = navigator.language?.split('-')[0] || FALLBACK_LANGUAGE;
    return SUPPORTED_LANGUAGES.includes(browserLang) ? browserLang : FALLBACK_LANGUAGE;
  }

  async _loadTranslations(lang) {
    if (this.translations[lang]) {
      return;
    }

    try {
      const response = await fetch(`/portfolio/translations/${lang}.json`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.translations[lang] = await response.json();
    } catch (error) {
      console.warn(`Failed to load ${lang} translations:`, error.message);

      if (lang !== this.fallbackLanguage) {
        console.warn(`Falling back to ${this.fallbackLanguage}`);
      }
    }
  }

  t(key) {
    const currentValue = this._getNestedValue(this.translations[this.currentLanguage], key);

    if (currentValue !== undefined) {
      return currentValue;
    }

    const fallbackValue = this._getNestedValue(this.translations[this.fallbackLanguage], key);

    if (fallbackValue !== undefined) {
      return fallbackValue;
    }

    return key;
  }

  _getNestedValue(obj, path) {
    if (!obj || !path) {
      return undefined;
    }

    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  applyToDOM() {
    this.applyToElement(document);
  }

  applyToElement(element) {
    const i18nElements = element.querySelectorAll('[data-i18n]');

    i18nElements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = this.t(key);

      if (translation && translation !== key) {
        el.textContent = translation;
      }
    });
  }

  async switchLanguage(lang) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      console.warn(`Language ${lang} is not supported. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
      return;
    }

    if (!this.translations[lang]) {
      await this._loadTranslations(lang);
    }

    this.currentLanguage = lang;
    this.applyToDOM();
  }

  getCurrentLanguage() {
    return this.currentLanguage;
  }

  getSupportedLanguages() {
    return [...SUPPORTED_LANGUAGES];
  }

  isInitialized() {
    return this.initialized;
  }
}

const translationService = new TranslationService();
export default translationService;

export { TranslationService, SUPPORTED_LANGUAGES, FALLBACK_LANGUAGE };
