/**
 * Fetch API Polyfill for older browsers
 * Provides a fetch-like interface using XMLHttpRequest when native fetch is unavailable
 */

/**
 * Check if native fetch is available
 * @returns {boolean} True if fetch is available
 */
function isFetchAvailable() {
  return typeof fetch !== 'undefined' && typeof Promise !== 'undefined';
}

/**
 * Fetch implementation using XMLHttpRequest
 * @param {string} url - URL to fetch
 * @param {Object} [options] - Fetch options (method, headers, body, etc.)
 * @returns {Promise<Response>} Promise that resolves to a Response-like object
 */
function fetchWithXHR(url, options = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const method = (options.method || 'GET').toUpperCase();
    
    xhr.onload = () => {
      // Create a Response-like object
      const response = {
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        statusText: xhr.statusText,
        headers: parseHeaders(xhr.getAllResponseHeaders()),
        url: url,
        text: () => Promise.resolve(xhr.responseText),
        json: () => {
          try {
            return Promise.resolve(JSON.parse(xhr.responseText));
          } catch (error) {
            return Promise.reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        },
        blob: () => Promise.resolve(new Blob([xhr.response])),
        arrayBuffer: () => Promise.resolve(xhr.response)
      };
      
      resolve(response);
    };
    
    xhr.onerror = () => {
      reject(new Error('Network error occurred'));
    };
    
    xhr.ontimeout = () => {
      reject(new Error('Request timeout'));
    };
    
    xhr.open(method, url);
    
    // Set timeout (default 10 seconds)
    xhr.timeout = options.timeout || 10000;
    
    // Set headers
    if (options.headers) {
      Object.keys(options.headers).forEach(key => {
        xhr.setRequestHeader(key, options.headers[key]);
      });
    }
    
    // Send request
    xhr.send(options.body || null);
  });
}

/**
 * Parse XHR headers string into an object
 * @private
 * @param {string} headersString - Raw headers string from XHR
 * @returns {Object} Headers object
 */
function parseHeaders(headersString) {
  const headers = {};
  if (!headersString) return headers;
  
  const headerPairs = headersString.split('\r\n');
  headerPairs.forEach(line => {
    const parts = line.split(': ');
    if (parts.length === 2) {
      headers[parts[0].toLowerCase()] = parts[1];
    }
  });
  
  return headers;
}

/**
 * Universal fetch function that uses native fetch or XHR fallback
 * @param {string} url - URL to fetch
 * @param {Object} [options] - Fetch options
 * @returns {Promise<Response>} Promise that resolves to a Response object
 */
function universalFetch(url, options) {
  if (isFetchAvailable()) {
    return fetch(url, options);
  } else {
    console.warn('Native fetch not available, using XMLHttpRequest fallback');
    return fetchWithXHR(url, options);
  }
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    universalFetch,
    isFetchAvailable,
    fetchWithXHR
  };
}

// Also export as global for browser usage
if (typeof window !== 'undefined') {
  window.universalFetch = universalFetch;
}
