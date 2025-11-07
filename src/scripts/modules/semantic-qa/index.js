/**
 * Semantic Q&A Module - Main entry point
 * Provides a unified interface for semantic question answering
 */

import DualWorkerCoordinator from './dual-worker-coordinator.js';

// Export the consolidated coordinator as the main semantic Q&A interface
export default DualWorkerCoordinator;

// For backward compatibility, also export as SemanticQAManager
export { DualWorkerCoordinator as SemanticQAManager };

// Re-export for direct access
export { DualWorkerCoordinator };