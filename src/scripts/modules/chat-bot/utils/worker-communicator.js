/**
 * Worker Communicator
 * 
 * Generic interface for worker communication with promise-based responses.
 * Handles request/response pattern, timeouts, and error handling.
 */

export class WorkerCommunicator {
  constructor(worker, workerType, timeout = 5000) {
    this.worker = worker;
    this.workerType = workerType;
    this.timeout = timeout;
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;

    // Set up message listener
    this.worker.addEventListener('message', this.handleMessage.bind(this));

    console.log(`[WorkerCommunicator] Initialized for ${workerType} worker`);
  }

  /**
   * Generate unique request ID
   * @returns {string} Unique request identifier
   */
  generateRequestId() {
    return `${this.workerType}_${Date.now()}_${++this.requestIdCounter}`;
  }

  /**
   * Send message to worker and wait for response
   * @param {string} type - Message type
   * @param {Object} data - Message data
   * @returns {Promise} Promise that resolves with worker response
   */
  sendMessage(type, data = {}) {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      
      console.log(`[WorkerCommunicator] Sending message to ${this.workerType}:`, {
        type,
        requestId,
        dataKeys: Object.keys(data)
      });

      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        console.error(`[WorkerCommunicator] Timeout for ${this.workerType} request ${requestId}`);
        reject(new Error(`Worker timeout after ${this.timeout}ms`));
      }, this.timeout);

      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeoutId,
        type,
        timestamp: Date.now()
      });

      // Send message to worker
      // Wrap data in 'data' property for workers that expect it
      this.worker.postMessage({
        type,
        requestId,
        data
      });
    });
  }

  /**
   * Handle message from worker
   * @param {MessageEvent} event - Message event from worker
   */
  handleMessage(event) {
    const { requestId, type, success, error } = event.data;

    if (!requestId) {
      // Handle messages without requestId (e.g., progress updates)
      console.log(`[WorkerCommunicator] Received ${this.workerType} message without requestId:`, type);
      return;
    }

    const pendingRequest = this.pendingRequests.get(requestId);
    
    if (!pendingRequest) {
      console.warn(`[WorkerCommunicator] Received response for unknown request ${requestId}`);
      return;
    }

    // Clear timeout
    clearTimeout(pendingRequest.timeoutId);
    this.pendingRequests.delete(requestId);

    console.log(`[WorkerCommunicator] Received response from ${this.workerType}:`, {
      requestId,
      type,
      success,
      hasError: !!error
    });

    // Resolve or reject based on success flag
    if (success === false || error) {
      pendingRequest.reject(new Error(error || 'Worker request failed'));
    } else {
      pendingRequest.resolve(event.data);
    }
  }

  /**
   * Clear all pending requests
   */
  clearPendingRequests() {
    console.log(`[WorkerCommunicator] Clearing ${this.pendingRequests.size} pending requests for ${this.workerType}`);
    
    for (const [requestId, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeoutId);
      request.reject(new Error('Worker communicator cleared'));
    }
    
    this.pendingRequests.clear();
  }

  /**
   * Terminate worker and cleanup
   */
  terminate() {
    console.log(`[WorkerCommunicator] Terminating ${this.workerType} worker`);
    this.clearPendingRequests();
    this.worker.terminate();
  }
}
