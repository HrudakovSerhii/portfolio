// Main application entry point

// Import utility modules
import { initializeNavigation } from './modules/navigation.js';
import { initializeTranslations } from './modules/translations.js';

async function main() {
    console.log('Portfolio website initialized');

    // Initialize modules
    initializeNavigation();
    initializeTranslations().finally();

    const chatTriggerButton = document.getElementById('hero-chat-trigger');

    // Make chat integration available globally for chat button
    if (chatTriggerButton) {
        chatTriggerButton.addEventListener('click', async () => {
            try {
                // Import chat integration functions and make them globally available
                await import('./modules/chat-bot/chat-integration.js');
                console.log('Chat integration loaded and ready');
            } catch (error) {
                console.error('Failed to load chat integration:', error);
            }
        })

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
