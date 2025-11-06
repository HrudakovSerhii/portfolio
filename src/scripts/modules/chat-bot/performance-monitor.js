/**
 * PerformanceMonitor - Handles performance monitoring, metrics collection, and resource tracking
 * Focuses on measuring and reporting system performance without caching logic
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      modelLoadTime: 0,
      queryProcessingTimes: [],
      memoryUsage: [],
      sessionStartTime: Date.now()
    };

    this.resourceMonitor = {
      interval: null,
      memoryThreshold: 200 * 1024 * 1024, // 200MB threshold
      performanceObserver: null
    };

    this.isMonitoring = false;
    this.performanceLog = [];
  }

  /**
   * Initialize performance monitoring
   */
  initialize() {
    this.startResourceMonitoring();
    this.setupPerformanceObserver();
    this.logPerformanceEvent('performance_monitor_initialized');
  }

  /**
   * Start monitoring system resources
   */
  startResourceMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // Monitor memory usage every 10 seconds
    this.resourceMonitor.interval = setInterval(() => {
      this.recordMemoryUsage();
      this.checkMemoryThreshold();
    }, 10000);
  }

  /**
   * Setup Performance Observer for detailed metrics
   */
  setupPerformanceObserver() {
    if (typeof PerformanceObserver === 'undefined') {
      console.warn('PerformanceObserver not supported');
      return;
    }

    try {
      this.resourceMonitor.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();

        entries.forEach(entry => {
          if (entry.name.includes('chat-bot')) {
            this.logPerformanceEvent('performance_entry', {
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime
            });
          }
        });
      });

      this.resourceMonitor.performanceObserver.observe({
        entryTypes: ['measure', 'navigation', 'resource']
      });
    } catch (error) {
      console.warn('Failed to setup PerformanceObserver:', error);
    }
  }

  /**
   * Record current memory usage
   */
  recordMemoryUsage() {
    if (typeof performance.memory !== 'undefined') {
      const memoryInfo = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        timestamp: Date.now()
      };

      this.metrics.memoryUsage.push(memoryInfo);

      // Keep only last 50 memory readings
      if (this.metrics.memoryUsage.length > 50) {
        this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-50);
      }

      return memoryInfo;
    }
    return null;
  }

  /**
   * Check if memory usage exceeds threshold
   */
  checkMemoryThreshold() {
    const currentMemory = this.recordMemoryUsage();

    if (currentMemory && currentMemory.used > this.resourceMonitor.memoryThreshold) {
      this.logPerformanceEvent('memory_threshold_exceeded', {
        used: currentMemory.used,
        threshold: this.resourceMonitor.memoryThreshold
      });

      // Emit event for other components to handle cleanup
      this.emitMemoryPressureEvent(currentMemory);
    }
  }

  /**
   * Emit memory pressure event for other components to handle
   */
  emitMemoryPressureEvent(memoryInfo) {
    const event = new CustomEvent('memoryPressure', {
      detail: {
        memoryInfo,
        threshold: this.resourceMonitor.memoryThreshold,
        timestamp: Date.now()
      }
    });

    window.dispatchEvent(event);
  }

  /**
   * Clear old performance logs to free memory
   */
  clearOldPerformanceLogs() {
    if (this.performanceLog.length > 1000) {
      this.performanceLog = this.performanceLog.slice(-500);
    }
  }

  /**
   * Start timing a query processing operation
   * @param {string} queryId - Unique identifier for the query
   * @returns {string} Timer ID for stopping the timer
   */
  startQueryTimer(queryId) {
    const timerId = `query_${queryId}_${Date.now()}`;
    performance.mark(`${timerId}_start`);

    this.logPerformanceEvent('query_timer_started', {
      queryId,
      timerId
    });

    return timerId;
  }

  /**
   * Stop timing a query processing operation
   * @param {string} timerId - Timer ID from startQueryTimer
   * @param {Object} metadata - Additional metadata about the query
   */
  stopQueryTimer(timerId, metadata = {}) {
    performance.mark(`${timerId}_end`);
    performance.measure(timerId, `${timerId}_start`, `${timerId}_end`);

    const measure = performance.getEntriesByName(timerId)[0];
    const duration = measure ? measure.duration : 0;

    this.metrics.queryProcessingTimes.push({
      duration,
      timestamp: Date.now(),
      metadata
    });

    // Keep only last 100 query times
    if (this.metrics.queryProcessingTimes.length > 100) {
      this.metrics.queryProcessingTimes = this.metrics.queryProcessingTimes.slice(-100);
    }

    this.logPerformanceEvent('query_timer_stopped', {
      timerId,
      duration,
      metadata
    });

    // Clean up performance entries
    performance.clearMarks(`${timerId}_start`);
    performance.clearMarks(`${timerId}_end`);
    performance.clearMeasures(timerId);

    return duration;
  }

  /**
   * Get average query processing time
   * @returns {number} Average processing time in milliseconds
   */
  getAverageQueryTime() {
    if (this.metrics.queryProcessingTimes.length === 0) return 0;

    const total = this.metrics.queryProcessingTimes.reduce(
      (sum, entry) => sum + entry.duration, 0
    );

    return total / this.metrics.queryProcessingTimes.length;
  }

  /**
   * Check if query processing is meeting performance targets
   * @returns {Object} Performance status
   */
  getPerformanceStatus() {
    const avgQueryTime = this.getAverageQueryTime();
    const targetTime = 3000; // 3 seconds target

    const currentMemory = this.recordMemoryUsage();

    return {
      avgQueryTime,
      targetTime,
      meetingTarget: avgQueryTime <= targetTime,
      memoryUsage: currentMemory,
      totalQueries: this.metrics.queryProcessingTimes.length,
      sessionDuration: Date.now() - this.metrics.sessionStartTime
    };
  }

  /**
   * Log performance event
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  logPerformanceEvent(event, data = {}) {
    const logEntry = {
      timestamp: Date.now(),
      event,
      data,
      sessionTime: Date.now() - this.metrics.sessionStartTime
    };

    this.performanceLog.push(logEntry);

    // Keep performance log manageable
    if (this.performanceLog.length > 1000) {
      this.performanceLog = this.performanceLog.slice(-500);
    }

    // Log to console in development
    if (window.isDev) {
      console.log(`[PerformanceMonitor] ${event}:`, data);
    }
  }

  /**
   * Get performance metrics summary
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      performanceStatus: this.getPerformanceStatus(),
      memoryStatus: this.getMemoryStatus()
    };
  }

  /**
   * Get memory usage status
   * @returns {Object} Memory status information
   */
  getMemoryStatus() {
    const currentMemory = this.recordMemoryUsage();
    if (!currentMemory) return { supported: false };

    const usagePercent = (currentMemory.used / currentMemory.limit) * 100;
    const thresholdPercent = (this.resourceMonitor.memoryThreshold / currentMemory.limit) * 100;

    return {
      supported: true,
      current: currentMemory,
      usagePercent,
      thresholdPercent,
      nearThreshold: usagePercent > (thresholdPercent * 0.8),
      exceedsThreshold: currentMemory.used > this.resourceMonitor.memoryThreshold
    };
  }

  /**
   * Export performance data for analysis
   * @returns {Object} Exportable performance data
   */
  exportPerformanceData() {
    return {
      metrics: this.getMetrics(),
      performanceLog: this.performanceLog.slice(-100), // Last 100 events
      timestamp: Date.now(),
      sessionId: `session_${this.metrics.sessionStartTime}`
    };
  }

  /**
   * Clean up resources and stop monitoring
   */
  cleanup() {
    this.isMonitoring = false;

    // Clear monitoring interval
    if (this.resourceMonitor.interval) {
      clearInterval(this.resourceMonitor.interval);
      this.resourceMonitor.interval = null;
    }

    // Disconnect performance observer
    if (this.resourceMonitor.performanceObserver) {
      this.resourceMonitor.performanceObserver.disconnect();
      this.resourceMonitor.performanceObserver = null;
    }

    // Clear performance entries
    if (typeof performance.clearMarks === 'function') {
      performance.clearMarks();
    }
    if (typeof performance.clearMeasures === 'function') {
      performance.clearMeasures();
    }

    this.logPerformanceEvent('performance_monitor_cleanup');

    // Clear logs after final event
    setTimeout(() => {
      this.performanceLog = [];
    }, 100);
  }
}

export default PerformanceMonitor;