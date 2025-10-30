// Main application entry point

// Import utility modules
import { initializeNavigation } from './modules/navigation.js';
import { initializeTranslations } from './modules/translations.js';

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Portfolio website initialized');
    
    // Initialize modules
    initializeNavigation();
    initializeTranslations();
});

// Export for potential external use
export { initializeNavigation, initializeTranslations };