// Translation system functionality

let currentLanguage = 'en';
let translations = {};

export async function initializeTranslations() {
    console.log('Translation module initialized');
    
    // Load default language
    await loadTranslations(currentLanguage);
    applyTranslations();
}

export async function loadTranslations(language) {
    try {
        const response = await fetch(`../translations/${language}.json`);
        if (response.ok) {
            translations = await response.json();
            currentLanguage = language;
        } else {
            console.warn(`Translation file for ${language} not found`);
        }
    } catch (error) {
        console.error('Error loading translations:', error);
    }
}

export function applyTranslations() {
    const elements = document.querySelectorAll('[data-translate]');
    
    elements.forEach(element => {
        const key = element.getAttribute('data-translate');
        const translation = getTranslation(key);
        
        if (translation) {
            element.textContent = translation;
        }
    });
}

export function getTranslation(key) {
    return key.split('.').reduce((obj, k) => obj && obj[k], translations) || key;
}

export function switchLanguage(language) {
    loadTranslations(language).then(() => {
        applyTranslations();
    });
}