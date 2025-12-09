// Main application entry point

// Import utility modules
import { initializeTranslations } from './modules/translations.js';

async function main() {
    // Development flag - Set to false for production builds
    // This controls debug logging throughout the application
    window.isDev = true;

    console.log('Portfolio website initialized');

    // Initialize modules
    initializeTranslations().finally();

    const chatTriggerButton = document.getElementById('hero-chat-trigger');

    // Make chat integration available globally for chat button
    if (chatTriggerButton) {
        chatTriggerButton.addEventListener('click', async () => {
            try {
                // Import and initialize chat integration
                const chatIntegration = await import('./modules/chat-bot/chat-integration.js');

                // Initialize chat if the function is available
                if (chatIntegration.default && chatIntegration.default.initializeChat) {
                    await chatIntegration.default.initializeChat();
                } else if (window.initializeChat) {
                    await window.initializeChat();
                } else {
                    console.error('Chat initialization function not found');
                }

                console.log('Chat integration loaded and ready');
            } catch (error) {
                console.error('Failed to load chat integration:', error);

                // Show user-friendly error message
                const errorMessage = error.message.includes('BROWSER_UNSUPPORTED') || error.message.includes('WebAssembly')
                    ? "Oops, sorry, we couldn't load Serhii to your browser :("
                    : "Having trouble loading the chat. Please try refreshing the page.";

                alert(errorMessage);
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
export { initializeTranslations };
