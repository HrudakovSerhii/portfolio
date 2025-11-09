/**
 * EQA Worker - Extractive Question Answering using distilbert-squad
 * Handles extractive QA in a separate thread for fact-based queries
 */

let qaModel = null;
let isInitialized = false;

// Model configuration
const MODEL_CONFIG = {
    modelName: 'Xenova/distilbert-base-cased-distilled-squad',
    quantized: true
};

/**
 * Initialize the EQA model
 */
async function initializeEQAModel() {
    if (isInitialized) {
        console.log('[EQAWorker] Model already initialized');
        return;
    }

    console.log('[EQAWorker] Starting model initialization...');
    const initStartTime = Date.now();

    try {
        // Dynamic import for Xenova transformers
        console.log('[EQAWorker] Importing transformers library...');
        const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
        
        // Configure environment for web worker
        env.allowRemoteModels = true;
        env.allowLocalModels = false;

        console.log(`[EQAWorker] Loading model: ${MODEL_CONFIG.modelName}`);
        
        // Initialize question-answering pipeline with progress tracking
        qaModel = await pipeline('question-answering', MODEL_CONFIG.modelName, {
            quantized: MODEL_CONFIG.quantized,
            progress_callback: (progress) => {
                console.log('[EQAWorker] Model loading progress:', progress);
                
                if (progress.status === 'downloading' || progress.status === 'loading') {
                    self.postMessage({
                        type: 'downloadProgress',
                        progress: progress.progress || 0,
                        status: progress.status,
                        file: progress.file || progress.name
                    });
                }
            }
        });

        isInitialized = true;
        const initTime = Date.now() - initStartTime;
        
        console.log(`[EQAWorker] Model initialized successfully in ${initTime}ms`);

        self.postMessage({
            type: 'initialized',
            success: true,
            message: 'EQA model initialized successfully',
            modelName: MODEL_CONFIG.modelName,
            initTime
        });

    } catch (error) {
        const initTime = Date.now() - initStartTime;
        console.error(`[EQAWorker] Failed to initialize model after ${initTime}ms:`, error);

        self.postMessage({
            type: 'initialized',
            success: false,
            error: error.message,
            initTime
        });
    }
}

/**
 * Extract answer from context using the QA model
 * @param {string} question - The question to answer
 * @param {string} context - The context containing the answer
 * @param {string} requestId - Request identifier
 */
async function extractAnswer(question, context, requestId) {
    console.log('[EQAWorker] extractAnswer called:', {
        requestId,
        questionLength: question?.length,
        contextLength: context?.length,
        isInitialized
    });

    if (!isInitialized || !qaModel) {
        console.error('[EQAWorker] Model not initialized');
        self.postMessage({
            type: 'answer',
            requestId,
            success: false,
            error: 'Model not initialized'
        });
        return;
    }

    // Validate inputs
    if (!question || typeof question !== 'string') {
        console.error('[EQAWorker] Invalid question input');
        self.postMessage({
            type: 'answer',
            requestId,
            success: false,
            error: 'Invalid question input'
        });
        return;
    }

    if (!context || typeof context !== 'string') {
        console.error('[EQAWorker] Invalid context input');
        self.postMessage({
            type: 'answer',
            requestId,
            success: false,
            error: 'Invalid context input'
        });
        return;
    }

    const startTime = Date.now();

    try {
        console.log('[EQAWorker] Processing question:', question.substring(0, 100));
        console.log('[EQAWorker] Context preview:', context.substring(0, 200) + '...');

        // Call the QA model
        const result = await qaModel(question, context);
        
        const processingTime = Date.now() - startTime;

        console.log('[EQAWorker] Model result:', {
            answer: result.answer,
            score: result.score,
            start: result.start,
            end: result.end,
            processingTime
        });

        // Extract answer details
        const answer = result.answer || '';
        const confidence = result.score || 0;
        const startIndex = result.start || 0;
        const endIndex = result.end || 0;

        console.log('[EQAWorker] Extracted answer:', {
            answer,
            confidence,
            answerLength: answer.length,
            processingTime
        });

        self.postMessage({
            type: 'answer',
            requestId,
            success: true,
            answer,
            confidence,
            startIndex,
            endIndex,
            processingTime
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`[EQAWorker] Failed to extract answer after ${processingTime}ms:`, error);

        self.postMessage({
            type: 'answer',
            requestId,
            success: false,
            error: error.message,
            processingTime
        });
    }
}

/**
 * Message handler
 */
self.onmessage = async function(event) {
    const { type, data, requestId } = event.data;

    console.log('[EQAWorker] Received message:', { type, requestId, hasData: !!data });

    try {
        switch (type) {
            case 'initialize':
                await initializeEQAModel();
                break;

            case 'extractAnswer':
                if (!data || !data.question || !data.context) {
                    throw new Error('Missing question or context data for answer extraction');
                }
                await extractAnswer(data.question, data.context, requestId);
                break;

            case 'ping':
                self.postMessage({
                    type: 'pong',
                    requestId,
                    success: true,
                    isInitialized,
                    timestamp: Date.now()
                });
                break;

            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        console.error('[EQAWorker] Error handling message:', error);
        self.postMessage({
            type: 'error',
            requestId,
            success: false,
            error: error.message
        });
    }
};

/**
 * Handle worker errors
 */
self.onerror = function(error) {
    console.error('[EQAWorker] Worker error:', error);
    self.postMessage({
        type: 'workerError',
        success: false,
        error: error.message || 'Unknown worker error',
        filename: error.filename,
        lineno: error.lineno,
        colno: error.colno
    });
};

/**
 * Handle unhandled promise rejections
 */
self.onunhandledrejection = function(event) {
    console.error('[EQAWorker] Unhandled promise rejection:', event.reason);
    self.postMessage({
        type: 'workerError',
        success: false,
        error: `Unhandled promise rejection: ${event.reason}`,
        source: 'unhandledrejection'
    });
};

// Send ready signal when worker loads
console.log('[EQAWorker] Worker script loaded');
self.postMessage({
    type: 'workerReady',
    success: true,
    timestamp: Date.now()
});

// Auto-initialize when worker starts (like embedding worker)
console.log('[EQAWorker] Auto-initializing worker...');
initializeEQAModel().catch(error => {
    console.error('[EQAWorker] Auto-initialization failed:', error);
    self.postMessage({
        type: 'initialized',
        success: false,
        error: error.message
    });
});
