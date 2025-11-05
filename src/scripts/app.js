// Main application entry point

// Import utility modules
import { initializeNavigation } from './modules/navigation.js';
import { initializeTranslations } from './modules/translations.js';

async function main() {
    console.log('Portfolio website initialized');

    // Initialize modules
    initializeNavigation();
    initializeTranslations().finally();

    // Initialize chat integration on home page
    if (document.body.dataset.page === 'home' || document.querySelector('#hero-chat-trigger')) {
        try {
            // Dynamic import for chat integration
            const { default: ChatIntegration } = await import('./modules/chat-bot/chat-integration.js');
            const chatIntegration = new ChatIntegration();
            await chatIntegration.initialize();
        } catch (error) {
            console.error('Failed to initialize chat integration:', error);
        }
    }
}

if (document.readyState === "loading") {
    // Loading hasn't finished yet, initialize application on load complete
    document.addEventListener("DOMContentLoaded", main);
} else {
    // `DOMContentLoaded` has already fired, initialize application
    main().finally();
}

// Export for potential external use
export { initializeNavigation, initializeTranslations };
