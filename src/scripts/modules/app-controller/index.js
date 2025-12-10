import AppController from './app-controller.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const app = new AppController();
    await app.init();
    await app.loadAppState();

    if (typeof window !== 'undefined') {
      window.portfolioApp = app;
    }
  } catch (error) {
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
