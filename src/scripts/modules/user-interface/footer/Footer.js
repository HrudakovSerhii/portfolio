/**
 * Footer Component
 * Renders the footer section with social links and copyright information
 */
class Footer {
  constructor(config = {}) {
    this.config = {
      socialLinks: config.socialLinks || [],
      copyrightText: config.copyrightText || '© 2024 Alex Design. All rights reserved.',
      copyrightYear: config.copyrightYear || new Date().getFullYear(),
      ...config
    };
  }

  /**
   * Renders the footer element
   * @returns {HTMLElement} Footer element
   */
  render() {
    const footer = document.createElement('footer');
    footer.className = 'footer';
    footer.setAttribute('role', 'contentinfo');

    const container = document.createElement('div');
    container.className = 'footer__container';

    // Render social links
    if (this.config.socialLinks.length > 0) {
      const socialSection = this._renderSocialLinks();
      container.appendChild(socialSection);
    }

    // Render copyright
    const copyrightElement = this._renderCopyright();
    container.appendChild(copyrightElement);

    footer.appendChild(container);

    return footer;
  }

  /**
   * Renders social links section
   * @private
   * @returns {HTMLElement} Social links container
   */
  _renderSocialLinks() {
    const socialContainer = document.createElement('div');
    socialContainer.className = 'footer__social';

    const linksList = document.createElement('div');
    linksList.className = 'footer__social-links';

    this.config.socialLinks.forEach(link => {
      const anchor = document.createElement('a');
      anchor.className = 'footer__social-link';
      anchor.href = link.url || '#';
      anchor.setAttribute('aria-label', link.label || link.icon);

      if (link.url && link.url !== '#') {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }

      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined';
      icon.textContent = link.icon;

      anchor.appendChild(icon);
      linksList.appendChild(anchor);
    });

    socialContainer.appendChild(linksList);

    return socialContainer;
  }

  /**
   * Renders copyright section
   * @private
   * @returns {HTMLElement} Copyright container
   */
  _renderCopyright() {
    const copyrightContainer = document.createElement('div');
    copyrightContainer.className = 'footer__copyright';

    const copyrightText = document.createElement('p');
    copyrightText.className = 'footer__copyright-text';
    copyrightText.textContent = this.config.copyrightText.replace(
      /©\s*\d{4}/,
      `© ${this.config.copyrightYear}`
    );

    copyrightContainer.appendChild(copyrightText);

    return copyrightContainer;
  }

  /**
   * Updates the footer configuration
   * @param {Object} newConfig - New configuration object
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }
}

export default Footer;
