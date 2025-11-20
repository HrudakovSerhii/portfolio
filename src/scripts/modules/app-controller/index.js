/**
 * Chat Portfolio - Main entry point
 * 
 * Initializes the AppController when the DOM is ready
 */

import AppController from './app-controller.js';

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initializing Chat Portfolio...');
    
    const app = new AppController();
    await app.init();
    
    console.log('Chat Portfolio initialized successfully');
    
    // Make app instance available globally for debugging
    if (typeof window !== 'undefined') {
      window.portfolioApp = app;
    }
  } catch (error) {
    console.error('Failed to initialize Chat Portfolio:', error);
    
    // Show user-friendly error message
    const loader = document.getElementById('initial-loader');
    if (loader) {
      const loaderText = loader.querySelector('.loader-text');
      if (loaderText) {
        loaderText.textContent = 'Failed to load portfolio. Please refresh the page.';
      }
    }
  }
});

export default AppController;
