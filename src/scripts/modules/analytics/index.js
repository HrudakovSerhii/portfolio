/**
 * Analytics module for GA4 event tracking
 * Tracks: section progression, role selection, CV downloads
 */

/**
 * Send event to Google Analytics
 * @param {string} eventName - Event name (max 40 chars)
 * @param {Object} params - Event parameters
 */
export function trackEvent(eventName, params = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

/**
 * Track section view in the funnel
 * @param {string} sectionName - Section identifier
 */
export function trackSectionView(sectionName) {
  trackEvent('section_view', {
    section_name: sectionName
  });
}

/**
 * Track role selection (initial or change)
 * @param {string} role - Selected role (recruiter/developer/friend)
 * @param {boolean} isChange - Whether this is a role change
 */
export function trackRoleSelect(role, isChange = false) {
  trackEvent('select_role', {
    role: role,
    is_role_change: isChange
  });
}

/**
 * Track CV download
 * @param {string} location - Where the download was triggered from
 */
export function trackCVDownload(location) {
  trackEvent('download_cv', {
    location: location
  });
}

/**
 * Initialize CV download tracking on static HTML buttons
 * Uses event delegation for efficiency
 */
export function initCVDownloadTracking() {
  document.addEventListener('click', (e) => {
    const downloadLink = e.target.closest('a[download]');

    if (downloadLink) {
      const location = getDownloadLocation(downloadLink);
      trackCVDownload(location);
    }
  });
}

/**
 * Determine download button location for analytics
 * @param {HTMLElement} element - The clicked download element
 * @returns {string} Location identifier
 */
function getDownloadLocation(element) {
  if (element.id === 'header-download-btn') return 'header';
  if (element.id === 'mobile-download-btn') return 'mobile_nav';
  if (element.closest('.header-dropdown')) return 'dropdown';
  if (element.closest('.section--intro')) return 'intro';
  if (element.closest('.section__meta')) return 'section_meta';
  return 'unknown';
}
