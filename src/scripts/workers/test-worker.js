/**
 * Minimal test worker to debug loading issues
 */

console.log('Test worker script loaded');

// Test basic worker functionality
self.onmessage = function(event) {
  console.log('Test worker received message:', event.data);
  
  const { type } = event.data;
  
  if (type === 'test') {
    self.postMessage({
      type: 'test_response',
      message: 'Test worker is working!',
      receivedData: event.data
    });
  } else {
    console.warn('Unknown message type:', type);
    self.postMessage({
      type: 'error',
      error: `Unknown message type: ${type}`
    });
  }
};

// Test error handling
self.onerror = function(error) {
  console.error('Test worker error:', error);
  self.postMessage({
    type: 'error',
    error: error.message || 'Unknown test worker error'
  });
};

console.log('Test worker setup complete');