/**
 * Semantic Q&A System Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import SemanticQAManager from '../src/scripts/modules/semantic-qa/semantic-qa-manager.js';
import EmbeddingService from '../src/scripts/modules/semantic-qa/embedding-service.js';
import ContextChunker from '../src/scripts/modules/semantic-qa/context-chunker.js';
import SimilarityMatcher from '../src/scripts/modules/semantic-qa/similarity-matcher.js';
import ContextFencer from '../src/scripts/modules/semantic-qa/context-fencer.js';
import QAEngine from '../src/scripts/modules/semantic-qa/qa-engine.js';

// Mock the Xenova transformers
vi.mock('@xenova/transformers', () => ({
    pipeline: vi.fn().mockResolvedValue({
        // Mock model that returns dummy embeddings
        __call__: vi.fn().mockResolvedValue({
            data: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5])
        })
    })
}));

describe('SemanticQAManager', () => {
    let qaManager;
    const sampleContext = `
        Serhii has been working with React for 4+ years. 
        He is a Senior Product Manager at TechCorp. 
        Serhii specializes in product strategy and innovation.
        He has experience with JavaScript, TypeScript, and Node.js.
        Serhii graduated from University of Technology with a Computer Science degree.
    `;

    beforeEach(() => {
        qaManager = new SemanticQAManager();
    });

    describe('Initialization', () => {
        it('should initialize successfully', async () => {
            await qaManager.initialize();
            expect(qaManager.isInitialized).toBe(true);
        });

        it('should not reinitialize if already initialized', async () => {
            await qaManager.initialize();
            const firstInit = qaManager.isInitialized;
            await qaManager.initialize();
            expect(qaManager.isInitialized).toBe(firstInit);
        });
    });

    describe('Context Indexing', () => {
        beforeEach(async () => {
            await qaManager.initialize();
        });

        it('should index context successfully', async () => {
            const result = await qaManager.indexContext(sampleContext);
            
            expect(result.success).toBe(true);
            expect(result.chunkCount).toBeGreaterThan(0);
            expect(result.indexingTime).toBeGreaterThan(0);
        });

        it('should create appropriate number of chunks', async () => {
            await qaManager.indexContext(sampleContext);
            const status = qaManager.getStatus();
            
            expect(status.hasIndexedContext).toBe(true);
            expect(status.contextInfo.chunkCount).toBeGreaterThan(0);
        });
    });

    describe('Question Answering', () => {
        beforeEach(async () => {
            await qaManager.initialize();
            await qaManager.indexContext(sampleContext);
        });

        it('should answer experience questions', async () => {
            const result = await qaManager.askQuestion('Does Serhii have experience with React?');
            
            expect(result.answer).toBeDefined();
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.responseTime).toBeGreaterThan(0);
        });

        it('should answer role questions', async () => {
            const result = await qaManager.askQuestion('What is Serhii\'s role?');
            
            expect(result.answer).toBeDefined();
            expect(result.answer.toLowerCase()).toContain('senior');
        });

        it('should handle unknown information', async () => {
            const result = await qaManager.askQuestion('What is Serhii\'s favorite color?');
            
            expect(result.answer).toContain('do not have');
            expect(result.confidence).toBe(0);
        });

        it('should process batch questions', async () => {
            const questions = [
                'Does Serhii have React experience?',
                'What is his role?',
                'What technologies does he know?'
            ];
            
            const results = await qaManager.askQuestions(questions);
            
            expect(results).toHaveLength(3);
            results.forEach(result => {
                expect(result.answer).toBeDefined();
                expect(result.responseTime).toBeGreaterThan(0);
            });
        });
    });

    describe('Semantic Search', () => {
        beforeEach(async () => {
            await qaManager.initialize();
            await qaManager.indexContext(sampleContext);
        });

        it('should find semantically similar chunks', async () => {
            const results = await qaManager.semanticSearch('React experience', 2);
            
            expect(results).toHaveLength(2);
            results.forEach(result => {
                expect(result.similarity).toBeGreaterThan(0);
                expect(result.chunk).toBeDefined();
            });
        });

        it('should rank results by similarity', async () => {
            const results = await qaManager.semanticSearch('product management');
            
            if (results.length > 1) {
                for (let i = 1; i < results.length; i++) {
                    expect(results[i-1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
                }
            }
        });
    });

    describe('System Management', () => {
        it('should provide system status', () => {
            const status = qaManager.getStatus();
            
            expect(status.isInitialized).toBeDefined();
            expect(status.hasIndexedContext).toBeDefined();
            expect(status.performanceMetrics).toBeDefined();
        });

        it('should reset system state', async () => {
            await qaManager.initialize();
            await qaManager.indexContext(sampleContext);
            
            qaManager.reset();
            
            const status = qaManager.getStatus();
            expect(status.hasIndexedContext).toBe(false);
            expect(status.performanceMetrics.totalQueries).toBe(0);
        });

        it('should export and import data', async () => {
            await qaManager.initialize();
            await qaManager.indexContext(sampleContext);
            
            const exportedData = qaManager.exportData();
            expect(exportedData.context).toBe(sampleContext);
            expect(exportedData.chunks).toBeDefined();
            
            qaManager.reset();
            await qaManager.importData(exportedData);
            
            const status = qaManager.getStatus();
            expect(status.hasIndexedContext).toBe(true);
        });
    });
});

describe('ContextChunker', () => {
    let chunker;

    beforeEach(() => {
        chunker = new ContextChunker();
    });

    it('should split text into chunks', () => {
        const text = 'This is sentence one. This is sentence two. This is sentence three.';
        const chunks = chunker.chunkText(text);
        
        expect(chunks.length).toBeGreaterThan(0);
        chunks.forEach(chunk => {
            expect(chunk.text).toBeDefined();
            expect(chunk.wordCount).toBeGreaterThan(0);
            expect(chunk.id).toBeDefined();
        });
    });

    it('should extract facts from chunks', () => {
        const chunks = [{
            id: 'test',
            text: 'John is a Senior Developer. He has 5 years of experience.',
            metadata: { source: 'test' }
        }];
        
        const facts = chunker.extractFacts(chunks);
        expect(facts.length).toBeGreaterThan(0);
        facts.forEach(fact => {
            expect(fact.text).toBeDefined();
            expect(fact.confidence).toBeGreaterThan(0);
        });
    });
});

describe('ContextFencer', () => {
    let fencer;

    beforeEach(() => {
        fencer = new ContextFencer();
    });

    it('should create fenced context', () => {
        const similarChunks = [{
            chunk: {
                text: 'John is a Senior Developer with 5 years of React experience.',
                metadata: { source: 'cv' }
            },
            similarity: 0.8
        }];
        
        const result = fencer.createFencedContext(similarChunks, 'Does John have React experience?');
        
        expect(result.hasContext).toBe(true);
        expect(result.context).toContain('* Fact:');
        expect(result.context).toContain('* Question:');
        expect(result.facts.length).toBeGreaterThan(0);
    });

    it('should handle empty chunks', () => {
        const result = fencer.createFencedContext([], 'Test question?');
        
        expect(result.hasContext).toBe(false);
        expect(result.context).toBe('');
        expect(result.facts).toHaveLength(0);
    });
});

describe('QAEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new QAEngine();
    });

    it('should generate rule-based answers', async () => {
        const fencedContext = {
            hasContext: true,
            confidence: 0.8,
            facts: [{
                text: 'John has 5 years of React experience.',
                type: 'experience'
            }],
            context: '* Fact: John has 5 years of React experience.\n* Question: Does John have React experience?'
        };
        
        const result = await engine.generateAnswer('Does John have React experience?', fencedContext);
        
        expect(result.answer).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.method).toBeDefined();
    });

    it('should provide fallback for low confidence', async () => {
        const fencedContext = {
            hasContext: false,
            confidence: 0.1,
            facts: [],
            context: ''
        };
        
        const result = await engine.generateAnswer('Unknown question?', fencedContext);
        
        expect(result.answer).toContain('do not have');
        expect(result.confidence).toBe(0);
        expect(result.method).toBe('fallback');
    });
});